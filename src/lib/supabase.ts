import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''
).trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('YOUR_PROJECT') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE')
)

/**
 * The publishable/anon key is safe to use in a browser only when every table
 * is protected by correct RLS policies. Never put a service-role key here.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local .env file, then restart Vite.',
    )
  }
  return supabase
}

/**
 * Phone check-in uses its own browser session so a member OTP never replaces
 * a gym staff owner's existing LiftDesk session on the same device.
 */
export function createMemberCheckInClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('LiftDesk check-in is not configured yet. Please ask gym staff for help.')
  }
  return createClient(supabaseUrl!, supabaseAnonKey, {
    auth: {
      storageKey: 'liftdesk-member-check-in-auth',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
