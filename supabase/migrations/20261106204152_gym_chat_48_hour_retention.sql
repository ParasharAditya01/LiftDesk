-- Hide ordinary chat messages at 48 hours and purge them every minute.
-- Pinned announcements remain visible until a manager unpins them.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create index if not exists gym_chat_messages_retention_idx
  on public.gym_chat_messages (created_at)
  where not is_pinned;

-- Apply the retention rule to existing records as soon as this migration runs.
delete from public.gym_chat_messages
where created_at < now() - interval '48 hours'
  and not is_pinned;

-- Replace the named job on re-application so there is only one cleanup task.
select cron.unschedule(jobid)
from cron.job
where jobname = 'gym-chat-message-retention';

select cron.schedule(
  'gym-chat-message-retention',
  '* * * * *',
  $cleanup$
    delete from public.gym_chat_messages
    where created_at < now() - interval '48 hours'
      and not is_pinned;
  $cleanup$
);

comment on column public.gym_chat_messages.is_pinned is
  'Pinned announcements are retained until unpinned; ordinary messages expire after 48 hours.';
