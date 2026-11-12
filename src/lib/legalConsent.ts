import { requireSupabase } from './supabase'

export const TERMS_VERSION = '2026-11-10'
export const PRIVACY_NOTICE_VERSION = '2026-11-10'

export async function hasCurrentLegalAcceptance(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('has_current_legal_acceptance', {
    expected_terms_version: TERMS_VERSION,
    expected_privacy_version: PRIVACY_NOTICE_VERSION,
  })
  if (error) throw error
  if (typeof data !== 'boolean') throw new Error('Could not verify your Terms and Privacy Notice acceptance.')
  return data
}

export async function recordCurrentLegalAcceptance(): Promise<void> {
  const { error } = await requireSupabase().rpc('record_legal_acceptance', {
    requested_terms_version: TERMS_VERSION,
    requested_privacy_version: PRIVACY_NOTICE_VERSION,
    terms_accepted: true,
    privacy_accepted: true,
  })
  if (error) throw error
}

export function hasCurrentLegalAcceptanceMetadata(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.liftdesk_terms_version === TERMS_VERSION
    && metadata?.liftdesk_privacy_version === PRIVACY_NOTICE_VERSION
}
