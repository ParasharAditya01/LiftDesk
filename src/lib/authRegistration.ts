import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from './legalConsent'

type AuthApi = SupabaseClient['auth']

export const PRODUCTION_AUTH_REDIRECT_URL = 'https://liftdesk.pages.dev/'
export const CONFIRMATION_REQUEST_ACCEPTED_MESSAGE = 'Confirmation request submitted. Check your inbox and spam folder. LiftDesk cannot confirm inbox delivery.'
export const SIGNUP_NEXT_STEP_MESSAGE = 'If this address can be registered, the next step will arrive by email. If you already use LiftDesk, try signing in.'

export function authRedirectUrl(origin: string, isDevelopment = false, redirectTo?: string): string {
  const current = new URL(origin)
  const isLocalOrigin = current.hostname === 'localhost' || current.hostname.endsWith('.localhost') || current.hostname === '127.0.0.1' || current.hostname === '[::1]'
  const target = new URL('/', isDevelopment && isLocalOrigin ? current.origin : PRODUCTION_AUTH_REDIRECT_URL)
  if (redirectTo) {
    const requested = new URL(redirectTo, current.origin)
    // Carry app-owned callback path and invitation/redirect query state, but
    // always pin the destination host to LiftDesk (or local dev).
    target.pathname = requested.pathname.startsWith('//') ? '/' : requested.pathname
    target.search = requested.search
    target.hash = requested.hash
  }
  return target.toString()
}

/** Build a safe OAuth return URL while preserving a one-time app invitation. */
export function authOAuthRedirectUrl(
  origin: string,
  isDevelopment = false,
  invitation?: { inviteToken?: string; staffInviteToken?: string },
): string {
  const redirect = new URL('/', origin)
  if (invitation?.inviteToken) redirect.searchParams.set('invite', invitation.inviteToken)
  if (invitation?.staffInviteToken) redirect.searchParams.set('staff_invite', invitation.staffInviteToken)
  return authRedirectUrl(origin, isDevelopment, redirect.toString())
}

/** Synchronous lock to prevent rapid duplicate auth calls before React rerenders. */
export function createRequestLock() {
  let locked = false
  return {
    tryAcquire() {
      if (locked) return false
      locked = true
      return true
    },
    release() { locked = false },
  }
}

export type SignupResult =
  | { kind: 'signed-in'; session: Session }
  | { kind: 'confirmation-pending'; user: User }
  | { kind: 'existing-account'; user: User }
  | { kind: 'incomplete' }

export function classifySignupResult(user: User | null, session: Session | null): SignupResult {
  if (session) return { kind: 'signed-in', session }
  if (!user) return { kind: 'incomplete' }
  if (user.identities?.length === 0) return { kind: 'existing-account', user }
  return { kind: 'confirmation-pending', user }
}

export async function requestOwnerSignup(
  auth: AuthApi,
  input: { email: string; password: string; ownerName: string; origin: string; isDevelopment?: boolean },
) {
  return auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(input.origin, input.isDevelopment),
      data: {
        full_name: input.ownerName,
        liftdesk_terms_version: TERMS_VERSION,
        liftdesk_privacy_version: PRIVACY_NOTICE_VERSION,
      },
    },
  })
}

export async function requestSignupConfirmation(
  auth: AuthApi,
  input: { email: string; origin: string; redirectTo?: string; isDevelopment?: boolean },
) {
  return auth.resend({
    type: 'signup',
    email: input.email,
    options: { emailRedirectTo: authRedirectUrl(input.origin, input.isDevelopment, input.redirectTo) },
  })
}
