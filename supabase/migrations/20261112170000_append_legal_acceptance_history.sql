-- Preserve each accepted Terms/Privacy version pair instead of overwriting a user's prior acceptance.
-- Existing rows are retained as the first recorded acceptance for their user.
alter table public.user_legal_acceptances
  drop constraint if exists user_legal_acceptances_pkey;

alter table public.user_legal_acceptances
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.user_legal_acceptances
  add constraint user_legal_acceptances_pkey primary key (id);

create unique index if not exists user_legal_acceptances_version_pair_uidx
  on public.user_legal_acceptances (user_id, terms_version, privacy_notice_version);

create or replace function public.record_legal_acceptance(
  requested_terms_version text,
  requested_privacy_version text,
  terms_accepted boolean,
  privacy_accepted boolean
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before recording legal acceptance';
  end if;
  if terms_accepted is distinct from true or privacy_accepted is distinct from true then
    raise exception 'Accept both the Terms of Service and Privacy Notice to continue';
  end if;
  if requested_terms_version is distinct from '2026-11-12-v2.0'
    or requested_privacy_version is distinct from '2026-11-12-v2.0' then
    raise exception 'The Terms or Privacy Notice version is no longer current. Reload the page and try again';
  end if;

  insert into public.user_legal_acceptances (
    user_id, terms_version, terms_accepted_at,
    privacy_notice_version, privacy_accepted_at, updated_at
  ) values (
    (select auth.uid()), requested_terms_version, now(),
    requested_privacy_version, now(), now()
  )
  on conflict (user_id, terms_version, privacy_notice_version) do nothing;
end;
$$;

revoke all on function public.record_legal_acceptance(text,text,boolean,boolean) from public, anon;
grant execute on function public.record_legal_acceptance(text,text,boolean,boolean) to authenticated;
