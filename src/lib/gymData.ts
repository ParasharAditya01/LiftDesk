import type { User } from '@supabase/supabase-js'
import { requireSupabase } from './supabase'

export type GymRole = 'owner' | 'admin' | 'staff'
export type Gym = { id: string; name: string; city: string | null; phone: string | null }
export type GymMember = {
  id: string
  gym_id: string
  full_name: string
  phone: string
  email: string | null
  status: 'active' | 'inactive' | 'paused'
  joined_on: string
  membership_expires_on: string | null
  plan_name: string
  monthly_fee: number
  created_at: string
}
export type AttendanceRecord = {
  id: string
  gym_id: string
  member_id: string
  checked_in_at: string
  method: 'manual' | 'qr'
}
export type FollowUp = {
  id: string
  gym_id: string
  member_id: string
  kind: 'inactive' | 'renewal' | 'general'
  status: 'open' | 'contacted' | 'resolved'
  due_on: string
  note: string | null
  created_at: string
}

export async function getCurrentGym(user: User): Promise<{ gym: Gym; role: GymRole } | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('gym_memberships')
    .select('gym_id, role, gyms!inner(id, name, city, phone)')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const joined = data.gyms as unknown as Gym
  return { gym: joined, role: data.role as GymRole }
}

export async function createGymForCurrentUser(input: {
  name: string
  ownerName: string
  city?: string
  phone?: string
}): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_gym_for_current_user', {
    gym_name: input.name.trim(),
    owner_name: input.ownerName.trim(),
    gym_city: input.city?.trim() || null,
    gym_phone: input.phone?.trim() || null,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('Gym creation did not return a workspace ID.')
  return data
}

export async function listMembers(gymId: string): Promise<GymMember[]> {
  const { data, error } = await requireSupabase()
    .from('members')
    .select('id, gym_id, full_name, phone, email, status, joined_on, membership_expires_on, plan_name, monthly_fee, created_at')
    .eq('gym_id', gymId)
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as GymMember[]
}

export async function createMember(gymId: string, input: {
  fullName: string
  phone: string
  email?: string
  planName: string
  monthlyFee: number
  membershipExpiresOn?: string
}): Promise<GymMember> {
  const { data, error } = await requireSupabase()
    .from('members')
    .insert({
      gym_id: gymId,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      plan_name: input.planName,
      monthly_fee: input.monthlyFee,
      membership_expires_on: input.membershipExpiresOn || null,
    })
    .select('id, gym_id, full_name, phone, email, status, joined_on, membership_expires_on, plan_name, monthly_fee, created_at')
    .single()
  if (error) throw error
  return data as GymMember
}

export async function listAttendance(gymId: string, sinceIso: string): Promise<AttendanceRecord[]> {
  const { data, error } = await requireSupabase()
    .from('attendance')
    .select('id, gym_id, member_id, checked_in_at, method')
    .eq('gym_id', gymId)
    .gte('checked_in_at', sinceIso)
    .order('checked_in_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AttendanceRecord[]
}

export async function recordManualCheckIn(gymId: string, memberId: string): Promise<{
  attendance_id: string
  member_name: string
  checked_in_at: string
}> {
  const { data, error } = await requireSupabase().rpc('record_manual_check_in', {
    target_gym: gymId,
    target_member: memberId,
  })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result) throw new Error('The check-in was not recorded.')
  return result as { attendance_id: string; member_name: string; checked_in_at: string }
}

export async function listFollowUps(gymId: string): Promise<FollowUp[]> {
  const { data, error } = await requireSupabase()
    .from('follow_ups')
    .select('id, gym_id, member_id, kind, status, due_on, note, created_at')
    .eq('gym_id', gymId)
    .order('due_on', { ascending: true })
  if (error) throw error
  return (data ?? []) as FollowUp[]
}
