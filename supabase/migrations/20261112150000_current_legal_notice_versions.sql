-- Require existing users to accept the rewritten Terms and Privacy Notice.
-- Keep the version check in step with src/lib/legalVersions.ts.
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
  if requested_terms_version is distinct from '2026-11-12'
    or requested_privacy_version is distinct from '2026-11-12' then
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
