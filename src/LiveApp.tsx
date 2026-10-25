import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, Bell, CalendarDays, ClipboardCheck, LayoutDashboard, LoaderCircle, LogOut, Plus, QrCode, Search, Users } from 'lucide-react'
import { createMember, listAttendance, listFollowUps, listMembers, recordManualCheckIn, type AttendanceRecord, type FollowUp, type Gym, type GymMember, type GymRole } from './lib/gymData'
import { requireSupabase } from './lib/supabase'

type Props = { gym: Gym; role: GymRole; user: User }
type Section = 'Overview' | 'Members' | 'Attendance' | 'Follow-ups' | 'Reports'
const sections: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: 'Overview', icon: LayoutDashboard }, { name: 'Members', icon: Users },
  { name: 'Attendance', icon: QrCode }, { name: 'Follow-ups', icon: Bell }, { name: 'Reports', icon: CalendarDays },
]
const dateLabel = (value: string | null) => value ? new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
const timeLabel = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

export default function LiveApp({ gym, role, user }: Props) {
  const [section, setSection] = useState<Section>('Overview')
  const [members, setMembers] = useState<GymMember[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' })

  const refresh = useCallback(async () => {
    setError('')
    try {
      const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0)
      const [memberRows, attendanceRows, followUpRows] = await Promise.all([
        listMembers(gym.id), listAttendance(gym.id, since.toISOString()), listFollowUps(gym.id),
      ])
      setMembers(memberRows); setAttendance(attendanceRows); setFollowUps(followUpRows)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load gym data.') }
    finally { setLoading(false) }
  }, [gym.id])

  useEffect(() => { void refresh() }, [refresh])

  const filteredMembers = useMemo(() => members.filter(m => (m.full_name + ' ' + m.phone).toLowerCase().includes(query.toLowerCase())), [members, query])
  const today = new Date().toLocaleDateString('en-CA')
  const visitsToday = attendance.filter(a => new Date(a.checked_in_at).toLocaleDateString('en-CA') === today)
  const active = members.filter(m => m.status === 'active')
  const expiring = members.filter(m => m.membership_expires_on && m.membership_expires_on >= today && m.membership_expires_on <= new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA'))
  const inactiveFollowUps = followUps.filter(f => f.kind === 'inactive' && f.status !== 'resolved')
  const openFollowUps = followUps.filter(f => f.status !== 'resolved')

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await createMember(gym.id, { fullName: form.name, phone: form.phone, email: form.email, planName: form.plan, monthlyFee: Number(form.fee), membershipExpiresOn: form.expiry || undefined })
      setForm({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' }); setShowAdd(false)
      setNotice('Member saved to your gym workspace.'); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save member.') }
    finally { setSaving(false) }
  }

  async function checkIn(member: GymMember) {
    setSaving(true); setError(''); setNotice('')
    try { await recordManualCheckIn(gym.id, member.id); setNotice('Attendance recorded for ' + member.full_name + '.'); await refresh(); setSection('Attendance') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not record attendance.') }
    finally { setSaving(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-top"><div className="brand-lockup"><span className="brand-mark"><Activity size={19}/></span><span className="brand-name">Lift<span>Desk</span><small>GYM OPERATIONS</small></span></div></div>
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(gym.name).slice(0,2)}</div><div className="workspace-copy"><b>{gym.name}</b><span>{role} workspace</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{sections.map(({name, icon: Icon}) => <button key={name} className={'nav-item ' + (section === name ? 'nav-active' : '')} onClick={() => setSection(name)}><Icon size={18}/><span>{name}</span>{name === 'Follow-ups' && openFollowUps.length > 0 && <span className="nav-count">{openFollowUps.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-pilot"><div className="pilot-icon"><ShieldIcon/></div><b>Private workspace</b><p>Records are loaded from your gym database.</p><span>LIVE DATABASE</span></div>
      <div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{initials(user.email || 'Owner')}</div><div className="profile-copy"><b>{user.email}</b><span>{role}</span></div><button className="icon-button" aria-label="Sign out" onClick={() => void requireSupabase().auth.signOut()}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><span className="breadcrumb-muted">{gym.name}</span><span className="breadcrumb-slash">/</span><b>{section}</b></div><div className="topbar-right"><span className="preview-pill live-pill"><span/> Live data</span><span className="topbar-divider"/><span className="today-label"><CalendarDays size={15}/> {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{gym.city ? gym.city.toUpperCase() + ' / ' : ''}{gym.name.toUpperCase()}</div><h1>{section === 'Overview' ? 'Your gym, at a glance.' : section}</h1><p>{section === 'Overview' ? 'A live view of your members, attendance and follow-ups.' : section === 'Members' ? 'Manage the member records stored for this gym.' : section === 'Attendance' ? 'Check-in history recorded for your gym.' : section === 'Follow-ups' ? 'Review open reminders and membership attention items.' : 'A summary of activity recorded in your workspace.'}</p></div>{section === 'Members' && <button className="button-primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add member</button>}</div>
        {error && <div className="notice-banner error-banner" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}
        {notice && <div className="notice-banner" role="status"><ClipboardCheck size={17}/><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
        {loading ? <div className="surface live-loading"><LoaderCircle className="spin" size={22}/><p>Loading your gym records…</p></div> : <>
          {section === 'Overview' && <>
            <div className="welcome-card"><div className="welcome-copy"><div className="welcome-label"><Activity size={14}/> LIVE WORKSPACE</div><h2>Welcome to {gym.name}.</h2><p>These figures come from your gym's database, not sample records.</p><button className="text-action" onClick={() => setSection('Members')}>Manage members <Users size={15}/></button></div></div>
            <div className="section-head"><div><h2>The essentials</h2><p>Current records from your workspace.</p></div></div>
            <div className="metric-grid">
              <Metric label="Active members" value={String(active.length)} detail={members.length + ' total records'} icon={Users}/>
              <Metric label="Visits today" value={String(visitsToday.length)} detail="Recorded check-ins" icon={QrCode}/>
              <Metric label="Renewals soon" value={String(expiring.length)} detail="Next 7 days" icon={CalendarDays}/>
              <Metric label="Open follow-ups" value={String(openFollowUps.length)} detail={inactiveFollowUps.length + ' inactivity reminders'} icon={Bell}/>
            </div>
            <section className="surface recent-panel"><div className="surface-heading"><div><h2>Recent check-ins</h2><p>Latest attendance records from the last 30 days</p></div><button className="subtle-select" onClick={() => setSection('Attendance')}>View attendance ↗</button></div><RecordsTable attendance={attendance.slice(0,8)} members={members}/></section>
          </>}
          {section === 'Members' && <section className="surface directory-panel"><div className="directory-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search members"/></div><div className="directory-filters"><span>{filteredMembers.length} records</span></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>STATUS</th><th>EXPIRES</th><th>MONTHLY FEE</th><th>ACTION</th></tr></thead><tbody>{filteredMembers.map(m => <tr key={m.id}><td><b>{m.full_name}</b><br/><small>{m.phone}</small></td><td>{m.plan_name}</td><td><Status status={m.status}/></td><td>{dateLabel(m.membership_expires_on)}</td><td>{money(Number(m.monthly_fee))}</td><td><button className="button-small" disabled={saving || m.status !== 'active'} onClick={() => void checkIn(m)}>Check in</button></td></tr>)}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state">No member records found.</div>}</div></section>}
          {section === 'Attendance' && <section className="surface directory-panel"><div className="surface-heading"><div><h2>Attendance history</h2><p>Latest 30-day records</p></div><span>{attendance.length} check-ins</span></div><RecordsTable attendance={attendance} members={members}/><div className="attendance-callout"><div className="qr-illustration"><QrCode size={28}/></div><div><h2>Manual check-in</h2><p>Use the Members tab to record a validated check-in. QR scanning will be enabled after token-based scanning is connected.</p></div><button className="button-primary" onClick={() => setSection('Members')}>Choose member</button></div></section>}
          {section === 'Follow-ups' && <section className="surface directory-panel"><div className="surface-heading"><div><h2>Follow-up queue</h2><p>Reminders currently stored for this gym</p></div><span>{openFollowUps.length} open</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER ID</th><th>TYPE</th><th>DUE DATE</th><th>STATUS</th><th>NOTE</th></tr></thead><tbody>{followUps.map(f => <tr key={f.id}><td>{members.find(m => m.id === f.member_id)?.full_name || 'Member'}</td><td>{f.kind}</td><td>{dateLabel(f.due_on)}</td><td>{f.status}</td><td>{f.note || '—'}</td></tr>)}</tbody></table>{followUps.length === 0 && <div className="empty-state">No follow-ups have been created yet.</div>}</div></section>}
          {section === 'Reports' && <div className="page-stack"><section className="surface report-surface"><h2>Workspace summary</h2><p>All figures are calculated from records accessible to this gym account.</p><div className="metric-grid metric-grid-two"><Metric label="Total members" value={String(members.length)} detail="All statuses" icon={Users}/><Metric label="Check-ins (30 days)" value={String(attendance.length)} detail="Attendance rows" icon={QrCode}/><Metric label="Active memberships" value={String(active.length)} detail="Status marked active" icon={Activity}/><Metric label="Open follow-ups" value={String(openFollowUps.length)} detail="Not resolved" icon={Bell}/></div></section></div>}
        </>}
        <div className="page-footer"><span>LiftDesk · {gym.name}</span><span>Signed in as {user.email}</span></div>
      </div>
    </main>
    {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowAdd(false) }}><section className="member-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><div className="modal-header"><div><p className="auth-eyebrow">MEMBER MANAGEMENT</p><h2 id="add-member-title">Add a member</h2></div><button className="icon-button" onClick={() => setShowAdd(false)} aria-label="Close">×</button></div><form onSubmit={addMember}><label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><div className="form-two"><label>Phone<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})}/></label><label>Email (optional)<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label></div><div className="form-two"><label>Plan<input required value={form.plan} onChange={e => setForm({...form,plan:e.target.value})}/></label><label>Monthly fee (₹)<input required type="number" min="0" step="1" value={form.fee} onChange={e => setForm({...form,fee:e.target.value})}/></label></div><label>Membership expiry (optional)<input type="date" value={form.expiry} onChange={e => setForm({...form,expiry:e.target.value})}/></label><p className="modal-note"><Activity size={15}/> The member is saved to this gym's database and protected by Supabase access policies.</p>{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save member'}</button></div></form></section></div>}
  </div>
}

function ShieldIcon() { return <Activity size={16}/> }
function Status({status}: {status: GymMember['status']}) { const label = status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Inactive'; return <span className={'status status-' + (status === 'active' ? 'active' : status === 'paused' ? 'expiring' : 'inactive')}><i/>{label}</span> }
function Metric({label,value,detail,icon:Icon}: {label:string;value:string;detail:string;icon:typeof Users}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span>{detail}</span></div></div> }
function RecordsTable({attendance,members}: {attendance:AttendanceRecord[];members:GymMember[]}) { return <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>CHECK-IN</th><th>METHOD</th></tr></thead><tbody>{attendance.map(a => { const member = members.find(m => m.id === a.member_id); return <tr key={a.id}><td><b>{member?.full_name || 'Member'}</b></td><td>{timeLabel(a.checked_in_at)}</td><td>{a.method === 'qr' ? 'QR scan' : 'Manual'}</td></tr> })}</tbody></table>{attendance.length === 0 && <div className="empty-state">No attendance recorded yet.</div>}</div>}
