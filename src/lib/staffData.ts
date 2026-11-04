import { requireSupabase } from './supabase'

export type StaffRole = 'admin' | 'trainer'
export type StaffEmploymentStatus = 'active' | 'inactive'
export type StaffAttendanceStatus = 'present' | 'absent'
export type GymStaff = {
  id: string
  gym_id: string
  staff_code: string
  full_name: string
  role: StaffRole
  phone: string
  email: string | null
  joining_date: string
  employment_status: StaffEmploymentStatus
  profile_photo_url: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
export type GymStaffAttendance = {
  id: string
  gym_id: string
  staff_id: string
  attendance_date: string
  status: StaffAttendanceStatus
  note: string | null
  marked_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}
const staffFields = 'id, gym_id, staff_code, full_name, role, phone, email, joining_date, employment_status, profile_photo_url, notes, created_by, updated_by, created_at, updated_at'
const attendanceFields = 'id, gym_id, staff_id, attendance_date, status, note, marked_by, updated_by, created_at, updated_at'

export async function listGymStaff(gymId: string): Promise<GymStaff[]> {
  const { data, error } = await requireSupabase().from('gym_staff').select(staffFields).eq('gym_id', gymId).order('full_name')
  if (error) throw error
  return (data ?? []) as GymStaff[]
}
export async function saveGymStaff(gymId: string, input: {
  id?: string; staffCode: string; fullName: string; role: StaffRole; phone: string
  email?: string; joiningDate: string; employmentStatus: StaffEmploymentStatus
  profilePhotoUrl?: string; notes?: string
}): Promise<GymStaff> {
  const payload = {
    gym_id: gymId, staff_code: input.staffCode.trim(), full_name: input.fullName.trim(),
    role: input.role, phone: input.phone.trim(), email: input.email?.trim() || null,
    joining_date: input.joiningDate, employment_status: input.employmentStatus,
    profile_photo_url: input.profilePhotoUrl?.trim() || null, notes: input.notes?.trim() || null,
  }
  const query = requireSupabase().from('gym_staff')
  const { data, error } = input.id
    ? await query.update(payload).eq('id', input.id).eq('gym_id', gymId).select(staffFields).single()
    : await query.insert(payload).select(staffFields).single()
  if (error) throw error
  return data as GymStaff
}

export async function createGymStaffInvitation(staffId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_gym_staff_invitation', { target_staff: staffId })
  if (error) throw error
  if (typeof data !== 'string' || data.length !== 64) throw new Error('Could not create a valid staff invitation.')
  return data
}

export async function acceptGymStaffInvitation(token: string): Promise<void> {
  const { error } = await requireSupabase().rpc('accept_gym_staff_invitation', { invitation_token: token })
  if (error) throw error
}

export async function listGymStaffAttendance(gymId: string): Promise<GymStaffAttendance[]> {
  const { data, error } = await requireSupabase().from('gym_staff_attendance').select(attendanceFields).eq('gym_id', gymId).order('attendance_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as GymStaffAttendance[]
}
export async function saveGymStaffAttendance(gymId: string, staffId: string, date: string, status: StaffAttendanceStatus, note?: string, existingId?: string): Promise<GymStaffAttendance> {
  const client = requireSupabase()
  const payload = { gym_id: gymId, staff_id: staffId, attendance_date: date, status, note: note?.trim() || null }
  const result = existingId
    ? await client.from('gym_staff_attendance').update(payload).eq('id', existingId).eq('gym_id', gymId).select(attendanceFields).single()
    : await client.from('gym_staff_attendance').insert(payload).select(attendanceFields).single()
  if (result.error) throw result.error
  return result.data as GymStaffAttendance
}
