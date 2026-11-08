import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, ArrowUpRight, Bell, CalendarDays, CircleHelp, ClipboardCheck, Dumbbell, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus, Search, Settings2, Users, X } from 'lucide-react'
import { createMember, createMemberInvitation, listAttendance, listFollowUps, listMemberFollowUpSummary, listMembers, recordManualCheckIn, updateGymWorkspaceSettings, type AttendanceRecord, type FollowUp, type Gym, type GymMember, type GymRole, type MemberFollowUpSummary } from './lib/gymData'
import { signOutWithPushCleanup } from './lib/pushNotifications'
import { userFacingError } from './lib/userFacingError'
import LiftDeskMark from './LiftDeskMark'
import LiftDeskLogo from './LiftDeskLogo'
import StaffWorkspace from './StaffWorkspace'
import { useScrollMotion } from './lib/useScrollMotion'
import CoachingWorkspace from './CoachingWorkspace'
import FloatingGymChat from './FloatingGymChat'
import GymThemeSelector from './GymThemeSelector'

type Props = { gym: Gym; role: GymRole; user: User }
type Section = 'Overview' | 'Members' | 'Coaching' | 'Attendance' | 'Follow-ups' | 'Reports' | 'Staff' | 'Settings' | 'Help'
type MemberFilter = 'all' | 'active' | 'paused' | 'inactive' | 'expired'
const sections: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: 'Overview', icon: LayoutDashboard }, { name: 'Members', icon: Users },
  { name: 'Coaching', icon: Dumbbell }, { name: 'Attendance', icon: ClipboardCheck }, { name: 'Follow-ups', icon: Bell }, { name: 'Reports', icon: CalendarDays }, { name: 'Staff', icon: Users },
]
const BUSINESS_TIME_ZONE = 'Asia/Kolkata'
const indiaDateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
const dateLabel = (value: string | null) => value ? new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
const daysSinceDate = (value: string) => {
  const toDayNumber = (key: string) => { const [year, month, day] = key.split('-').map(Number); return Math.floor(Date.UTC(year, month - 1, day) / 86400000) }
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : indiaDateKey(new Date(value))
  return Math.max(0, toDayNumber(indiaDateKey(new Date())) - toDayNumber(dateKey))
}
const daysSinceVisit = daysSinceDate
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
  const [workspaceGym, setWorkspaceGym] = useState(gym)
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
  const [followUpMembers, setFollowUpMembers] = useState<MemberFollowUpSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' })
  const [settingsForm, setSettingsForm] = useState({ name: gym.name, city: gym.city ?? '', phone: gym.phone ?? '', theme: gym.theme })
  const [savingSettings, setSavingSettings] = useState(false)

  useScrollMotion(pageContentRef, `${section}:${loading}`)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0)
      const [memberRows, attendanceRows, followUpRows, followUpMemberRows] = await Promise.all([
        listMembers(workspaceGym.id), listAttendance(workspaceGym.id, since.toISOString()), listFollowUps(workspaceGym.id), listMemberFollowUpSummary(workspaceGym.id),
      ])
      setMembers(memberRows); setAttendance(attendanceRows); setFollowUps(followUpRows); setFollowUpMembers(followUpMemberRows)
    } catch (e) { setError(userFacingError(e, 'Could not load gym data. Check your connection and try again.')) }
    finally { setLoading(false) }
  }, [workspaceGym.id])

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

  const today = indiaDateKey(new Date())
  const memberFilterOptions: { id: MemberFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All members', count: members.length },
    { id: 'active', label: 'Active', count: members.filter(m => m.status === 'active').length },
    { id: 'paused', label: 'Paused', count: members.filter(m => m.status === 'paused').length },
    { id: 'inactive', label: 'Inactive', count: members.filter(m => m.status === 'inactive').length },
    { id: 'expired', label: 'Expired', count: members.filter(m => m.membership_expires_on && m.membership_expires_on < today).length },
  ]
  const filteredMembers = useMemo(() => members.filter(m => {
    const matchesSearch = (m.full_name + ' ' + m.phone).toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter = memberFilter === 'all'
      || (memberFilter === 'expired' ? Boolean(m.membership_expires_on && m.membership_expires_on < today) : m.status === memberFilter)
    return matchesSearch && matchesFilter
  }), [members, query, memberFilter, today])
  const filteredFollowUpMembers = useMemo(() => followUpMembers.filter(m => `${m.full_name} ${m.phone}`.toLowerCase().includes(query.trim().toLowerCase())), [followUpMembers, query])
  const renewalWindowEnd = indiaDateKey(new Date(Date.now() + 7 * 86400000))
  const visitsToday = attendance.filter(a => indiaDateKey(new Date(a.checked_in_at)) === today)
  const active = members.filter(m => m.status === 'active')
  const activeMemberships = members.filter(m => m.status === 'active' && (!m.membership_expires_on || m.membership_expires_on >= today))
  const expiring = members.filter(m => m.membership_expires_on && m.membership_expires_on >= today && m.membership_expires_on <= renewalWindowEnd)
  const reportExpiringMemberships = expiring.filter(m => m.status === 'active')
  const reportActiveMemberships = members.filter(m => m.status === 'active' && (!m.membership_expires_on || m.membership_expires_on > renewalWindowEnd))
  const reportInactiveMemberships = members.length - reportActiveMemberships.length - reportExpiringMemberships.length
  const inactiveFollowUps = followUps.filter(f => f.kind === 'inactive' && f.status !== 'resolved')
  const openFollowUps = followUps.filter(f => f.status !== 'resolved')
  const awayMembers = useMemo(() => followUpMembers
    .map(member => ({ member, daysAway: daysSinceDate(member.last_visit_at || member.joined_on), neverVisited: !member.last_visit_at }))
    .filter(item => item.daysAway >= 7)
    .sort((a, b) => b.daysAway - a.daysAway)
    .slice(0, 5), [followUpMembers])
  const awayMemberCount = useMemo(() => followUpMembers.filter(member => daysSinceDate(member.last_visit_at || member.joined_on) >= 7).length, [followUpMembers])

  function openAwayMember(name: string) {
    setQuery(name)
    navigate('Follow-ups')
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    if (!form.email.trim()) {
      setError('Enter the member’s email address.')
      return
    }
    if (form.expiry && form.expiry < today) {
      setError('Membership expiry cannot be earlier than today.')
      return
    }
    setSaving(true)
    try {
      await createMember(workspaceGym.id, { fullName: form.name, phone: form.phone, email: form.email, planName: form.plan, monthlyFee: Number(form.fee), membershipExpiresOn: form.expiry || undefined })
      setForm({ name: '', phone: '', email: '', plan: 'Monthly', fee: '999', expiry: '' }); setShowAdd(false)
      requestAnimationFrame(() => addMemberButtonRef.current?.focus())
      setNotice('Member saved to your gym workspace.'); await refresh()
    } catch (e) { setError(userFacingError(e, 'Could not save member. Check the details and try again.')) }
    finally { setSaving(false) }
  }

  async function inviteMember() {
    setCreatingInvite(true); setError(''); setNotice('')
    try {
      const token = await createMemberInvitation(workspaceGym.id)
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
    try { await recordManualCheckIn(workspaceGym.id, member.id); setNotice('Attendance recorded for ' + member.full_name + '.'); await refresh(); setSection('Attendance') }
    catch (e) { setError(userFacingError(e, 'Could not record attendance. Refresh and try again.')) }
    finally { setSaving(false) }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    if (role !== 'owner' && role !== 'admin') {
      setError('Only this gym’s Owner or Admin can update workspace settings.')
      return
    }
    setSavingSettings(true)
    try {
      const updated = await updateGymWorkspaceSettings(workspaceGym.id, settingsForm)
      setWorkspaceGym(updated)
      setSettingsForm({ name: updated.name, city: updated.city ?? '', phone: updated.phone ?? '', theme: updated.theme })
      setNotice('Gym settings saved.')
    } catch (e) {
      setError(userFacingError(e, 'Could not save gym settings. Check the details and try again.'))
    } finally { setSavingSettings(false) }
  }

  return <div className="gym-theme-boundary app-shell" data-theme={workspaceGym.theme}>
    {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => closeMenu(true)} />}
    <aside ref={sidebarRef} id="workspace-navigation" className={'sidebar ' + (mobileNavOpen ? 'sidebar-open' : '')}>
      <div className="sidebar-top"><button type="button" className="brand-lockup brand-home" aria-label="LiftDesk home, Overview" onClick={() => navigate('Overview')}><LiftDeskMark size={35} className="brand-mark" /><span className="brand-name">Lift<span>Desk</span><small>GYM OPERATIONS</small></span></button><button type="button" className="icon-button mobile-close" aria-label="Close navigation" onClick={() => closeMenu(true)}><X size={18}/></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(workspaceGym.name).slice(0,2)}</div><div className="workspace-copy"><b>{workspaceGym.name}</b><span>{roleLabel} workspace</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{sections.filter(({name}) => name !== 'Staff' || role === 'owner' || role === 'admin').map(({name, icon: Icon}) => <button type="button" key={name} className={'nav-item ' + (section === name ? 'nav-active' : '')} aria-current={section === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon size={18}/><span>{name}</span>{name === 'Follow-ups' && openFollowUps.length > 0 && <span className="nav-count">{openFollowUps.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <nav className="sidebar-utility-nav" aria-label="Settings and help">{(role === 'owner' || role === 'admin') && <button type="button" className={'nav-item ' + (section === 'Settings' ? 'nav-active' : '')} aria-current={section === 'Settings' ? 'page' : undefined} onClick={() => navigate('Settings')}><Settings2 size={18}/><span>Settings</span></button>}<button type="button" className={'nav-item ' + (section === 'Help' ? 'nav-active' : '')} aria-current={section === 'Help' ? 'page' : undefined} onClick={() => navigate('Help')}><CircleHelp size={18}/><span>Help</span></button></nav>
      <div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{initials(workspaceGym.name || 'Gym')}</div><div className="profile-copy"><b>{workspaceGym.name}</b><span>Gym workspace · {roleLabel}</span></div><button className="icon-button" aria-label="Sign out" onClick={() => void signOutWithPushCleanup()}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button ref={menuButtonRef} type="button" className="icon-button mobile-menu" aria-label="Open main navigation" aria-controls="workspace-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20}/></button><span className="breadcrumb-muted">{workspaceGym.name}</span><span className="breadcrumb-slash">/</span><b>{section}</b></div><div className="topbar-right"><span className="preview-pill live-pill"><span/> Live data</span><span className="topbar-divider"/><span className="today-label"><CalendarDays size={15}/> {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div></header>
      <div className="page-content" ref={pageContentRef}>
        <div className="page-heading"><div><div className="eyebrow">{workspaceGym.city ? workspaceGym.city.toUpperCase() + ' / ' : ''}{workspaceGym.name.toUpperCase()}</div><h1 ref={headingRef} tabIndex={-1}>{section === 'Overview' ? 'Your gym, at a glance.' : section}</h1><p>{section === 'Overview' ? 'A live view of your members, attendance and follow-ups.' : section === 'Members' ? 'Manage the member records stored for this gym.' : section === 'Attendance' ? 'Check-in history recorded for your gym.' : section === 'Follow-ups' ? 'Review open reminders and membership attention items.' : section === 'Staff' ? 'Manage employee records and daily staff attendance.' : section === 'Settings' ? 'Update your gym’s workspace details and appearance.' : section === 'Help' ? 'Guides to the tools and workflows available in your gym workspace.' : 'A summary of activity recorded in your workspace.'}</p></div>{section === 'Members' && <div className="heading-actions"><button type="button" className="button-secondary" disabled={creatingInvite || saving} onClick={() => void inviteMember()}>{creatingInvite ? 'Creating link…' : 'Invite member'}</button><button ref={addMemberButtonRef} className="button-primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add member</button></div>}</div>
         {error && <div className="notice-banner error-banner" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}
        {notice && <div className="notice-banner" role="status"><ClipboardCheck size={17}/><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
        {loading ? <div className="surface live-loading"><LoaderCircle className="spin" size={22}/><p>Loading your gym records…</p></div> : <>
          {section === 'Overview' && <>
            <div className="welcome-card" data-motion-reveal><img className="welcome-photo" src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1100&q=82" alt="Modern gym interior with strength-training equipment" loading="lazy" /><div className="welcome-copy"><div className="welcome-label"><Activity size={14}/> LIVE WORKSPACE</div><h2>Welcome to {workspaceGym.name}.</h2><p>These figures come from your gym's database, not sample records.</p><button className="text-action" onClick={() => setSection('Members')}>Manage members <Users size={15}/></button></div></div>
            <div className="section-head"><div><h2>The essentials</h2><p>Current records from your workspace.</p></div></div>
            <div className="metric-grid" data-motion-reveal>
              <Metric label="Active members" value={String(active.length)} detail={members.length + ' total records'} icon={Users}/>
              <Metric label="Visits today" value={String(visitsToday.length)} detail="Recorded check-ins" icon={ClipboardCheck}/>
              <Metric label="Renewals soon" value={String(expiring.length)} detail="Next 7 days" icon={CalendarDays}/>
              <Metric label="Open follow-ups" value={String(openFollowUps.length)} detail={inactiveFollowUps.length + ' inactivity reminders'} icon={Bell}/>
            </div>
            <div className="overview-grid live-overview-grid" data-motion-reveal>
              <section className="surface attendance-panel live-attendance-panel"><div className="surface-heading"><div><h2>Attendance activity</h2><p>Daily check-ins compared with the previous 7 days</p></div><button type="button" className="subtle-select" onClick={() => navigate('Attendance')}>View attendance <ArrowUpRight size={14}/></button></div><div className="chart-legend"><span><i className="live-legend-current"/>Check-ins</span><span><i className="live-legend-previous"/>Previous week</span></div><AttendanceTrend attendance={attendance}/></section>
              <section className="surface attention-panel live-away-panel"><div className="surface-heading"><div><h2>Members away</h2><p>No visit in 7 or more days</p></div><span className="count-bubble">{awayMemberCount}</span></div>{awayMembers.length > 0 ? awayMembers.map(({ member, daysAway, neverVisited }) => <button type="button" className="live-away-row" key={member.id} onClick={() => openAwayMember(member.full_name)}><span className="live-away-avatar">{initials(member.full_name)}</span><span className="live-away-copy"><b>{member.full_name}</b><small>{neverVisited ? `No visit recorded · joined ${daysAway} ${daysAway === 1 ? 'day' : 'days'} ago` : `Last visit ${daysAway} ${daysAway === 1 ? 'day' : 'days'} ago`}</small></span><span className="live-away-badge">Away</span><ArrowUpRight size={15} className="live-away-arrow"/></button>) : <div className="live-away-empty">No members have been away for 7 or more days.</div>}<button type="button" className="full-width-link" onClick={() => navigate('Follow-ups')}>Open follow-up queue <ArrowUpRight size={15}/></button></section>
            </div>
            <section className="surface recent-panel" data-motion-reveal><div className="surface-heading"><div><h2>Recent check-ins</h2><p>Latest attendance records from the last 30 days</p></div><button className="subtle-select" onClick={() => setSection('Attendance')}>View attendance ↗</button></div><RecordsTable attendance={attendance.slice(0,8)} members={members}/></section>
          </>}
          {section === 'Members' && <section className="surface directory-panel" data-motion-reveal>
            <nav className="member-filter-nav" aria-label="Filter members by membership status">
              {memberFilterOptions.map(option => <button key={option.id} type="button" aria-label={`${option.label}, ${option.count} ${option.count === 1 ? 'member' : 'members'}`} aria-pressed={memberFilter === option.id} onClick={() => setMemberFilter(option.id)}>
                <span>{option.label}</span><span className="member-filter-count">{option.count}</span>
              </button>)}
            </nav>
            <div className="directory-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search members"/></div><div className="directory-filters"><span>{filteredMembers.length} of {members.length} members</span></div></div>
            <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>STATUS</th><th>EXPIRES</th><th>MONTHLY FEE</th><th>ACTION</th></tr></thead><tbody>{filteredMembers.map(m => { const phone = telHref(m.phone); return <tr key={m.id}><td><b>{m.full_name}</b><br/>{phone ? <a href={phone}>{m.phone}</a> : <small>{m.phone}</small>}</td><td>{m.plan_name}</td><td><Status status={m.status}/></td><td>{dateLabel(m.membership_expires_on)}</td><td>{money(Number(m.monthly_fee))}</td><td><button type="button" className="button-small" disabled={saving || m.status !== 'active' || visitsToday.some(v => v.member_id === m.id)} onClick={() => void checkIn(m)}>{visitsToday.some(v => v.member_id === m.id) ? 'Checked in today' : 'Manual check-in'}</button></td></tr> })}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state">No members match this search and filter.</div>}</div>
          </section>}
          {section === 'Coaching' && <CoachingWorkspace gym={workspaceGym} user={user} members={members} attendance={attendance}/>}
          {section === 'Attendance' && <div className="page-stack" data-motion-reveal><div className="metric-grid metric-grid-two attendance-summary-grid"><Metric label="Today's visits" value={String(visitsToday.length)} detail="Recorded check-ins today" icon={ClipboardCheck}/><Metric label="Active memberships" value={String(activeMemberships.length)} detail="Active and not expired" icon={Users}/></div><section className="surface manual-attendance-panel"><div className="manual-attendance-mark"><ClipboardCheck size={19}/></div><div className="manual-attendance-copy"><h2>Trainer-recorded check-ins</h2><p>Member self-check-in by QR and WhatsApp code is turned off. A trainer should open Members, find the person, and select <b>Manual check-in</b>. LiftDesk checks the member’s gym, active status and membership expiry before saving attendance.</p></div><button type="button" className="button-primary" onClick={() => setSection('Members')}><Users size={16}/>Open members</button></section><section className="surface directory-panel"><div className="surface-heading attendance-history-heading"><div><h2>Attendance history</h2><p>Latest 30-day records</p></div><span>{attendance.length} check-ins</span></div><RecordsTable attendance={attendance} members={members}/></section></div>}
          {section === 'Follow-ups' && <section className="surface directory-panel" data-motion-reveal><div className="surface-heading"><div><h2>Member attendance tracking</h2><p>Track every gym member by their most recent visit</p></div><span>{filteredFollowUpMembers.length} members</span></div><div className="directory-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search follow-up members by name or phone"/></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>LAST VISIT</th><th>DAYS AWAY</th></tr></thead><tbody>{filteredFollowUpMembers.map(m => { const days = m.last_visit_at ? daysSinceVisit(m.last_visit_at) : null; const phone = telHref(m.phone); return <tr key={m.id}><td><b>{m.full_name}</b><br/>{phone ? <a href={phone}>{m.phone}</a> : <small>{m.phone}</small>}</td><td>{m.last_visit_at ? dateLabel(m.last_visit_at) : 'No visit recorded'}</td><td>{days === null ? 'Never visited' : days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`}</td></tr> })}</tbody></table>{filteredFollowUpMembers.length === 0 && <div className="empty-state" role="status">{followUpMembers.length === 0 ? 'No members in this gym yet.' : 'No members match this search.'}</div>}</div></section>}
          {section === 'Staff' && (role === 'owner' || role === 'admin') && <StaffWorkspace gymId={workspaceGym.id} role={role} />}
          {section === 'Reports' && <div className="page-stack" data-motion-reveal><div className="metric-grid"><Metric label="Total members" value={String(members.length)} detail="Records in this gym" icon={Users}/><Metric label="Active memberships" value={String(reportActiveMemberships.length)} detail="Active, not expiring this week" icon={Activity}/><Metric label="Attendance rows" value={String(attendance.length)} detail="Check-ins in the last 30 days" icon={ClipboardCheck}/><Metric label="Away 7+ days" value={String(awayMemberCount)} detail="Based on latest member visit" icon={Bell}/></div><section className="surface report-surface"><div className="surface-heading"><div><h2>Workspace summary</h2><p>Membership status breakdown for this gym.</p></div><span className="period-label">{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span></div><div className="report-bars"><ReportBar label="Active membership" count={reportActiveMemberships.length} total={members.length} color="green"/><ReportBar label="Expiring membership" count={reportExpiringMemberships.length} total={members.length} color="amber"/><ReportBar label="Inactive membership" count={reportInactiveMemberships} total={members.length} color="grey"/></div><div className="report-note"><Activity size={16}/><span>Expiring means the membership ends within 7 days. Inactive includes paused, inactive, and expired memberships. Attendance rows cover the last 30 days.</span></div></section></div>}
          {section === 'Reports' && <div className="page-stack" data-motion-reveal><div className="metric-grid"><Metric label="Total members" value={String(members.length)} detail="Records in this gym" icon={Users}/><Metric label="Active memberships" value={String(reportActiveMemberships.length)} detail="Active, not expiring this week" icon={Activity}/><Metric label="Attendance rows" value={String(attendance.length)} detail="Check-ins in the last 30 days" icon={ClipboardCheck}/><Metric label="Away 7+ days" value={String(awayMemberCount)} detail="Based on latest member visit" icon={Bell}/></div><section className="surface report-surface"><div className="surface-heading"><div><h2>Workspace summary</h2><p>Membership status breakdown for this gym.</p></div><span className="period-label">{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span></div><div className="report-bars"><ReportBar label="Active membership" count={reportActiveMemberships.length} total={members.length} color="green"/><ReportBar label="Expiring membership" count={reportExpiringMemberships.length} total={members.length} color="amber"/><ReportBar label="Inactive membership" count={reportInactiveMemberships} total={members.length} color="grey"/></div><div className="report-note"><Activity size={16}/><span>Expiring means the membership ends within 7 days. Inactive includes paused, inactive, and expired memberships. Attendance rows cover the last 30 days.</span></div></section></div>}
          {section === 'Settings' && (role === 'owner' || role === 'admin') && <form className="surface gym-settings-panel" onSubmit={saveSettings} data-motion-reveal><div className="settings-panel-heading"><div><h2>Gym workspace</h2><p>These details appear in your workspace and team tools.</p></div><span className="settings-role-badge">{roleLabel} access</span></div><div className="gym-settings-fields"><label>Gym name<input required minLength={2} maxLength={120} value={settingsForm.name} onChange={event => setSettingsForm({ ...settingsForm, name: event.target.value })}/></label><label>City<input required minLength={2} maxLength={100} value={settingsForm.city} onChange={event => setSettingsForm({ ...settingsForm, city: event.target.value })}/></label><label>Gym phone <span className="settings-optional">Optional</span><input type="tel" minLength={5} maxLength={30} value={settingsForm.phone} onChange={event => setSettingsForm({ ...settingsForm, phone: event.target.value })} placeholder="Gym contact number"/></label></div><GymThemeSelector value={settingsForm.theme} onChange={theme => setSettingsForm({ ...settingsForm, theme })}/><div className="settings-panel-footer"><p>Saving updates only this gym. Owners and Admins can edit these workspace settings.</p><button type="submit" className="button-primary" disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</button></div></form>}
          {section === 'Help' && <div className="help-center" data-motion-reveal><section className="surface help-intro"><div><span className="help-kicker">LIFTDESK HELP</span><h2>Find your way around the workspace.</h2><p>These guides describe what the current LiftDesk tools do. Your access depends on your gym role.</p></div></section><div className="help-topic-grid"><HelpTopic title="Members" description="Add members, update their contact and membership details, and record a manual check-in from the member list." action="Open Members" onClick={() => navigate('Members')}/><HelpTopic title="Attendance" description="Check today’s visits and recent records. Staff record a check-in from Members after confirming the correct person." action="Open Attendance" onClick={() => navigate('Attendance')}/><HelpTopic title="Members away" description="Follow-ups tracks each member’s latest visit and how many days they have been away. It does not automatically message members." action="Open Follow-ups" onClick={() => navigate('Follow-ups')}/><HelpTopic title="Coaching" description="Trainers can review members in this gym and manage their diet plans, workout plans, progress, and coaching notes." action="Open Coaching" onClick={() => navigate('Coaching')}/><HelpTopic title="Reports" description="See gym-scoped membership counts, attendance records from the last 30 days, and members away for at least 7 days." action="Open Reports" onClick={() => navigate('Reports')}/>{(role === 'owner' || role === 'admin') && <HelpTopic title="Staff access" description="Owners and Admins manage staff records and invitations. Staff use the invited email account and are linked to this gym and assigned role." action="Open Staff" onClick={() => navigate('Staff')}/>}<HelpTopic title="Gym chat" description={role === 'owner' || role === 'admin' ? 'Owners and Admins can send and pin messages. Trainers and members can read gym messages but cannot send them.' : 'You can read gym messages here. Only Owners and Admins can send or pin messages.'} action="Open chat" onClick={() => document.querySelector<HTMLButtonElement>('.gym-chat-floating-launcher')?.click()}/></div></div>}
        </>}
        <footer className="page-footer"><span><button type="button" className="footer-home" onClick={() => navigate('Overview')} aria-label="LiftDesk home, Overview"><LiftDeskLogo compact /></button> · {workspaceGym.name} · © {new Date().getFullYear()}</span><span>Private gym workspace · {workspaceGym.name}</span></footer>
      </div>
    </main>
    <FloatingGymChat gymId={workspaceGym.id} userId={user.id} gymName={workspaceGym.name} canSend={role === 'owner' || role === 'admin'} canManagePins={role === 'owner' || role === 'admin'} />
    {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) } }}><section ref={memberDialogRef} className="member-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><div className="modal-header"><div><p className="auth-eyebrow">MEMBER MANAGEMENT</p><h2 id="add-member-title">Add a member</h2></div><button type="button" className="icon-button" onClick={() => { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }} aria-label="Close"><X size={18}/></button></div><form onSubmit={addMember}><label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><div className="form-two"><label>Phone<input required type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})}/></label><label>Email <span className="required-label">Required</span><input type="email" autoComplete="email" required maxLength={320} value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="member@example.com"/></label></div><div className="form-two"><label>Plan<input required value={form.plan} onChange={e => setForm({...form,plan:e.target.value})}/></label><label>Monthly fee (₹)<input required type="number" min="0" step="1" value={form.fee} onChange={e => setForm({...form,fee:e.target.value})}/></label></div><label>Membership expiry (optional)<input type="date" min={today} value={form.expiry} onChange={e => setForm({...form,expiry:e.target.value})}/></label><p className="modal-note"><Activity size={15}/> The member is saved to this gym's database and protected by Supabase access policies.</p>{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setShowAdd(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save member'}</button></div></form></section></div>}
  </div>
}

function AttendanceTrend({attendance}:{attendance:AttendanceRecord[]}) {
  const makeDay = (daysAgo: number) => {
    const date = new Date(`${indiaDateKey(new Date())}T12:00:00+05:30`); date.setUTCDate(date.getUTCDate() - daysAgo)
    const key = indiaDateKey(date)
    return { key, label: new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: BUSINESS_TIME_ZONE }).format(date), count: attendance.filter(row => indiaDateKey(new Date(row.checked_in_at)) === key).length }
  }
  const current = Array.from({ length: 7 }, (_, index) => makeDay(6 - index))
  const previous = Array.from({ length: 7 }, (_, index) => makeDay(13 - index))
  const ceiling = Math.max(4, Math.ceil(Math.max(...current.map(day => day.count), ...previous.map(day => day.count)) / 4) * 4)
  const y = (count: number) => 178 - (count / ceiling) * 160
  const x = (index: number) => index * (560 / 6)
  const linePoints = (days: typeof current) => days.map((day, index) => `${x(index)},${y(day.count)}`).join(' ')
  const areaPath = `${current.map((day, index) => `${index ? 'L' : 'M'}${x(index)} ${y(day.count)}`).join(' ')} L560 190 L0 190 Z`
  const labels = [...new Set([ceiling, Math.round(ceiling * .75), Math.round(ceiling * .5), Math.round(ceiling * .25), 0])]
  const description = current.map(day => `${day.label} ${day.count}`).join(', ')
  return <div className="chart-wrap live-attendance-chart" role="img" aria-label={`Check-ins for the last seven days: ${description}. Dashed line shows the previous week.`}><div className="chart-y-labels" aria-hidden="true">{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div><div className="chart-plot"><div className="chart-gridlines" aria-hidden="true">{labels.map((_, index) => <i key={index}/>)}</div><svg viewBox="0 0 560 190" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="liveAttendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--theme-accent, #b7a17a)" stopOpacity=".38"/><stop offset="100%" stopColor="var(--theme-accent, #b7a17a)" stopOpacity="0"/></linearGradient></defs><path d={areaPath} fill="url(#liveAttendanceFill)"/><polyline points={linePoints(previous)} fill="none" stroke="#d4d0c7" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><polyline points={linePoints(current)} fill="none" stroke="#343b36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>{current.map((day, index) => <circle key={day.key} cx={x(index)} cy={y(day.count)} r="4" fill="var(--theme-surface, #fff)" stroke="#343b36" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>)}</svg><div className="chart-x-labels" aria-hidden="true">{current.map(day => <span key={day.key}>{day.label}</span>)}</div></div></div>
}

function Status({status}: {status: GymMember['status']}) { const label = status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Inactive'; return <span className={'status status-' + (status === 'active' ? 'active' : status === 'paused' ? 'expiring' : 'inactive')}><i/>{label}</span> }
function Metric({label,value,detail,icon:Icon}: {label:string;value:string;detail:string;icon:typeof Users}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span>{detail}</span></div></div> }
function RecordsTable({attendance,members}: {attendance:AttendanceRecord[];members:GymMember[]}) { return <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>CHECK-IN</th><th>METHOD</th></tr></thead><tbody>{attendance.map(a => { const member = members.find(m => m.id === a.member_id); return <tr key={a.id}><td><b>{member?.full_name || 'Member'}</b></td><td>{timeLabel(a.checked_in_at)}</td><td>{a.method === 'qr' ? 'QR scan' : 'Manual'}</td></tr> })}</tbody></table>{attendance.length === 0 && <div className="empty-state">No attendance recorded yet.</div>}</div>}

function ReportBar({label,count,total,color}:{label:string;count:number;total:number;color:'green'|'amber'|'grey'}) {
  const percentage = total > 0 ? Math.min(100, Math.round(count / total * 100)) : 0
  return <div className="report-bar-row"><div><span>{label}</span><b>{count}</b></div><div className="report-bar-track"><span className={`report-bar-fill fill-${color}`} style={{width: `${percentage}%`}}/></div></div>
}

function HelpTopic({title,description,action,onClick}:{title:string;description:string;action:string;onClick:()=>void}) {
  return <article className="surface help-topic"><div><h3>{title}</h3><p>{description}</p></div><button type="button" className="subtle-select" onClick={onClick}>{action}<ArrowUpRight size={14}/></button></article>
}
