type ErrorLike = { code?: unknown; message?: unknown; name?: unknown }

/** Extract a provider error code without retaining or displaying its raw message. */
export function authErrorCode(value: unknown): string | null {
  const code = (value as ErrorLike | null)?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

/** Keep backend diagnostics out of the UI while preserving deliberate local guidance. */
export function userFacingError(value: unknown, fallback: string): string {
  const error = value as ErrorLike | null
  const code = authErrorCode(error) ?? ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  if (/gym_contact_number_registry_gym_phone_key|phone\/whatsapp number is already used|phone number already in use/.test(message)) {
    return 'This phone/WhatsApp number is already used by another person in this gym. Enter a different number.'
  }
  if (/already checked in today|checked in moments ago/.test(message)) {
    return 'This member has already checked in today.'
  }
  if (/invitation request limit reached/.test(message)) {
    return 'You have reached the hourly invitation limit. Wait before creating more invitations.'
  }
  if (/sign in with the email address this invitation was sent to/.test(message)) {
    return 'This Google account does not match the email on the staff invitation. Use the invited account or ask the gym Owner to create a new invitation.'
  }
  if (/this invitation has expired or has already been used|this invitation link is invalid/.test(message)) {
    return 'This invitation link is invalid, expired, or already used. Ask the gym Owner or Admin for a new invitation.'
  }
  if (/this account already belongs to a gym/.test(message)) {
    return 'This account is already linked to a gym and cannot accept another gym invitation.'
  }
  if (error?.name === 'AuthRetryableFetchError' || /network|fetch|failed to connect|load failed/.test(message)) {
    return 'A network error interrupted the request. Check your connection and try again.'
  }
  if (code === 'email_send_failed' || code === 'smtp_error' || /smtp|send.*email|email.*send|mail server/.test(message)) {
    return 'Supabase could not send the email. The project owner should check the SMTP settings and email provider logs.'
  }
  if (value instanceof Error && !('code' in value)) return value.message
  if (code === 'invalid_credentials') return 'Email or password was not accepted. Check the details and try again.'
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in. If you did not receive a confirmation email, request another one.'
  if (code === 'over_email_send_rate_limit') return 'Supabase has temporarily limited confirmation emails for this project or address. Wait before retrying; repeated requests will not bypass the limit. If this continues, the project owner needs to configure custom SMTP in Supabase.'
  if (code === 'email_address_not_authorized') return 'This project is not configured to send email to that address. The owner must configure email delivery in Supabase.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Check that the email address is valid, then try again.'
  if (code === 'user_already_exists') return 'An account already exists for that email. Try signing in instead.'
  if (code === 'provider_disabled') return 'Google sign-in is not configured for this LiftDesk project yet. The project Owner must enable Google under Supabase Authentication providers.'
  if (code === 'weak_password') return 'Choose a stronger password and try again.'
  return fallback
}
