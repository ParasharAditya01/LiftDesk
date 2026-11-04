import type { User } from '@supabase/supabase-js'
import { requireSupabase } from './supabase'
import { DEFAULT_GYM_THEME, normalizeGymTheme, type GymThemeId } from './gymThemes'

export type GymRole = 'owner' | 'admin' | 'trainer' | 'member'
export type Gym = { id: string; name: string; city: string | null; phone: string | null; theme: GymThemeId }
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

export type CoachingPlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type CoachingPlan = {
  id: string; gym_id: string; member_id: string; created_by: string; name: string
  objective: string; starts_on: string; ends_on: string | null; status: CoachingPlanStatus
  plan_data: Record<string, unknown>; created_at: string; updated_at: string
}
export type MemberProgress = {
  id: string; gym_id: string; member_id: string; created_by: string; recorded_on: string
  weight_kg: number | null; measurements: Record<string, unknown>; milestone: string
  workout_notes: string; member_feedback: string; observations: string; created_at: string
}
export type CoachingNote = {
  id: string; gym_id: string; member_id: string; created_by: string; category: string
  note: string; follow_up_on: string | null; created_at: string
}
export type CoachingTemplate = { id: string; gym_id: string; created_by: string; kind: 'diet' | 'workout'; name: string; objective: string; plan_data: Record<string, unknown>; created_at: string }

export async function listCoachingTemplates(gymId: string, kind: 'diet' | 'workout') {
  const { data, error } = await requireSupabase().from('coaching_plan_templates').select('*').eq('gym_id', gymId).eq('kind', kind).order('name')
  if (error) throw error
  return (data ?? []) as CoachingTemplate[]
}

export async function createCoachingTemplate(gymId: string, userId: string, input: Pick<CoachingTemplate, 'kind' | 'name' | 'objective' | 'plan_data'>) {
  const { data, error } = await requireSupabase().from('coaching_plan_templates').insert({ ...input, gym_id: gymId, created_by: userId }).select().single()
  if (error) throw error
  return data as CoachingTemplate
}

export async function listCoachingRecords(gymId: string, memberId: string) {
  const client = requireSupabase()
  const [diet, workout, progress, notes] = await Promise.all([
    client.from('diet_plans').select('*').eq('gym_id', gymId).eq('member_id', memberId).order('updated_at', { ascending: false }),
    client.from('workout_plans').select('*').eq('gym_id', gymId).eq('member_id', memberId).order('updated_at', { ascending: false }),
    client.from('member_progress').select('*').eq('gym_id', gymId).eq('member_id', memberId).order('recorded_on', { ascending: false }),
    client.from('coaching_notes').select('*').eq('gym_id', gymId).eq('member_id', memberId).order('created_at', { ascending: false }),
  ])
  for (const result of [diet, workout, progress, notes]) if (result.error) throw result.error
  return { diet: (diet.data ?? []) as CoachingPlan[], workout: (workout.data ?? []).map(row => ({ ...row, objective: row.goal })) as CoachingPlan[], progress: (progress.data ?? []) as MemberProgress[], notes: (notes.data ?? []) as CoachingNote[] }
}

export async function getOwnCoachingRecords(gymId: string, memberId: string) {
  const client = requireSupabase()
  const [diet, workout, progress] = await Promise.all([
    client.from('diet_plans').select('id, gym_id, member_id, name, objective, starts_on, ends_on, status, plan_data, updated_at').eq('gym_id', gymId).eq('member_id', memberId).in('status', ['active', 'completed']).order('updated_at', { ascending: false }),
    client.from('workout_plans').select('id, gym_id, member_id, name, goal, starts_on, ends_on, status, plan_data, updated_at').eq('gym_id', gymId).eq('member_id', memberId).in('status', ['active', 'completed']).order('updated_at', { ascending: false }),
    client.from('member_progress').select('id, gym_id, member_id, recorded_on, weight_kg, measurements, milestone, workout_notes, member_feedback, observations').eq('gym_id', gymId).eq('member_id', memberId).order('recorded_on', { ascending: false }),
  ])
  for (const result of [diet, workout, progress]) if (result.error) throw result.error
  return { diet: diet.data ?? [], workout: (workout.data ?? []).map(row => ({ ...row, objective: row.goal })), progress: (progress.data ?? []) as MemberProgress[] }
}

export async function listCoachingPlanSummary(gymId: string) {
  const client = requireSupabase()
  const [diet, workout, progress] = await Promise.all([
    client.from('diet_plans').select('member_id, status').eq('gym_id', gymId),
    client.from('workout_plans').select('member_id, status').eq('gym_id', gymId),
    client.from('member_progress').select('member_id, recorded_on').eq('gym_id', gymId).order('recorded_on', { ascending: false }),
  ])
  for (const result of [diet, workout, progress]) if (result.error) throw result.error
  return { diet: diet.data ?? [], workout: workout.data ?? [], progress: progress.data ?? [] }
}

export async function archiveCoachingPlan(gymId: string, memberId: string, kind: 'diet' | 'workout', planId: string) {
  const table = kind === 'diet' ? 'diet_plans' : 'workout_plans'
  const { error } = await requireSupabase().from(table).update({ status: 'archived' }).eq('id', planId).eq('gym_id', gymId).eq('member_id', memberId)
  if (error) throw error
}

export async function addMemberProgress(gymId: string, memberId: string, userId: string, input: Omit<MemberProgress, 'id' | 'gym_id' | 'member_id' | 'created_by' | 'created_at'>) {
  const { error } = await requireSupabase().from('member_progress').insert({ ...input, gym_id: gymId, member_id: memberId, created_by: userId })
  if (error) throw error
}

export async function addCoachingNote(gymId: string, memberId: string, userId: string, input: Pick<CoachingNote, 'category' | 'note' | 'follow_up_on'>) {
  const { error } = await requireSupabase().from('coaching_notes').insert({ ...input, gym_id: gymId, member_id: memberId, created_by: userId, follow_up_on: input.follow_up_on || null })
  if (error) throw error
}

export async function getCurrentGym(user: User): Promise<{ gym: Gym; role: GymRole } | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('gym_memberships')
    .select('gym_id, role, gyms!inner(id, name, city, phone, theme)')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const joined = data.gyms as unknown as Omit<Gym, 'theme'> & { theme?: unknown }
  const gym: Gym = { ...joined, theme: normalizeGymTheme(joined.theme) }
  return { gym, role: data.role as GymRole }
}

export async function createGymForCurrentUser(input: {
  name: string
  ownerName: string
  city?: string
  phone?: string
  theme?: GymThemeId
}): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_gym_for_current_user', {
    gym_name: input.name.trim(),
    owner_name: input.ownerName.trim(),
    gym_city: input.city?.trim() || null,
    gym_phone: input.phone?.trim() || null,
    gym_theme: input.theme ?? DEFAULT_GYM_THEME,
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
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (input.membershipExpiresOn && input.membershipExpiresOn < today) {
    throw new Error('Membership expiry cannot be earlier than today.')
  }
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


export async function createMemberInvitation(gymId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_member_invitation', { target_gym: gymId })
  if (error) throw error
  if (typeof data !== 'string' || data.length !== 64) throw new Error('Could not create a valid member invitation.')
  return data
}

export type MemberProfile = {
  id: string
  gym_id: string
  full_name: string
  phone: string
  email: string | null
  whatsapp_number: string | null
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  plan_name: string
  membership_expires_on: string | null
  status: 'active' | 'inactive' | 'paused'
}

export async function acceptMemberInvitation(input: {
  token: string
  fullName: string
  phone: string
  whatsappNumber: string
  age: number
  weightKg: number
  heightCm: number
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('accept_member_invitation', {
    invitation_token: input.token,
    full_name: input.fullName,
    phone_number: input.phone,
    whatsapp_number: input.whatsappNumber,
    member_age: input.age,
    weight_kg: input.weightKg,
    height_cm: input.heightCm,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('The invitation could not be accepted.')
  return data
}

export async function getOwnMemberProfile(userId: string): Promise<MemberProfile> {
  const { data, error } = await requireSupabase()
    .from('members')
    .select('id, gym_id, full_name, phone, email, whatsapp_number, age, weight_kg, height_cm, plan_name, membership_expires_on, status')
    .eq('member_user_id', userId)
    .single()
  if (error) throw error
  return data as MemberProfile
}
