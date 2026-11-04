import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ClipboardCheck, Copy, LoaderCircle, Pencil, Plus, Search, Users, X } from 'lucide-react'
import { createGymStaffInvitation, listGymStaff, listGymStaffAttendance, saveGymStaff, saveGymStaffAttendance, type GymStaff, type GymStaffAttendance, type StaffAttendanceStatus, type StaffRole } from './lib/staffData'
import { userFacingError } from './lib/userFacingError'
import type { GymRole } from './lib/gymData'

type Props = { gymId: string; role: GymRole }
type AttendanceFilter = 'all' | 'present' | 'absent' | 'not-marked'
type FormState = { staffCode: string; fullName: string; role: StaffRole; phone: string; email: string; joiningDate: string; employmentStatus: 'active' | 'inactive'; profilePhotoUrl: string; notes: string }
const todayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const initialForm = (role: StaffRole = 'trainer'): FormState => ({ staffCode: '', fullName: '', role, phone: '', email: '', joiningDate: todayKey(), employmentStatus: 'active', profilePhotoUrl: '', notes: '' })
const prettyDate = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
const humanRole = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const attendanceLabel = (row?: GymStaffAttendance) => row ? humanRole(row.status) : 'Not Marked'

export default function StaffWorkspace({ gymId, role }: Props) {
  const permitted = role === 'owner' || role === 'admin'
  const owner = role === 'owner'
  const [staff, setStaff] = useState<GymStaff[]>([])
  const [attendance, setAttendance] = useState<GymStaffAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all')
  const [statusFilter, setStatusFilter] = useState<AttendanceFilter>('all')
  const [employmentFilter, setEmploymentFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [date, setDate] = useState(todayKey())
  const [selected, setSelected] = useState<GymStaff | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GymStaff | null>(null)
  const [form, setForm] = useState<FormState>(initialForm())
  const [attendanceNote, setAttendanceNote] = useState('')
  const [markStatus, setMarkStatus] = useState<StaffAttendanceStatus>('present')
  const [invitationStaff, setInvitationStaff] = useState<GymStaff | null>(null)
  const [invitationUrl, setInvitationUrl] = useState('')
  const [creatingInvitation, setCreatingInvitation] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [people, history] = await Promise.all([listGymStaff(gymId), listGymStaffAttendance(gymId)])
      setStaff(people); setAttendance(history)
    } catch (e) { setError(userFacingError(e, 'Could not load staff records. Confirm the Staff migration has been applied and try again.')) }
    finally { setLoading(false) }
  }, [gymId])
  useEffect(() => { if (permitted) void refresh(); else setLoading(false) }, [refresh, permitted])

  const visibleStaff = useMemo(() => staff.filter(person =>
    (owner || person.role === 'trainer') &&
    (person.full_name + ' ' + person.staff_code + ' ' + person.phone).toLowerCase().includes(query.toLowerCase()) &&
    (roleFilter === 'all' || person.role === roleFilter) &&
    (employmentFilter === 'all' || person.employment_status === employmentFilter) &&
    (statusFilter === 'all' || (statusFilter === 'not-marked' ? !attendance.some(a => a.staff_id === person.id && a.attendance_date === date) : attendance.some(a => a.staff_id === person.id && a.attendance_date === date && a.status === statusFilter)))
  ), [staff, owner, query, roleFilter, employmentFilter, statusFilter, attendance, date])
  const activeStaff = staff.filter(person => (owner || person.role === 'trainer') && person.employment_status === 'active')
  const todaysAttendance = attendance.filter(row => row.attendance_date === date)
  const statusFor = (person: GymStaff) => todaysAttendance.find(row => row.staff_id === person.id)
  const expectedActive = activeStaff
  const presentCount = expectedActive.filter(person => statusFor(person)?.status === 'present').length
  const absentCount = expectedActive.filter(person => statusFor(person)?.status === 'absent').length
  const unmarkedCount = expectedActive.length - presentCount - absentCount
  const selectedHistory = selected ? attendance.filter(row => row.staff_id === selected.id).sort((a,b) => b.attendance_date.localeCompare(a.attendance_date)) : []

  function openCreate() { setEditing(null); setForm(initialForm(owner ? 'trainer' : 'trainer')); setShowForm(true); setError(''); setNotice('') }
  function openEdit(person: GymStaff) { setEditing(person); setForm({ staffCode: person.staff_code, fullName: person.full_name, role: person.role, phone: person.phone, email: person.email ?? '', joiningDate: person.joining_date, employmentStatus: person.employment_status, profilePhotoUrl: person.profile_photo_url ?? '', notes: person.notes ?? '' }); setShowForm(true); setError(''); setNotice('') }

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    if (!editing && form.joiningDate < todayKey()) {
      setError('A new staff member’s joining date cannot be earlier than today.')
      return
    }
    if (editing && form.joiningDate !== editing.joining_date && form.joiningDate < todayKey()) {
      setError('A changed joining date cannot be earlier than today. The existing historical date can stay unchanged.')
      return
    }
    if (!owner && form.role !== 'trainer') { setError('Admins can only manage trainer records.'); setSaving(false); return }
    const accessChanged = !!editing && (editing.role !== form.role || editing.employment_status !== form.employmentStatus)
    if (accessChanged && !window.confirm('This changes this staff member’s login access immediately. Continue?')) return
    setSaving(true)
    try {
      await saveGymStaff(gymId, { ...(editing ? { id: editing.id } : {}), ...form })
      setShowForm(false); setNotice(accessChanged ? 'Staff record and linked login access updated. The change is recorded in the access audit.' : editing ? 'Staff record updated.' : 'Staff record added.'); await refresh()
    } catch (e) { setError(userFacingError(e, 'Could not save the staff record. Check for a duplicate Staff ID and try again.')) }
    finally { setSaving(false) }
  }

  async function markAttendance(person: GymStaff) {
    if (person.employment_status !== 'active') return
    const existing = attendance.find(row => row.staff_id === person.id && row.attendance_date === date)
    setSaving(true); setError(''); setNotice('')
    try {
      await saveGymStaffAttendance(gymId, person.id, date, markStatus, attendanceNote, existing?.id)
      setNotice(existing ? 'Attendance correction saved with an audit timestamp.' : 'Staff attendance recorded.')
      setAttendanceNote(''); await refresh()
    } catch (e) { setError(userFacingError(e, 'Could not save attendance. Refresh and try again.')) }
    finally { setSaving(false) }
  }

  async function createInvitation(person: GymStaff) {
    setInvitationStaff(person); setInvitationUrl(''); setCopyMessage(''); setError(''); setCreatingInvitation(true)
    try {
      const token = await createGymStaffInvitation(person.id)
      const url = new URL('/', window.location.origin)
      url.searchParams.set('staff_invite', token)
      setInvitationUrl(url.toString())
    } catch (e) { setInvitationStaff(null); setError(userFacingError(e, 'Could not create an invitation. Check that the staff member has an active record and email address.')) }
    finally { setCreatingInvitation(false) }
  }

  async function copyInvitation() {
    try { await navigator.clipboard.writeText(invitationUrl); setCopyMessage('Invitation link copied.') }
    catch { setCopyMessage('Copy is unavailable here. Select and copy the link below.') }
  }

  if (!permitted) return <section className="surface staff-access-denied" role="alert"><h2>Staff workspace unavailable</h2><p>Your account does not have permission to view staff records.</p></section>

  return <div className="staff-workspace">
    {error && <div className="notice-banner error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Retry</button></div>}
    {notice && <div className="notice-banner" role="status"><Check size={16}/><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
    <div className="staff-date-bar"><div><span className="eyebrow">STAFF OPERATIONS</span><p>Attendance date · {prettyDate(date)}</p></div><label className="staff-date-input"><CalendarDays size={16}/><input aria-label="Staff attendance date" type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div>
    <div className="metric-grid staff-metrics">
      <div className="metric-card"><div className="metric-top"><span>Total staff</span><span className="metric-icon"><Users size={17}/></span></div><div className="metric-value">{activeStaff.length}</div><div className="metric-bottom">Active staff visible to you</div></div>
      <div className="metric-card"><div className="metric-top"><span>Present today</span><span className="metric-icon"><Check size={17}/></span></div><div className="metric-value">{presentCount}</div><div className="metric-bottom">Attendance marked present</div></div>
      <div className="metric-card"><div className="metric-top"><span>Absent today</span><span className="metric-icon"><X size={17}/></span></div><div className="metric-value">{absentCount}</div><div className="metric-bottom">Explicitly marked absent</div></div>
      <div className="metric-card"><div className="metric-top"><span>Not marked</span><span className="metric-icon"><ClipboardCheck size={17}/></span></div><div className="metric-value">{unmarkedCount}</div><div className="metric-bottom">No attendance record yet</div></div>
    </div>
    <section className="surface staff-directory">
      <div className="directory-toolbar staff-toolbar">
        <label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, Staff ID or phone" aria-label="Search staff"/></label>
        <div className="staff-filters">
          <select aria-label="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value as 'all' | StaffRole)}><option value="all">All roles</option>{owner && <option value="admin">Admin</option>}<option value="trainer">Trainer</option></select>
          <select aria-label="Filter by attendance" value={statusFilter} onChange={e => setStatusFilter(e.target.value as AttendanceFilter)}><option value="all">All attendance</option><option value="present">Present</option><option value="absent">Absent</option><option value="not-marked">Not marked</option></select>
          <select aria-label="Filter by employment" value={employmentFilter} onChange={e => setEmploymentFilter(e.target.value as 'all' | 'active' | 'inactive')}><option value="active">Active staff</option><option value="inactive">Inactive staff</option><option value="all">All employment</option></select>
          <span className="staff-record-count">{visibleStaff.length} records</span>
          <button type="button" className="button-primary" onClick={openCreate}><Plus size={15}/> Add staff</button>
        </div>
      </div>
      {loading ? <div className="empty-state"><LoaderCircle className="spin" size={20}/> Loading staff records…</div> : <div className="table-scroll"><table className="staff-table"><thead><tr><th>STAFF</th><th>ROLE</th><th>CONTACT</th><th>JOINED</th><th>TODAY'S STATUS</th><th>EMPLOYMENT</th><th>ACTIONS</th></tr></thead><tbody>
        {visibleStaff.map(person => { const row = statusFor(person); const isActive = person.employment_status === 'active'; return <tr key={person.id}>
          <td><button type="button" className="staff-name-button" onClick={() => setSelected(person)}><span className="staff-avatar">{person.full_name.split(/\s+/).slice(0,2).map(part => part[0] ?? '').join('').toUpperCase()}</span><span><b>{person.full_name}</b><small>{person.staff_code}</small></span></button></td>
          <td>{humanRole(person.role)}</td><td><a href={'tel:' + person.phone.replace(/[^+\d]/g,'')}>{person.phone}</a>{person.email && <small className="staff-email">{person.email}</small>}</td><td>{prettyDate(person.joining_date)}</td>
          <td><span className={'staff-status staff-status-' + (row?.status ?? 'not-marked')}>{attendanceLabel(row)}</span></td>
          <td><span className={'staff-employment staff-employment-' + person.employment_status}>{humanRole(person.employment_status)}</span></td>
          <td><div className="staff-row-actions"><button type="button" className="button-small" onClick={() => { setSelected(person); setMarkStatus(row?.status ?? 'present'); setAttendanceNote(row?.note ?? '') }} disabled={!isActive}>{row ? 'Correct' : 'Mark present'}</button><button type="button" className="button-small staff-invite-button" onClick={() => void createInvitation(person)} disabled={!isActive || !person.email} title={!person.email ? 'Add an email address to this staff record first' : 'Create a sign-in invitation'}>Invite</button><button type="button" className="row-more" aria-label={'Edit ' + person.full_name} onClick={() => openEdit(person)}><Pencil size={14}/></button></div></td>
        </tr> })}
      </tbody></table>{visibleStaff.length === 0 && <div className="empty-state">No staff records match these filters.</div>}</div>}
    </section>
    {selected && <div className="staff-detail-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}><section className="staff-detail-panel" role="dialog" aria-modal="true" aria-labelledby="staff-detail-title">
      <div className="modal-header"><div><p className="auth-eyebrow">STAFF PROFILE</p><h2 id="staff-detail-title">{selected.full_name}</h2><p>{selected.staff_code} · {humanRole(selected.role)}</p></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Close profile"><X size={18}/></button></div>
      <div className="staff-profile-grid"><div><small>Phone</small><b>{selected.phone}</b></div><div><small>Email</small><b>{selected.email || 'Not provided'}</b></div><div><small>Joining date</small><b>{prettyDate(selected.joining_date)}</b></div><div><small>Employment</small><b>{humanRole(selected.employment_status)}</b></div></div>
      <h3>Record attendance for {prettyDate(date)}</h3><div className="staff-attendance-editor"><label>Status<select value={markStatus} onChange={e => setMarkStatus(e.target.value as StaffAttendanceStatus)}><option value="present">Present</option><option value="absent">Absent</option></select></label><label>Correction note (optional)<input maxLength={1000} value={attendanceNote} onChange={e => setAttendanceNote(e.target.value)} placeholder="Reason for marking or correction"/></label><button className="button-primary" disabled={saving || selected.employment_status !== 'active'} onClick={() => void markAttendance(selected)}>{saving ? 'Saving…' : 'Save attendance'}</button></div>
      <h3>Attendance history</h3><div className="staff-history-list">{selectedHistory.slice(0,60).map(row => <div key={row.id}><span>{prettyDate(row.attendance_date)}</span><span className={'staff-status staff-status-' + row.status}>{humanRole(row.status)}</span><small>Marked by account {row.marked_by?.slice(0, 8) ?? 'unknown'} · Updated by account {row.updated_by?.slice(0, 8) ?? 'unknown'} · {new Date(row.updated_at).toLocaleString('en-IN')}</small></div>)}{selectedHistory.length === 0 && <p>No attendance history recorded.</p>}</div>
      <p className="staff-audit-note">Corrections update the record's updated-by identity and timestamp. Attendance changes are not silent.</p>
    </section></div>}
    {showForm && <div className="staff-detail-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }}><section className="staff-form-modal" role="dialog" aria-modal="true" aria-labelledby="staff-form-title">
      <div className="modal-header"><div><p className="auth-eyebrow">STAFF DIRECTORY</p><h2 id="staff-form-title">{editing ? 'Edit staff record' : 'Add staff'}</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
      <form onSubmit={submitStaff}><div className="form-two"><label>Staff ID<input required minLength={2} maxLength={32} value={form.staffCode} onChange={e => setForm({...form,staffCode:e.target.value})} placeholder="e.g. TR-001"/></label><label>Full name<input required minLength={2} maxLength={120} value={form.fullName} onChange={e => setForm({...form,fullName:e.target.value})}/></label></div>
      <div className="form-two"><label>Role<select value={form.role} disabled={!owner} onChange={e => setForm({...form,role:e.target.value as StaffRole})}><option value="trainer">Trainer</option>{owner && <option value="admin">Admin</option>}</select></label><label>Phone<input required type="tel" minLength={5} maxLength={30} pattern="\+?[0-9][0-9\s().-]{4,29}" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})}/></label></div>
      <div className="form-two"><label>Email (optional)<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label><label>Joining date<input required type="date" min={!editing ? todayKey() : undefined} value={form.joiningDate} onChange={e => setForm({...form,joiningDate:e.target.value})}/></label></div>
      <div className="form-two"><label>Employment status<select value={form.employmentStatus} onChange={e => setForm({...form,employmentStatus:e.target.value as 'active' | 'inactive'})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label>Profile photo URL (optional)<input type="url" value={form.profilePhotoUrl} onChange={e => setForm({...form,profilePhotoUrl:e.target.value})}/></label></div>
      <label>Notes (optional)<textarea maxLength={2000} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})}/></label><p className="modal-note">Save a staff email address here first. Then use Invite in the staff list to create a single-use sign-in link.</p>
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save staff record'}</button></div></form>
    </section></div>}
    {invitationStaff && <div className="staff-detail-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !creatingInvitation) { setInvitationStaff(null); setInvitationUrl('') } }}><section className="staff-form-modal staff-invitation-modal" role="dialog" aria-modal="true" aria-labelledby="staff-invitation-title">
      <div className="modal-header"><div><p className="auth-eyebrow">STAFF SIGN-IN</p><h2 id="staff-invitation-title">Invite {invitationStaff.full_name}</h2><p>{invitationStaff.email} · {humanRole(invitationStaff.role)}</p></div><button type="button" className="icon-button" onClick={() => { setInvitationStaff(null); setInvitationUrl('') }} aria-label="Close invitation" disabled={creatingInvitation}><X size={18}/></button></div>
      {creatingInvitation ? <div className="empty-state"><LoaderCircle className="spin" size={20}/> Creating secure invitation…</div> : invitationUrl ? <><p className="modal-note">Share this private link with {invitationStaff.email}. It expires in 48 hours, works once, and grants the {invitationStaff.role} role after that person confirms their email and signs in.</p><label className="staff-invitation-link-label">Private invitation link<input className="staff-invitation-link" readOnly value={invitationUrl} onFocus={event => event.currentTarget.select()} /></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setInvitationStaff(null); setInvitationUrl('') }}>Close</button><button type="button" className="button-primary" onClick={() => void copyInvitation()}><Copy size={15}/> Copy invitation link</button></div>{copyMessage && <p className="staff-copy-feedback" role="status">{copyMessage}</p>}<p className="staff-audit-note">The link is a sign-in credential. Send it only to the email address shown above. Creating another link invalidates previous unused links for this staff member.</p></> : <p className="modal-note">Could not create the invitation.</p>}
    </section></div>}
  </div>
}
