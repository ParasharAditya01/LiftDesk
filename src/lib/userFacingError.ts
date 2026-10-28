type ErrorLike = { code?: unknown; message?: unknown; name?: unknown }

/** Keep backend diagnostics out of the UI while preserving deliberate local guidance. */
export function userFacingError(value: unknown, fallback: string): string {
  if (value instanceof Error && !('code' in value)) return value.message

  const error = value as ErrorLike | null
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  if (code === 'invalid_credentials') return 'Email or password was not accepted. Check the details and try again.'
  if (code === 'email_not_confirmed') return 'Confirm your email using the newest link we sent, then sign in.'
  if (code === 'over_email_send_rate_limit') return 'Email sending is temporarily limited. Wait a while and try again.'
  if (code === 'email_address_not_authorized') return 'This project is not configured to send email to that address. The owner must configure email delivery in Supabase.'
  if (code === 'user_already_exists') return 'An account already exists for that email. Try signing in instead.'
  if (code === 'weak_password') return 'Choose a stronger password and try again.'
  if (error?.name === 'AuthRetryableFetchError' || /network|fetch|failed to connect|load failed/.test(message)) {
    return 'A network error interrupted the request. Check your connection and try again.'
  }
  return fallback
}
