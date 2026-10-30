import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, Bell, CalendarDays, ClipboardCheck, Dumbbell, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus, Search, Users, X } from 'lucide-react'
import { createMember, createMemberInvitation, listAttendance, listFollowUps, listMembers, recordManualCheckIn, type AttendanceRecord, type FollowUp, type Gym, type GymMember, type GymRole } from './lib/gymData'
import { requireSupabase } from './lib/supabase'
import { userFacingError } from './lib/userFacingError'
import LiftDeskMark from './LiftDeskMark'
import LiftDeskLogo from './LiftDeskLogo'
import StaffWorkspace from './StaffWorkspace'
import { useScrollMotion } from './lib/useScrollMotion'
import CoachingWorkspace from './CoachingWorkspace'

type Props = { gym: Gym; role: GymRole; user: User }
type Section = 'Overview' | 'Members' | 'Coaching' | 'Attendance' | 'Follow-ups' | 'Reports' | 'Staff'
const sections: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: 'Overview', icon: LayoutDashboard }, { name: 'Members', icon: Users },
  { name: 'Coaching', icon: Dumbbell }, { name: 'Attendance', icon: ClipboardCheck }, { name: 'Follow-ups', icon: Bell }, { name: 'Reports', icon: CalendarDays }, { name: 'Staff', icon: Users },
]
const BUSINESS_TIME_ZONE = 'Asia/Kolkata'
const indiaDateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
const dateLabel = (value: string | null) => value ? new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
const timeLabel = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
const telHref = (value: string) => {
  if (!/^\+?[0-9][0-9\s().-]*$/.test(value.trim())) return null
  const number = value.trim().replace(/[\s().-]/g, '')
  const digits = number.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? `tel:${number}` : null
}

export default function LiveApp({ gym, role, user }: Props) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  const [section, setSection] = useState<Section>('Overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pageContentRef = useRef<HTMLDivElement>(null)
  const addMemberButtonRef = useRef<HTMLButtonElement>(null)
  const memberDialogRef = useRef<HTMLElement>(null)
  const closeMenu = useCallback((restoreFocus = false) => {
    setMobileNavOpen(false)
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>('.mobile-close')?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
      if (event.key === 'Tab') {
        const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen, closeMenu])

  function navigate(next: Section) {
    setSection(next)
    closeMenu()
    requestAnimationFrame(() => headingRef.current?.focus())
  }
  const [members, setMembers] = useState<GymMember[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' })

  useScrollMotion(pageContentRef, `${section}:${loading}`)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0)
      const [memberRows, attendanceRows, followUpRows] = await Promise.all([
        listMembers(gym.id), listAttendance(gym.id, since.toISOString()), listFollowUps(gym.id),
      ])
      setMembers(memberRows); setAttendance(attendanceRows); setFollowUps(followUpRows)
    } catch (e) { setError(userFacingError(e, 'Could not load gym data. Check your connection and try again.')) }
    finally { setLoading(false) }
  }, [gym.id])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!showAdd) return
    requestAnimationFrame(() => memberDialogRef.current?.querySelector<HTMLElement>('input, select')?.focus())
    const onDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdd(false)
        requestAnimationFrame(() => addMemberButtonRef.current?.focus())
      }
      if (event.key === 'Tab') {
        const focusable = memberDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onDialogKeyDown)
    return () => window.removeEventListener('keydown', onDialogKeyDown)
  }, [showAdd])

  const filteredMembers = useMemo(() => members.filter(m => (m.full_name + ' ' + m.phone).toLowerCase().includes(query.toLowerCase())), [members, query])
  const today = indiaDateKey(new Date())
  const renewalWindowEnd = indiaDateKey(new Date(Date.now() + 7 * 86400000))
  const visitsToday = attendance.filter(a => indiaDateKey(new Date(a.checked_in_at)) === today)
  const active = members.filter(m => m.status === 'active')
  const expiring = members.filter(m => m.membership_expires_on && m.membership_expires_on >= today && m.membership_expires_on <= renewalWindowEnd)
  const inactiveFollowUps = followUps.filter(f => f.kind === 'inactive' && f.status !== 'resolved')
  const openFollowUps = followUps.filter(f => f.status !== 'resolved')

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await createMember(gym.id, { fullName: form.name, phone: form.phone, email: form.email, planName: form.plan, monthlyFee: Number(form.fee), membershipExpiresOn: form.expiry || undefined })
      setForm({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' }); setShowAdd(false)
      requestAnimationFrame(() => addMemberButtonRef.current?.focus())
      setNotice('Member saved to your gym workspace.'); await refresh()
    } catch (e) { setError(userFacingError(e, 'Could not save member. Check the details and try again.')) }
    finally { setSaving(false) }
  }

  async function inviteMember() {
    setCreatingInvite(true); setError(''); setNotice('')
    try {
      const token = await createMemberInvitation(gym.id)
      const link = new URL('/', window.location.origin)
      link.searchParams.set('invite', token)
      const invitationUrl = link.toString()
      try {
        await navigator.clipboard.writeText(invitationUrl)
        setNotice('A single-use member invitation link was copied. Share it privately; it expires in 48 hours.')
      } catch {
        window.prompt('Copy this private member invitation link. It expires in 48 hours:', invitationUrl)
        setNotice('Member invitation created. Share the link privately; it expires in 48 hours.')
      }
    } catch (e) { setError(userFacingError(e, 'Could not create an invitation. Check your permissions and try again.')) }
    finally { setCreatingInvite(false) }
  }

  async function checkIn(member: GymMember) {
    setSaving(true); setError(''); setNotice('')
    try { await recordManualCheckIn(gym.id, member.id); setNotice('Attendance recorded for ' + member.full_name + '.'); await refresh(); setSection('Attendance') }
    catch (e) { setError(userFacingError(e, 'Could not record attendance. Refresh and try again.')) }
    finally { setSaving(false) }
  }

  return <div className="app-shell">
    {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => closeMenu(true)} />}
    <aside ref={sidebarRef} id="workspace-navigation" className={'sidebar ' + (mobileNavOpen ? 'sidebar-open' : '')}>
      <div className="sidebar-top"><button type="button" className="brand-lockup brand-home" aria-label="LiftDesk home, Overview" onClick={() => navigate('Overview')}><LiftDeskMark size={35} className="brand-mark" /><span className="brand-name">Lift<span>Desk</span><small>GYM OPERATIONS</small></span></button><button type="button" className="icon-button mobile-close" aria-label="Close navigation" onClick={() => closeMenu(true)}><X size={18}/></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(gym.name).slice(0,2)}</div><div className="workspace-copy"><b>{gym.name}</b><span>{roleLabel} workspace</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{sections.filter(({name}) => name !== 'Staff' || role === 'owner' || role === 'admin').map(({name, icon: Icon}) => <button type="button" key={name} className={'nav-item ' + (section === name ? 'nav-active' : '')} aria-current={section === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon size={18}/><span>{name}</span>{name === 'Follow-ups' && openFollowUps.length > 0 && <span className="nav-count">{openFollowUps.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-pilot"><div className="pilot-icon"><ShieldIcon/></div><b>Private workspace</b><p>Records are loaded from your gym database.</p><span>LIVE DATABASE</span></div>
      <div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{initials(gym.name || 'Gym')}</div><div className="profile-copy"><b>{gym.name}</b><span>Gym workspace · {roleLabel}</span></div><button className="icon-button" aria-label="Sign out" onClick={() => void requireSupabase().auth.signOut()}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button ref={menuButtonRef} type="button" className="icon-button mobile-menu" aria-label="Open main navigation" aria-controls="workspace-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20}/></button><span className="breadcrumb-muted">{gym.name}</span><span className="breadcrumb-slash">/</span><b>{section}</b></div><div className="topbar-right"><span className="preview-pill live-pill"><span/> Live data</span><span className="topbar-divider"/><span className="today-label"><CalendarDays size={15}/> {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div></header>
      <div className="page-content" ref={pageContentRef}>
        <div className="page-heading"><div><div className="eyebrow">{gym.city ? gym.city.toUpperCase() + ' / ' : ''}{gym.name.toUpperCase()}</div><h1 ref={headingRef} tabIndex={-1}>{section === 'Overview' ? 'Your gym, at a glance.' : section}</h1><p>{section === 'Overview' ? 'A live view of your members, attendance and follow-ups.' : section === 'Members' ? 'Manage the member records stored for this gym.' : section === 'Attendance' ? 'Check-in history recorded for your gym.' : section === 'Follow-ups' ? 'Review open reminders and membership attention items.' : section === 'Staff' ? 'Manage employee records and daily staff attendance.' : 'A summary of activity recorded in your workspace.'}</p></div>{section === 'Members' && <div className="heading-actions"><button type="button" className="button-secondary" disabled={creatingInvite || saving} onClick={() => void inviteMember()}>{creatingInvite ? 'Creating link…' : 'Invite member'}</button><button ref={addMemberButtonRef} className="button-primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add member</button></div>}</div>
        {error && <div className="notice-banner error-banner" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}
        {notice && <div className="notice-banner" role="status"><ClipboardCheck size={17}/><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
        {loading ? <div className="surface live-loading"><LoaderCircle className="spin" size={22}/><p>Loading your gym records…</p></div> : <>
          {section === 'Overview' && <>
            <div className="welcome-card" data-motion-reveal><div className="welcome-copy"><div className="welcome-label"><Activity size={14}/> LIVE WORKSPACE</div><h2>Welcome to {gym.name}.</h2><p>These figures come from your gym's database, not sample records.</p><button className="text-action" onClick={() => setSection('Members')}>Manage members <Users size={15}/></button></div></div>
            <div className="section-head"><div><h2>The essentials</h2><p>Current records from your workspace.</p></div></div>
            <div className="metric-grid" data-motion-reveal>
              <Metric label="Active members" value={String(active.length)} detail={members.length + ' total records'} icon={Users}/>
              <Metric label="Visits today" value={String(visitsToday.length)} detail="Recorded check-ins" icon={ClipboardCheck}/>
              <Metric label="Renewals soon" value={String(expiring.length)} detail="Next 7 days" icon={CalendarDays}/>
              <Metric label="Open follow-ups" value={String(openFollowUps.length)} detail={inactiveFollowUps.length + ' inactivity reminders'} icon={Bell}/>
            </div>
            <section className="surface attendance-trend-panel" data-motion-reveal><div className="surface-heading"><div><h2>Attendance activity</h2><p>Daily check-ins across the last 7 days, from your live gym records</p></div><span className="trend-period">LAST 7 DAYS</span></div><AttendanceTrend attendance={attendance}/></section>
            <section className="surface recent-panel" data-motion-reveal><div className="surface-heading"><div><h2>Recent check-ins</h2><p>Latest attendance records from the last 30 days</p></div><button className="subtle-select" onClick={() => setSection('Attendance')}>View attendance ↗</button></div><RecordsTable attendance={attendance.slice(0,8)} members={members}/></section>
          </>}
          {section === 'Members' && <section className="surface directory-panel" data-motion-reveal><div className="directory-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search members"/></div><div className="directory-filters"><span>{filteredMembers.length} records</span></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>STATUS</th><th>EXPIRES</th><th>MONTHLY FEE</th><th>ACTION</th></tr></thead><tbody>{filteredMembers.map(m => { const phone = telHref(m.phone); return <tr key={m.id}><td><b>{m.full_name}</b><br/>{phone ? <a href={phone}>{m.phone}</a> : <small>{m.phone}</small>}</td><td>{m.plan_name}</td><td><Status status={m.status}/></td><td>{dateLabel(m.membership_expires_on)}</td><td>{money(Number(m.monthly_fee))}</td><td><button type="button" className="button-small" disabled={saving || m.status !== 'active' || visitsToday.some(v => v.member_id === m.id)} onClick={() => void checkIn(m)}>{visitsToday.some(v => v.member_id === m.id) ? 'Checked in today' : 'Manual check-in'}</button></td></tr> })}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state">No member records found.</div>}</div></section>}
          {section === 'Coaching' && <CoachingWorkspace gym={gym} user={user} members={members} attendance={attendance}/>}
          {section === 'Attendance' && <div className="page-stack" data-motion-reveal><section className="surface manual-attendance-panel"><div className="manual-attendance-mark"><ClipboardCheck size={19}/></div><div className="manual-attendance-copy"><h2>Trainer-recorded check-ins</h2><p>Member self-check-in by QR and WhatsApp code is turned off. A trainer should open Members, find the person, and select <b>Manual check-in</b>. LiftDesk checks the member’s gym, active status and membership expiry before saving attendance.</p></div><button type="button" className="button-primary" onClick={() => setSection('Members')}><Users size={16}/>Open members</button></section><section className="surface directory-panel"><div className="surface-heading attendance-history-heading"><div><h2>Attendance history</h2><p>Latest 30-day records</p></div><span>{attendance.length} check-ins</span></div><RecordsTable attendance={attendance} members={members}/></section></div>}
          {section === 'Follow-ups' && <section className="surface directory-panel" data-motion-reveal><div className="surface-heading"><div><h2>Follow-up queue</h2><p>Reminders currently stored for this gym</p></div><span>{openFollowUps.length} open</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER ID</th><th>TYPE</th><th>DUE DATE</th><th>STATUS</th><th>NOTE</th></tr></thead><tbody>{followUps.map(f => <tr key={f.id}><td>{members.find(m => m.id === f.member_id)?.full_name || 'Member'}</td><td>{f.kind}</td><td>{dateLabel(f.due_on)}</td><td>{f.status}</td><td>{f.note || '—'}</td></tr>)}</tbody></table>{followUps.length === 0 && <div className="empty-state" role="status">No follow-ups yet</div>}</div></section>}
          {section === 'Staff' && (role === 'owner' || role === 'admin') && <StaffWorkspace gymId={gym.id} role={role} />}
          {section === 'Reports' && <div className="page-stack" data-motion-reveal><section className="surface report-surface"><h2>Workspace summary</h2><p>All figures are calculated from records accessible to this gym account.</p><div className="metric-grid metric-grid-two"><Metric label="Total members" value={String(members.length)} detail="All statuses" icon={Users}/><Metric label="Check-ins (30 days)" value={String(attendance.length)} detail="Attendance rows" icon={ClipboardCheck}/><Metric label="Active memberships" value={String(active.length)} detail="Status marked active" icon={Activity}/><Metric label="Open follow-ups" value={String(openFollowUps.length)} detail="Not resolved" icon={Bell}/></div></section></div>}
        </>}
        <footer className="page-footer"><span><button type="button" className="footer-home" onClick={() => navigate('Overview')} aria-label="LiftDesk home, Overview"><LiftDeskLogo compact /></button> · {gym.name} · © {new Date().getFullYear()}</span><span>Private gym workspace · {gym.name}</span></footer>
      </div>
    </main>
    {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) } }}><section ref={memberDialogRef} className="member-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><div className="modal-header"><div><p className="auth-eyebrow">MEMBER MANAGEMENT</p><h2 id="add-member-title">Add a member</h2></div><button type="button" className="icon-button" onClick={() => { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }} aria-label="Close"><X size={18}/></button></div><form onSubmit={addMember}><label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><div className="form-two"><label>Phone<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})}/></label><label>Email (optional)<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label></div><div className="form-two"><label>Plan<input required value={form.plan} onChange={e => setForm({...form,plan:e.target.value})}/></label><label>Monthly fee (₹)<input required type="number" min="0" step="1" value={form.fee} onChange={e => setForm({...form,fee:e.target.value})}/></label></div><label>Membership expiry (optional)<input type="date" value={form.expiry} onChange={e => setForm({...form,expiry:e.target.value})}/></label><p className="modal-note"><Activity size={15}/> The member is saved to this gym's database and protected by Supabase access policies.</p>{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save member'}</button></div></form></section></div>}
  </div>
}

function AttendanceTrend({attendance}:{attendance:AttendanceRecord[]}) {
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(); date.setHours(12,0,0,0); date.setDate(date.getDate()-(6-index))
    const key=indiaDateKey(date)
    return {key,label:new Intl.DateTimeFormat('en-IN',{weekday:'short'}).format(date),count:attendance.filter(row=>indiaDateKey(new Date(row.checked_in_at))===key).length}
  })
  const maximum=Math.max(1,...days.map(day=>day.count))
  return <div className="attendance-trend" role="img" aria-label={'Attendance over the last seven days: '+days.map(day=>day.label+' '+day.count).join(', ')}>
    {days.map(day=><div className="trend-day" key={day.key}><div className="trend-bar-track"><div className="trend-bar" style={{height:Math.max(day.count?8:3,(day.count/maximum)*100)+'%'}} title={day.count+' check-ins'}/></div><b>{day.count}</b><span>{day.label}</span></div>)}
  </div>
}

function ShieldIcon() { return <Activity size={16}/> }
function Status({status}: {status: GymMember['status']}) { const label = status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Inactive'; return <span className={'status status-' + (status === 'active' ? 'active' : status === 'paused' ? 'expiring' : 'inactive')}><i/>{label}</span> }
function Metric({label,value,detail,icon:Icon}: {label:string;value:string;detail:string;icon:typeof Users}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span>{detail}</span></div></div> }
function RecordsTable({attendance,members}: {attendance:AttendanceRecord[];members:GymMember[]}) { return <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>CHECK-IN</th><th>METHOD</th></tr></thead><tbody>{attendance.map(a => { const member = members.find(m => m.id === a.member_id); return <tr key={a.id}><td><b>{member?.full_name || 'Member'}</b></td><td>{timeLabel(a.checked_in_at)}</td><td>{a.method === 'qr' ? 'QR scan' : 'Manual'}</td></tr> })}</tbody></table>{attendance.length === 0 && <div className="empty-state">No attendance recorded yet.</div>}</div>}
