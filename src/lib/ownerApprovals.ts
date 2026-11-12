import { requireSupabase } from './supabase'
import { DEFAULT_GYM_THEME } from './gymThemes'

export type OwnerAccessRequest = {
  id: string
  user_id: string
  owner_email: string | null
  owner_name: string
  gym_name: string
  city: string | null
  phone: string | null
  owner_mobile_phone?: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
}

/** Platform-admin view: gym aggregates plus the current owner support number only. */
export type PlatformGymSummary = {
  gym_id: string
  gym_name: string
  city: string | null
  owner_phone: string | null
  owner_email: string
  created_at: string
  active_owner_count: number
  member_count: number
  active_member_count: number
  admin_count: number
  active_admin_count: number
  trainer_count: number
  active_trainer_count: number
  last_attendance_at: string | null
  workspace_paused_at: string | null
}

export async function isLiftDeskPlatformAdmin(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('is_liftdesk_platform_admin')
  if (error) throw error
  return data === true
}

export async function listPlatformGymDirectory(): Promise<PlatformGymSummary[]> {
  const { data, error } = await requireSupabase().rpc('list_liftdesk_platform_gym_directory_v4')
  if (error) throw error
  return (data ?? []) as PlatformGymSummary[]
}

export async function setPlatformGymWorkspacePaused(gymId: string, paused: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_liftdesk_gym_workspace_paused', {
    target_gym: gymId, requested_paused: paused,
  })
  if (error) throw error
}

export async function getMyPausedWorkspaceAccess(): Promise<{ gym_name: string; paused_at: string } | null> {
  const { data, error } = await requireSupabase().rpc('get_my_paused_workspace_access')
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  const access = data as { gym_name?: unknown; paused_at?: unknown }
  if (typeof access.gym_name !== 'string' || typeof access.paused_at !== 'string') return null
  return { gym_name: access.gym_name, paused_at: access.paused_at }
}

export async function createPlatformGymWorkspace(input: {
  gymName: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  city: string
  phone: string
}): Promise<{ gymId: string; ownerEmail: string; ownerAccountReady: boolean }> {
  const { data, error } = await requireSupabase().rpc('create_liftdesk_gym_workspace', {
    requested_gym_name: input.gymName.trim(),
    requested_owner_name: input.ownerName.trim(),
    requested_owner_email: input.ownerEmail.trim(),
    requested_owner_phone: input.ownerPhone.trim(),
    requested_city: input.city.trim() || null,
    requested_gym_phone: input.phone.trim(),
    requested_theme: DEFAULT_GYM_THEME,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') throw new Error('LiftDesk did not create the gym workspace.')
  const result = row as { gym_id: string; owner_email: string; owner_account_ready: boolean }
  return { gymId: result.gym_id, ownerEmail: result.owner_email, ownerAccountReady: result.owner_account_ready }
}

export async function removePlatformGymWorkspace(gymId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('remove_liftdesk_gym_workspace', { target_gym: gymId })
  if (error) throw error
}

export async function getMyOwnerAccessRequest(userId: string): Promise<OwnerAccessRequest | null> {
  const { data, error } = await requireSupabase()
    .from('owner_access_requests')
    .select('id, user_id, owner_email, owner_name, gym_name, city, phone, status, review_note, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as OwnerAccessRequest | null
}

export async function requestOwnerWorkspace(input: {
  gymName: string
  ownerName: string
  city: string
  ownerMobilePhone: string
  gymPhone?: string
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('request_owner_workspace_with_contact', {
    gym_name: input.gymName.trim(),
    owner_name: input.ownerName.trim(),
    owner_mobile_phone: input.ownerMobilePhone.trim(),
    gym_city: input.city.trim(),
    gym_phone: input.gymPhone?.trim() || null,
    gym_theme: DEFAULT_GYM_THEME,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('LiftDesk did not save the workspace request.')
  return data
}

export async function getMyOwnerPhone(): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc('get_my_owner_contact_number')
  if (error) throw error
  return typeof data === 'string' ? data : null
}

export async function updateMyOwnerPhone(phone: string): Promise<void> {
  const { error } = await requireSupabase().rpc('update_my_owner_contact_number', { requested_phone: phone.trim() })
  if (error) throw error
}
