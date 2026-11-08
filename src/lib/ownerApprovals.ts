import { requireSupabase } from './supabase'
import type { GymThemeId } from './gymThemes'

export type OwnerAccessRequest = {
  id: string
  user_id: string
  owner_email: string
  owner_name: string
  gym_name: string
  city: string | null
  phone: string | null
  owner_mobile_phone?: string | null
  gym_theme: GymThemeId
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
  created_at: string
  active_owner_count: number
  member_count: number
  active_member_count: number
  admin_count: number
  active_admin_count: number
  trainer_count: number
  active_trainer_count: number
  last_attendance_at: string | null
}

export async function isLiftDeskPlatformAdmin(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('is_liftdesk_platform_admin')
  if (error) throw error
  return data === true
}

export async function listPlatformGymDirectory(): Promise<PlatformGymSummary[]> {
  const { data, error } = await requireSupabase().rpc('list_liftdesk_platform_gym_directory_v2')
  if (error) throw error
  return (data ?? []) as PlatformGymSummary[]
}

export async function getMyOwnerAccessRequest(userId: string): Promise<OwnerAccessRequest | null> {
  const { data, error } = await requireSupabase()
    .from('owner_access_requests')
    .select('id, user_id, owner_email, owner_name, gym_name, city, phone, gym_theme, status, review_note, created_at')
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
  theme: GymThemeId
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('request_owner_workspace_with_contact', {
    gym_name: input.gymName.trim(),
    owner_name: input.ownerName.trim(),
    owner_mobile_phone: input.ownerMobilePhone.trim(),
    gym_city: input.city.trim(),
    gym_phone: input.gymPhone?.trim() || null,
    gym_theme: input.theme,
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
