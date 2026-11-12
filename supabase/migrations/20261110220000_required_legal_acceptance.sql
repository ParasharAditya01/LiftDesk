-- Store explicit Terms and Privacy Notice acceptance for each authenticated user.
create table public.user_legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  privacy_notice_version text not null,
  privacy_accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_legal_acceptances enable row level security;
revoke all on table public.user_legal_acceptances from anon, authenticated;

create or replace function public.has_current_legal_acceptance(
  expected_terms_version text,
  expected_privacy_version text
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_legal_acceptances a
    where a.user_id = (select auth.uid())
      and a.terms_version = expected_terms_version
      and a.privacy_notice_version = expected_privacy_version
  );
$$;

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
  if requested_terms_version is distinct from '2026-11-10'
    or requested_privacy_version is distinct from '2026-11-10' then
    raise exception 'The Terms or Privacy Notice version is no longer current. Reload the page and try again';
  end if;

  insert into public.user_legal_acceptances (
    user_id, terms_version, terms_accepted_at,
    privacy_notice_version, privacy_accepted_at, updated_at
  ) values (
    (select auth.uid()), requested_terms_version, now(),
    requested_privacy_version, now(), now()
  )
  on conflict (user_id) do update set
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at,
    privacy_notice_version = excluded.privacy_notice_version,
    privacy_accepted_at = excluded.privacy_accepted_at,
    updated_at = now();
end;
$$;

revoke all on function public.has_current_legal_acceptance(text,text) from public, anon;
grant execute on function public.has_current_legal_acceptance(text,text) to authenticated;
revoke all on function public.record_legal_acceptance(text,text,boolean,boolean) from public, anon;
grant execute on function public.record_legal_acceptance(text,text,boolean,boolean) to authenticated;
