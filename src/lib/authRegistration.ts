import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

type AuthApi = SupabaseClient['auth']

export function authRedirectUrl(origin: string): string {
  return new URL('/', origin).toString()
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
  input: { email: string; password: string; ownerName: string; origin: string },
) {
  return auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(input.origin),
      data: { full_name: input.ownerName },
    },
  })
}

export async function requestSignupConfirmation(
  auth: AuthApi,
  input: { email: string; origin: string; redirectTo?: string },
) {
  return auth.resend({
    type: 'signup',
    email: input.email,
    options: { emailRedirectTo: input.redirectTo ?? authRedirectUrl(input.origin) },
  })
}
