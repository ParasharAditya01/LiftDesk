import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowUpRight, Bell, CalendarDays,
  Download, Dumbbell, FileBarChart, LayoutDashboard, Menu,
  Plus, ClipboardCheck, Search, ShieldCheck, Sparkles, Users, X, Zap,
  LockKeyhole, MessageSquare, Send, Pin,
} from 'lucide-react'
import LiftDeskMark from './LiftDeskMark'
import LiftDeskLogo from './LiftDeskLogo'
import { useScrollMotion } from './lib/useScrollMotion'

type DemoRole = 'Owner' | 'Admin' | 'Trainer' | 'Member'
type Section = 'Overview' | 'Members' | 'Coaching' | 'Attendance' | 'Follow-ups' | 'Reports' | 'Staff' | 'Member overview' | 'Membership' | 'Diet plan' | 'Workout plan' | 'Progress'
type MemberStatus = 'Active' | 'Expiring' | 'Inactive'
type Member = { id: number; name: string; initials: string; phone: string; plan: string; status: MemberStatus; expires: string; fee: number; lastVisit: string }

const initialMembers: Member[] = [
  { id: 1, name: 'Aarav Sharma', initials: 'AS', phone: '+91 98765 43210', plan: 'Monthly', status: 'Active', expires: '18 Nov 2026', fee: 999, lastVisit: 'Today, 07:42 AM' },
  { id: 2, name: 'Meera Joshi', initials: 'MJ', phone: '+91 98220 14567', plan: 'Quarterly', status: 'Expiring', expires: '10 Nov 2026', fee: 899, lastVisit: 'Yesterday, 06:18 PM' },
  { id: 3, name: 'Rohan Patil', initials: 'RP', phone: '+91 97654 21098', plan: 'Monthly', status: 'Inactive', expires: 'Expired 4 Nov 2026', fee: 999, lastVisit: '12 days ago' },
  { id: 4, name: 'Isha Kulkarni', initials: 'IK', phone: '+91 98901 33221', plan: 'Annual', status: 'Active', expires: '16 Mar 2027', fee: 799, lastVisit: 'Today, 08:06 AM' },
  { id: 5, name: 'Kabir Deshmukh', initials: 'KD', phone: '+91 93071 55881', plan: 'Quarterly', status: 'Active', expires: '12 Dec 2026', fee: 899, lastVisit: 'Today, 06:51 AM' },
  { id: 6, name: 'Ananya Shah', initials: 'AS', phone: '+91 97633 70419', plan: 'Monthly', status: 'Expiring', expires: '12 Nov 2026', fee: 999, lastVisit: '3 days ago' },
]

const staffNavItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Members', icon: Users },
  { label: 'Coaching', icon: Dumbbell },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Follow-ups', icon: Bell },
  { label: 'Reports', icon: FileBarChart },
  { label: 'Staff', icon: Users },
]
const memberNavItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Member overview', icon: LayoutDashboard },
  { label: 'Membership', icon: ShieldCheck },
  { label: 'Diet plan', icon: Activity },
  { label: 'Workout plan', icon: Dumbbell },
  { label: 'Progress', icon: FileBarChart },
]

type PreviewMessage = { id: number; author: string; role: string; body: string; time: string; pinned?: boolean }
const sampleMessages: PreviewMessage[] = [
  { id: 1, author: 'Gym owner', role: 'Owner', body: 'Quick reminder: please bring your towel and water bottle for tomorrow’s session.', time: '9:15 AM', pinned: true },
  { id: 2, author: 'Aarav Sharma', role: 'Member', body: 'Got it, thank you!', time: '9:28 AM' },
]

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function Brand() {
  return <div className="brand-lockup"><LiftDeskMark size={52} /></div>
}

function Status({ status }: { status: MemberStatus }) {
  return <span className={'status status-' + status.toLowerCase()}><i />{status}</span>
}

function App() {
  const [role, setRole] = useState<DemoRole>('Owner')
  const [section, setSection] = useState<Section>('Overview')
  const [members, setMembers] = useState(initialMembers)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const pageContentRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const addMemberButtonRef = useRef<HTMLButtonElement>(null)
  const memberDialogRef = useRef<HTMLFormElement>(null)
  const [memberStatusFilter, setMemberStatusFilter] = useState<'All' | MemberStatus>('All')
  const [notice, setNotice] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatMessages, setChatMessages] = useState(sampleMessages)
  const [form, setForm] = useState({ name: '', phone: '', plan: 'Monthly', fee: '999', expiry: '' })
  const filtered = useMemo(() => members.filter(m => (m.name + ' ' + m.phone).toLowerCase().includes(query.toLowerCase()) && (memberStatusFilter === 'All' || m.status === memberStatusFilter)), [members, query, memberStatusFilter])
  const activeCount = members.filter(m => m.status === 'Active').length
  const expiringCount = members.filter(m => m.status === 'Expiring').length
  const inactiveCount = members.filter(m => m.status === 'Inactive').length
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  useScrollMotion(pageContentRef, section)

  useEffect(() => {
    if (mobileNav) requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>('.mobile-close')?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileNav) {
        setMobileNav(false)
        requestAnimationFrame(() => menuButtonRef.current?.focus())
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSection('Members')
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
      if (mobileNav && event.key === 'Tab') {
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
  }, [mobileNav])

  useEffect(() => {
    if (!modalOpen) return
    requestAnimationFrame(() => memberDialogRef.current?.querySelector<HTMLElement>('input, select')?.focus())
    const onDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalOpen(false)
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
  }, [modalOpen])

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.expiry && form.expiry < today) {
      setNotice('Membership expiry cannot be earlier than today.')
      return
    }
    const name = form.name.trim()
    if (!name || !form.phone.trim()) return
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
    setMembers(current => [{ id: Date.now(), name, initials, phone: form.phone.trim(), plan: form.plan, status: 'Active', expires: form.expiry || 'Not set', fee: Number(form.fee) || 0, lastVisit: 'Not checked in' }, ...current])
    setForm({ name: '', phone: '', plan: 'Monthly', fee: '999', expiry: '' })
    setModalOpen(false)
    requestAnimationFrame(() => addMemberButtonRef.current?.focus())
    setNotice('Preview member added locally. This has not been saved to a database.')
  }

  function chooseSection(next: Section) {
    setSection(next)
    setMobileNav(false)
    setNotice('')
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  function changeRole(next: DemoRole) {
    setRole(next)
    setSection(next === 'Member' ? 'Member overview' : 'Overview')
    setMobileNav(false)
    setNotice('')
    setChatOpen(false)
  }

  function sendPreviewMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = chatDraft.trim()
    if (!body || role === 'Trainer' || role === 'Member') return
    setChatMessages(messages => [...messages, { id: Date.now(), author: 'You', role, body, time: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) }])
    setChatDraft('')
  }

  function togglePreviewPin(id: number) {
    if (role !== 'Owner' && role !== 'Admin') return
    setChatMessages(messages => messages.map(message => message.id === id ? { ...message, pinned: !message.pinned } : message))
  }

  function viewMember(name: string) {
    setQuery(name)
    setMemberStatusFilter('All')
    chooseSection('Members')
  }

  function downloadReport() {
    const rows = [['Name', 'Phone', 'Plan', 'Status', 'Membership expiry', 'Monthly fee'], ...members.map(member => [member.name, member.phone, member.plan, member.status, member.expires, String(member.fee)])]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'liftdesk-preview-members.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Preview report downloaded. It contains sample data only.')
  }

  if (role === 'Member') return <MemberPortalPreview section={section} onSection={chooseSection} onRoleChange={changeRole}>
    <PreviewChat role={role} open={chatOpen} onToggle={() => setChatOpen(open => !open)} messages={chatMessages} draft={chatDraft} onDraft={setChatDraft} onSend={sendPreviewMessage} onTogglePin={togglePreviewPin}/>
  </MemberPortalPreview>

  const visibleNavItems = staffNavItems.filter(item => item.label !== 'Staff' || role === 'Owner' || role === 'Admin')
  const todayLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

  return (
    <div className="app-shell">
      <aside ref={sidebarRef} id="preview-navigation" className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
        <div className="sidebar-top"><button type="button" className="brand-home" aria-label="LiftDesk home, Overview" onClick={() => chooseSection('Overview')}><Brand /></button><button className="icon-button mobile-close" onClick={() => { setMobileNav(false); requestAnimationFrame(() => menuButtonRef.current?.focus()) }} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="workspace-avatar">LD</div><div className="workspace-copy"><b>LiftDesk Demo Gym</b><span>{role} workspace · sample data</span></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {visibleNavItems.map(({ label, icon: Icon }) => <button type="button" key={label} className={'nav-item ' + (section === label ? 'nav-active' : '')} aria-current={section === label ? 'page' : undefined} onClick={() => chooseSection(label)}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{label === 'Follow-ups' && <span className="nav-count">1</span>}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-pilot"><div className="pilot-icon"><Sparkles size={16} /></div><b>Sample workspace</b><p>Explore the current LiftDesk workflow with example records.</p><span>NOT LIVE GYM DATA</span></div>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="profile-avatar">{role.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><b>Demo {role.toLowerCase()}</b><span>Preview account · no sign-in</span></div></div>
        </div>
      </aside>
      {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation overlay" onClick={() => { setMobileNav(false); requestAnimationFrame(() => menuButtonRef.current?.focus()) }} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button ref={menuButtonRef} type="button" className="icon-button mobile-menu" aria-label="Open main navigation" aria-controls="preview-navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={20} /></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span><b>{section}</b></div>
          <div className="topbar-right"><label className="preview-role-switch"><span>View as</span><select aria-label="Choose preview role" value={role} onChange={event => changeRole(event.target.value as DemoRole)}><option>Owner</option><option>Admin</option><option>Trainer</option><option>Member</option></select></label><span className="preview-pill"><span /> Preview mode</span><span className="topbar-divider" /><span className="today-label"><CalendarDays size={15} /> {todayLabel}</span><button className="icon-button notification-button" aria-label="Open follow-ups" onClick={() => chooseSection('Follow-ups')}><Bell size={18} /><i /></button></div>
        </header>
        <div className="page-content" ref={pageContentRef}>
          <div className="page-heading">
            <div><div className="eyebrow">LIFTDESK DEMO GYM  /  {role.toUpperCase()} WORKSPACE</div><h1 ref={headingRef} tabIndex={-1}>{section === 'Overview' ? 'Your gym, at a glance.' : section}</h1><p>{section === 'Overview' ? 'A live-style look at members, attendance, coaching and follow-ups.' : section === 'Members' ? 'Example member records and membership details.' : section === 'Coaching' ? 'Member-specific diet and workout plans, progress and notes.' : section === 'Attendance' ? 'Staff-recorded check-ins and visit history.' : section === 'Follow-ups' ? 'Attendance tracking across the member list.' : section === 'Staff' ? 'Gym staff directory and attendance overview.' : 'A sample summary generated from demo records.'}</p></div>
            <div className="heading-actions">{section === 'Members' && (role === 'Owner' || role === 'Admin') && <button ref={addMemberButtonRef} type="button" className="button-primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add member</button>}{section === 'Reports' && <button type="button" className="button-secondary" onClick={downloadReport}><Download size={16} /> Export sample CSV</button>}</div>
          </div>
          {notice && <div className="notice-banner" role="status"><ShieldCheck size={17} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button></div>}
          <div className="demo-warning"><span className="demo-dot" /><span><b>Preview data</b> — examples only. Nothing here connects to Supabase or changes a real gym workspace.</span><button type="button" onClick={() => setNotice('This walkthrough uses sample records and local-only preview actions. Sign in to access your gym’s protected, live workspace.')}>What’s this?</button></div>

          {section === 'Overview' && <>
            <div className="welcome-card" data-motion-reveal><div className="welcome-copy"><div className="welcome-label"><Zap size={14} /> WORKSPACE OVERVIEW</div><h2>See the work your gym team needs today.</h2><p>Member records, staff-recorded attendance, coaching plans and member activity in one workspace.</p><button className="text-action" onClick={() => chooseSection('Follow-ups')}>View days away <ArrowUpRight size={15} /></button></div><div className="welcome-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-orb"><Dumbbell size={35} strokeWidth={1.4} /></div><span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✳</span></div></div>
            <div className="section-head"><div><h2>The essentials</h2><p>Current sample records for this walkthrough.</p></div><span className="period-label"><CalendarDays size={14} /> {todayLabel}</span></div>
            <div className="metric-grid" data-motion-reveal>
              <Metric label="Active members" value={String(activeCount)} detail="Sample membership status" icon={Users} />
              <Metric label="Visits today" value={String(members.filter(m => m.lastVisit.startsWith('Today')).length)} detail="Manual sample check-ins" icon={ClipboardCheck} />
              <Metric label="Renewals soon" value={String(expiringCount)} detail="Sample expiry dates" icon={CalendarDays} />
              <Metric label="Away 7+ days" value={String(members.filter(m => daysAway(m.lastVisit) >= 7).length)} detail="Attendance follow-up view" icon={Bell} />
            </div>
            <div className="overview-grid" data-motion-reveal>
              <section className="surface attendance-panel"><div className="surface-heading"><div><h2>Attendance activity</h2><p>Illustrative check-ins across the last 7 days</p></div><button className="subtle-select" onClick={() => chooseSection('Attendance')}>View attendance <ArrowUpRight size={14} /></button></div><div className="chart-legend"><span><i className="legend-green" /> Sample check-ins</span></div><AttendanceChart /></section>
              <section className="surface attention-panel"><div className="surface-heading"><div><h2>Members away</h2><p>Based on the last sample visit</p></div><span className="count-bubble">{members.filter(m => daysAway(m.lastVisit) >= 7).length}</span></div><AttentionRow initials="RP" name="Rohan Patil" detail="Last visit 12 days ago" type="Inactive" onClick={() => chooseSection('Follow-ups')} /><AttentionRow initials="AN" name="Ananya Shah" detail="Last visit 3 days ago" type="Recent" onClick={() => chooseSection('Follow-ups')} /><button className="full-width-link" onClick={() => chooseSection('Follow-ups')}>Track all members <ArrowUpRight size={15} /></button></section>
            </div>
            <section className="surface recent-panel" data-motion-reveal><div className="surface-heading"><div><h2>Recent check-ins</h2><p>Member visits from today</p></div><button className="subtle-select" onClick={() => chooseSection('Attendance')}>All attendance <ArrowUpRight size={14} /></button></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>CHECK-IN TIME</th><th>MEMBERSHIP</th><th>METHOD</th></tr></thead><tbody>{members.filter(m => m.lastVisit.startsWith('Today')).slice(0, 4).map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td className="time-cell">{m.lastVisit.replace('Today, ', '')}</td><td><Status status={m.status} /></td><td><span className="method-label"><ClipboardCheck size={14} /> Manual</span></td></tr>)}</tbody></table></div></section>
          </>}

          {section === 'Members' && <section className="surface directory-panel" data-motion-reveal><div className="directory-toolbar"><div className="search-box"><Search size={17} /><input ref={searchInputRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search members" /><kbd>⌘/Ctrl K</kbd></div><div className="directory-filters"><label className="sr-only" htmlFor="preview-member-filter">Filter members by status</label><select id="preview-member-filter" className="filter-button" value={memberStatusFilter} onChange={e => setMemberStatusFilter(e.target.value as 'All' | MemberStatus)}><option value="All">All statuses</option><option value="Active">Active</option><option value="Expiring">Expiring</option><option value="Inactive">Inactive</option></select><span>{filtered.length} records</span></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>STATUS</th><th>EXPIRES</th><th>MONTHLY FEE</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td>{m.plan}</td><td><Status status={m.status} /></td><td className="time-cell">{m.expires}</td><td className="fee-cell">{money(m.fee)}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No members match the selected search and status.</div>}</div><div className="table-foot"><span>Sample data shown for preview</span><span>Secure member records will be loaded from Supabase</span></div></section>}

          {section === 'Coaching' && <div className="page-stack" data-motion-reveal><section className="surface directory-panel"><div className="surface-heading"><div><h2>Member coaching</h2><p>Individual plans and progress, shown with sample records.</p></div><span>2 sample plans</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>DIET PLAN</th><th>WORKOUT PLAN</th><th>LATEST PROGRESS</th><th></th></tr></thead><tbody><tr><td><PersonCell member={members[1]}/></td><td>Balanced strength plan</td><td>4-day strength split</td><td>Weight and notes · 2 Nov</td><td><button type="button" className="button-secondary button-small" onClick={() => viewMember(members[1].name)}>View member</button></td></tr><tr><td><PersonCell member={members[3]}/></td><td>Not assigned</td><td>Beginner movement plan</td><td>—</td><td><button type="button" className="button-secondary button-small" onClick={() => viewMember(members[3].name)}>View member</button></td></tr></tbody></table></div></section><div className="overview-grid"><section className="surface"><div className="surface-heading"><div><h2>Sample day · Diet plan</h2><p>Illustrative meal schedule</p></div><span className="preview-pill">Not advice</span></div><div className="preview-plan-list"><p><b>Breakfast</b><span>Oats, yoghurt and fruit</span></p><p><b>Lunch</b><span>Rice, dal and vegetables</span></p><p><b>Dinner</b><span>Paneer, roti and salad</span></p></div><small>Example only. Not medically validated; consult a qualified professional for health needs.</small></section><section className="surface"><div className="surface-heading"><div><h2>Sample week · Workout</h2><p>A trainer-customized routine</p></div><span>4 days</span></div><div className="preview-week-list"><p><b>Mon</b><span>Upper body</span></p><p><b>Tue</b><span>Lower body</span></p><p><b>Wed</b><span>Rest</span></p><p><b>Thu</b><span>Full body</span></p></div></section></div></div>}

          {section === 'Attendance' && <div className="page-stack" data-motion-reveal><div className="attendance-callout"><div className="qr-illustration"><ClipboardCheck size={31} /></div><div><h2>Staff-recorded check-ins.</h2><p>A staff member finds the person in Members and selects Manual check-in. The live app validates gym access and membership before saving.</p></div><button type="button" className="button-primary" onClick={() => chooseSection('Members')}>Open members <ArrowUpRight size={15} /></button></div><div className="metric-grid metric-grid-two"><Metric label="Today's visits" value={String(members.filter(m => m.lastVisit.startsWith('Today')).length)} detail="Sample check-ins" icon={ClipboardCheck} /><Metric label="Active memberships" value={String(activeCount)} detail="Sample records" icon={Users} /></div><section className="surface"><div className="surface-heading"><div><h2>Attendance history</h2><p>Example check-in records</p></div><span className="period-label">Last 7 days</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>DATE</th><th>TIME</th><th>CHECK-IN METHOD</th><th>STATUS</th></tr></thead><tbody>{members.filter(m => m.lastVisit.startsWith('Today')).map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td>{todayLabel}</td><td className="time-cell">{m.lastVisit.replace('Today, ', '')}</td><td><span className="method-label"><ClipboardCheck size={14} /> Manual</span></td><td><Status status="Active" /></td></tr>)}</tbody></table></div></section></div>}

          {section === 'Staff' && <div className="page-stack" data-motion-reveal><div className="metric-grid metric-grid-three"><Metric label="Staff records" value="2" detail="Sample directory" icon={Users}/><Metric label="Admins" value="1" detail="Example role count" icon={ShieldCheck}/><Metric label="Trainers" value="1" detail="Example role count" icon={Dumbbell}/></div><section className="surface directory-panel"><div className="surface-heading"><div><h2>Staff directory</h2><p>Employee records for this demo workspace.</p></div><span>Sample only</span></div><div className="table-scroll"><table><thead><tr><th>STAFF MEMBER</th><th>ROLE</th><th>EMAIL</th><th>STATUS</th></tr></thead><tbody><tr><td><b>Riya Kapoor</b></td><td>Admin</td><td>riya@example.test</td><td><Status status="Active"/></td></tr><tr><td><b>Dev Malhotra</b></td><td>Trainer</td><td>dev@example.test</td><td><Status status="Active"/></td></tr></tbody></table></div><div className="table-foot"><span>Staff entries do not create login accounts in this sample preview.</span><span>Live staff access uses invitations.</span></div></section></div>}

          {section === 'Follow-ups' && <section className="surface directory-panel" data-motion-reveal><div className="surface-heading"><div><h2>Member attendance tracking</h2><p>Every member, ordered by time away from the gym</p></div><span>{members.length} members</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>LAST VISIT</th><th>DAYS AWAY</th></tr></thead><tbody>{[...members].sort((a,b) => daysAway(b.lastVisit)-daysAway(a.lastVisit)).map(member => <tr key={member.id}><td><PersonCell member={member}/></td><td>{member.lastVisit.startsWith('Today') ? 'Today' : member.lastVisit}</td><td>{daysAway(member.lastVisit) === 0 ? 'Today' : `${daysAway(member.lastVisit)} days`}</td></tr>)}</tbody></table></div><div className="table-foot"><span>Attendance tracking only</span><span>Sample visit history · no reminders are sent</span></div></section>}

          {section === 'Reports' && <div className="page-stack" data-motion-reveal><div className="metric-grid"><Metric label="Members in preview" value={String(members.length)} detail="Sample records only" icon={Users} /><Metric label="Active memberships" value={String(activeCount)} detail="Sample count" icon={Activity} /><Metric label="Attendance rows" value={String(members.filter(m => m.lastVisit.startsWith('Today')).length)} detail="Today's sample visits" icon={ClipboardCheck} /><Metric label="Away 7+ days" value={String(members.filter(m => daysAway(m.lastVisit) >= 7).length)} detail="Based on sample history" icon={Bell} /></div><section className="surface report-surface"><div className="surface-heading"><div><h2>Workspace summary</h2><p>Example counts from the preview members only</p></div><span className="period-label">{todayLabel}</span></div><div className="report-bars"><ReportBar label="Active membership" count={activeCount} total={members.length} color="green" /><ReportBar label="Expiring membership" count={expiringCount} total={members.length} color="amber" /><ReportBar label="Inactive membership" count={inactiveCount} total={members.length} color="grey" /></div><div className="report-note"><ShieldCheck size={16} /> This export contains sample records. Live reports use this gym's authorized records.</div></section></div>}
          <footer className="page-footer"><span><button type="button" className="footer-home" onClick={() => chooseSection('Overview')} aria-label="LiftDesk home, Overview"><LiftDeskLogo compact /></button> <span className="footer-dot">·</span> Built for independent gyms · © {new Date().getFullYear()}</span><span><ShieldCheck size={14} /> Preview uses sample data</span></footer>
        </div>
      </main>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) } }}><form ref={memberDialogRef} className="member-modal" role="dialog" aria-modal="true" aria-labelledby="preview-add-member-title" onSubmit={addMember}><div className="modal-heading"><div><div className="eyebrow">MEMBER DIRECTORY</div><h2 id="preview-add-member-title">Add a member</h2><p>This adds a temporary preview record only.</p></div><button type="button" className="icon-button" aria-label="Close modal" onClick={() => { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}><X size={19} /></button></div><label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Desai" /></label><label>Phone number<input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></label><div className="form-two"><label>Membership plan<select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}><option>Monthly</option><option>Quarterly</option><option>Annual</option></select></label><label>Monthly fee (₹)<input type="number" min="0" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} /></label></div><label>Membership expiry<input type="date" min={today} value={form.expiry} onChange={e => setForm({ ...form,expiry:e.target.value})}/></label><div className="modal-note"><ShieldCheck size={16} /> Sample entry only. This preview does not save to the gym database.</div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}>Cancel</button><button type="submit" className="button-primary"><Plus size={16} /> Add preview member</button></div></form></div>}
      <PreviewChat role={role} open={chatOpen} onToggle={() => setChatOpen(open => !open)} messages={chatMessages} draft={chatDraft} onDraft={setChatDraft} onSend={sendPreviewMessage} onTogglePin={togglePreviewPin}/>
    </div>
  )
}

function Metric({ label, value, change, positive, detail, icon: Icon }: { label: string; value: string; change?: string; positive?: boolean; detail: string; icon: typeof Users }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} strokeWidth={1.8} /></span></div><div className="metric-value">{value}</div><div className="metric-bottom">{change && <span className={'metric-change ' + (positive ? 'positive' : '')}>{positive && <ArrowUpRight size={13} />}{change}</span>}<span>{detail}</span></div></div>
}

function PersonCell({ member }: { member: Member }) {
  return <div className="person-cell"><span className="person-avatar">{member.initials}</span><span><b>{member.name}</b><small>{member.phone}</small></span></div>
}

function AttentionRow({ initials, name, detail, type, onClick }: { initials: string; name: string; detail: string; type: string; onClick: () => void }) {
  return <button className="attention-row" onClick={onClick}><span className="person-avatar">{initials}</span><span className="attention-copy"><b>{name}</b><small>{detail}</small></span><span className={'mini-tag ' + (type === 'Renewal' ? 'tag-amber' : 'tag-sage')}>{type}</span><ArrowUpRight className="attention-arrow" size={15} /></button>
}

function ReportBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return <div className="report-bar-row"><div><span>{label}</span><b>{count}</b></div><div className="report-bar-track"><span className={'report-bar-fill fill-' + color} style={{ width: (total ? count / total * 100 : 0) + '%' }} /></div></div>
}

function AttendanceChart() {
  const current = [32, 48, 39, 66, 52, 82, 70]
  const previous = [24, 36, 34, 49, 42, 61, 54]
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return <div className="chart-wrap"><div className="chart-y-labels"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 560 190" preserveAspectRatio="none" role="img" aria-label="Illustrative line chart comparing this week and previous week attendance"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C5F36B" stopOpacity=".65" /><stop offset="100%" stopColor="#C5F36B" stopOpacity="0" /></linearGradient></defs><path d={current.map((v, i) => (i ? 'L' : 'M') + (i * 560 / 6) + ' ' + (178 - v * 1.8)).join(' ') + ' L560 190 L0 190 Z'} fill="url(#chartFill)" /><polyline points={previous.map((v, i) => (i * 560 / 6) + ',' + (178 - v * 1.8)).join(' ')} fill="none" stroke="#D4D8D0" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><polyline points={current.map((v, i) => (i * 560 / 6) + ',' + (178 - v * 1.8)).join(' ')} fill="none" stroke="#343B36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />{current.map((v, i) => <circle key={i} cx={i * 560 / 6} cy={178 - v * 1.8} r="4" fill="#FFFFFF" stroke="#343B36" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}</svg><div className="chart-x-labels">{days.map(day => <span key={day}>{day}</span>)}</div></div></div>
}

export default App

function MemberPortalPreview({ section, onSection, onRoleChange, children }: { section: Section; onSection: (section: Section) => void; onRoleChange: (role: DemoRole) => void; children: ReactNode }) {
  const sections = memberNavItems
  return <div className="member-workspace-boundary preview-member-boundary">
    <main className="member-portal-shell">
      <header className="member-portal-header">
        <div className="member-portal-brand"><LiftDeskMark size={46}/><small>MEMBER PORTAL · PREVIEW</small></div>
        <div className="member-portal-gym"><span className="member-portal-gym-label">GYM WORKSPACE</span><b>LiftDesk Demo Gym</b></div>
        <label className="preview-role-switch"><span>View as</span><select aria-label="Choose preview role" value="Member" onChange={event => onRoleChange(event.target.value as DemoRole)}><option>Owner</option><option>Admin</option><option>Trainer</option><option>Member</option></select></label>
        <a className="member-portal-signout" href="/?mode=signin">Sign in</a>
      </header>
      <div className="member-portal-content">
        <div className="demo-warning"><span className="demo-dot"/><span><b>Preview data</b> — sample member information only. No account or private records are loaded.</span></div>
        <section className="member-portal-hero"><div className="member-portal-hero-copy"><p className="member-portal-kicker">YOUR GYM MEMBERSHIP</p><h1>{section === 'Member overview' ? 'Your membership, in one place.' : section}</h1><p>Review membership details, coaching plans and progress shared with you by your gym.</p></div><div className="member-portal-person"><span className="member-portal-avatar">AS</span><span className="member-portal-person-copy"><b>Aarav Sharma</b><span>Member · demo profile</span></span><span className="member-portal-status"><i/>Active</span></div></section>
        <div className="member-portal-summary"><MemberSummary label="Membership" value="Active" detail="Monthly plan"/><MemberSummary label="Expires" value="18 Nov 2026" detail="Sample date"/><MemberSummary label="Diet plan" value="Assigned" detail="Strength support"/><MemberSummary label="Workout" value="4 days / week" detail="Trainer plan"/></div>
        <nav className="member-portal-nav preview-member-nav" aria-label="Member preview sections">{sections.map(item => <button type="button" key={item.label} className={section === item.label ? 'is-active' : ''} aria-current={section === item.label ? 'page' : undefined} onClick={() => onSection(item.label)}>{item.label === 'Member overview' ? 'Overview' : item.label}</button>)}</nav>
        {section === 'Member overview' && <div className="member-portal-grid"><section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">MEMBERSHIP</p><h2>Your current plan</h2></div><span className="member-portal-section-meta">Sample information</span></div><article className="member-membership-card"><span className="member-membership-mark"><ShieldCheck size={18}/></span><div className="member-membership-copy"><h3>Monthly membership</h3><p>Active · Example expiry 18 Nov 2026</p></div><div className="member-membership-expiry"><span>Monthly fee</span><b>₹999</b></div></article></section><section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">COACHING</p><h2>Plans shared with you</h2></div></div><div className="preview-member-plan-links"><button type="button" onClick={() => onSection('Diet plan')}><span>Diet plan</span><b>Balanced strength plan</b></button><button type="button" onClick={() => onSection('Workout plan')}><span>Workout plan</span><b>Four-day strength routine</b></button></div></section><section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">PROGRESS</p><h2>Latest update</h2></div><button type="button" className="subtle-select" onClick={() => onSection('Progress')}>View history <ArrowUpRight size={14}/></button></div><article className="preview-progress-summary"><b>2 Nov 2026</b><span>Sample coaching note: building a consistent weekly routine.</span></article></section></div>}
        {section === 'Membership' && <section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">YOUR ACCOUNT</p><h2>Membership details</h2></div><span className="member-portal-section-meta">Demo values</span></div><article className="member-membership-card"><span className="member-membership-mark"><ShieldCheck size={18}/></span><div className="member-membership-copy"><h3>Monthly membership</h3><p>Active · Sample start date 18 Oct 2026</p></div><div className="member-membership-expiry"><span>Expires</span><b>18 Nov 2026</b></div></article></section>}
        {section === 'Diet plan' && <section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">TRAINER-SHARED PLAN</p><h2>Balanced strength plan</h2><p>Example meal schedule · not medical nutrition advice</p></div><span className="member-portal-section-meta">Sample plan</span></div><div className="preview-meal-grid"><MemberMeal title="Breakfast" detail="Oats, yoghurt and fruit"/><MemberMeal title="Lunch" detail="Rice, dal and vegetables"/><MemberMeal title="Snack" detail="Fruit and a handful of nuts"/><MemberMeal title="Dinner" detail="Paneer, roti and salad"/></div><p className="preview-health-note">Food suggestions are examples only. Ask a qualified healthcare professional about medical or dietary needs.</p></section>}
        {section === 'Workout plan' && <section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">TRAINER-SHARED PLAN</p><h2>Four-day strength routine</h2><p>Sample week · your actual trainer may customize your schedule.</p></div><span className="member-portal-section-meta">4 training days</span></div><div className="preview-workout-week">{[['Mon','Upper body'],['Tue','Lower body'],['Wed','Rest'],['Thu','Full body'],['Fri','Rest'],['Sat','Conditioning'],['Sun','Rest']].map(([day,focus])=><article key={day}><b>{day}</b><span>{focus}</span></article>)}</div></section>}
        {section === 'Progress' && <section className="member-portal-section"><div className="member-portal-section-heading"><div><p className="member-portal-kicker">COACHING HISTORY</p><h2>Progress updates</h2></div><span className="member-portal-section-meta">Sample entries</span></div><div className="preview-progress-list"><article><time>2 Nov 2026</time><div><b>Training consistency</b><p>Completed three planned sessions this week. Example note only.</p></div></article><article><time>19 Oct 2026</time><div><b>First check-in</b><p>Baseline measurements are not included in this public preview.</p></div></article></div></section>}
        <footer className="member-portal-footer"><span>LiftDesk · LiftDesk Demo Gym · © {new Date().getFullYear()}</span><span>Sample member portal · no live account</span></footer>
      </div>
    </main>
    {children}
  </div>
}

function MemberSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="member-summary-item"><span>{label}</span><b>{value}</b><small>{detail}</small></div>
}

function MemberMeal({ title, detail }: { title: string; detail: string }) {
  return <article className="preview-meal-card"><span>{title}</span><b>{detail}</b></article>
}

function PreviewChat({ role, open, onToggle, messages, draft, onDraft, onSend, onTogglePin }: { role: DemoRole; open: boolean; onToggle: () => void; messages: PreviewMessage[]; draft: string; onDraft: (value: string) => void; onSend: (event: FormEvent<HTMLFormElement>) => void; onTogglePin: (id: number) => void }) {
  const canSend = role === 'Owner' || role === 'Admin'
  return <>
    {open && <div className="gym-chat-floating-panel preview-chat-panel"><section className="gym-chat surface" aria-label="Preview gym chat"><header className="gym-chat-header"><span className="gym-chat-mark"><MessageSquare size={17}/></span><div><h2>Gym chat</h2><p>LiftDesk Demo Gym · sample conversation</p></div><button type="button" className="gym-chat-close" aria-label="Close preview chat" onClick={onToggle}><X size={17}/></button></header><p className="preview-chat-notice"><LockKeyhole size={13}/> This sample chat is not sent or encrypted. The live app has its own encrypted chat flow.</p><div className="gym-chat-messages">{messages.map(message=><article key={message.id} className={'gym-chat-message' + (message.author === 'You' ? ' is-own-message' : '')}><span className="gym-chat-message-author">{message.author} · {message.role}</span>{message.pinned && <span className="gym-chat-message-pin"><Pin size={12}/> Pinned announcement</span>}<p>{message.body}</p><div className="gym-chat-message-footer"><time>{message.time}</time>{canSend && <button type="button" className="gym-chat-pin-action" aria-label={message.pinned ? 'Unpin sample message' : 'Pin sample message'} onClick={()=>onTogglePin(message.id)}><Pin size={12}/>{message.pinned ? 'Unpin' : 'Pin'}</button>}</div></article>)}</div>{canSend ? <form className="gym-chat-composer" onSubmit={onSend}><label className="sr-only" htmlFor="preview-chat-message">Sample message</label><textarea id="preview-chat-message" value={draft} maxLength={500} rows={2} placeholder="Write a sample message…" onChange={event=>onDraft(event.target.value)}/><div className="gym-chat-composer-actions"><span>Preview only</span><button type="submit" className="button-primary" disabled={!draft.trim()}><Send size={14}/> Send</button></div></form> : <p className="gym-chat-read-only"><LockKeyhole size={14}/> Read-only chat. Owners and Admins can send and pin.</p>}</section></div>}
    <button type="button" className="gym-chat-floating-launcher" aria-label={open ? 'Close gym chat' : 'Open gym chat'} aria-expanded={open} onClick={onToggle}><MessageSquare size={18}/><span>{open ? 'Close chat' : 'Chat'}</span></button>
  </>
}

function daysAway(lastVisit: string) {
  if (lastVisit.startsWith('Today')) return 0
  if (lastVisit.startsWith('Yesterday')) return 1
  return Number(lastVisit.match(/^(\d+) days ago$/)?.[1] ?? 0)
}
