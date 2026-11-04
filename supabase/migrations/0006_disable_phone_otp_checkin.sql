-- Member self-check-in by WhatsApp OTP has been removed. New attendance must
-- be recorded by gym staff through record_manual_check_in().
do $$
begin
  if to_regprocedure('public.check_in_with_phone_otp(uuid)') is not null then
    execute 'revoke all on function public.check_in_with_phone_otp(uuid) from public, anon, authenticated';
  end if;
end;
$$;
drop function if exists public.check_in_with_phone_otp(uuid);
