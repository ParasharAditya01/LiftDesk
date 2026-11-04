import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Activity, ArrowUpRight, Bell, CalendarDays,
  CircleHelp, Download, Dumbbell, FileBarChart, LayoutDashboard, Menu,
  Plus, ClipboardCheck, Search, Settings2, ShieldCheck, Sparkles, Users, X, Zap,
} from 'lucide-react'
import LiftDeskMark from './LiftDeskMark'
import LiftDeskLogo from './LiftDeskLogo'
import { useScrollMotion } from './lib/useScrollMotion'

type Section = 'Overview' | 'Members' | 'Attendance' | 'Follow-ups' | 'Reports'
type MemberStatus = 'Active' | 'Expiring' | 'Inactive'
type Member = { id: number; name: string; initials: string; phone: string; plan: string; status: MemberStatus; expires: string; fee: number; lastVisit: string }

const initialMembers: Member[] = [
  { id: 1, name: 'Aarav Sharma', initials: 'AS', phone: '+91 98765 43210', plan: 'Monthly', status: 'Active', expires: '18 Nov 2026', fee: 999, lastVisit: 'Today, 07:42 AM' },
  { id: 2, name: 'Meera Joshi', initials: 'MJ', phone: '+91 98220 14567', plan: 'Quarterly', status: 'Expiring', expires: '27 Oct 2026', fee: 899, lastVisit: 'Yesterday, 06:18 PM' },
  { id: 3, name: 'Rohan Patil', initials: 'RP', phone: '+91 97654 21098', plan: 'Monthly', status: 'Inactive', expires: '04 Nov 2026', fee: 999, lastVisit: '12 days ago' },
  { id: 4, name: 'Isha Kulkarni', initials: 'IK', phone: '+91 98901 33221', plan: 'Annual', status: 'Active', expires: '16 Mar 2027', fee: 799, lastVisit: 'Today, 08:06 AM' },
  { id: 5, name: 'Kabir Deshmukh', initials: 'KD', phone: '+91 93071 55881', plan: 'Quarterly', status: 'Active', expires: '12 Dec 2026', fee: 899, lastVisit: 'Today, 06:51 AM' },
  { id: 6, name: 'Ananya Shah', initials: 'AS', phone: '+91 97633 70419', plan: 'Monthly', status: 'Expiring', expires: '29 Oct 2026', fee: 999, lastVisit: '3 days ago' },
]

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Members', icon: Users },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Follow-ups', icon: Bell },
  { label: 'Reports', icon: FileBarChart },
]

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function Brand() {
  return <div className="brand-lockup"><LiftDeskMark size={35} className="brand-mark" /><span className="brand-name">Lift<span>Desk</span><small>GYM OPERATIONS</small></span></div>
}

function Status({ status }: { status: MemberStatus }) {
  return <span className={'status status-' + status.toLowerCase()}><i />{status}</span>
}

function App() {
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

  return (
    <div className="app-shell">
      <aside ref={sidebarRef} id="preview-navigation" className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
        <div className="sidebar-top"><button type="button" className="brand-home" aria-label="LiftDesk home, Overview" onClick={() => chooseSection('Overview')}><Brand /></button><button className="icon-button mobile-close" onClick={() => { setMobileNav(false); requestAnimationFrame(() => menuButtonRef.current?.focus()) }} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="workspace-avatar">PF</div><div className="workspace-copy"><b>Power Fitness Club</b><span>Owner workspace</span></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => <button type="button" key={label} className={'nav-item ' + (section === label ? 'nav-active' : '')} aria-current={section === label ? 'page' : undefined} onClick={() => chooseSection(label)}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{label === 'Follow-ups' && <span className="nav-count">3</span>}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-pilot"><div className="pilot-icon"><Sparkles size={16} /></div><b>Early access</b><p>Help shape a calmer way to run your gym.</p><span>PREVIEW WORKSPACE</span></div>
        <div className="sidebar-bottom">
          <div className="nav-item muted-nav" aria-disabled="true"><Settings2 size={18} /><span>Settings · coming soon</span></div>
          <div className="nav-item muted-nav" aria-disabled="true"><CircleHelp size={18} /><span>Help · coming soon</span></div>
          <div className="profile-row"><div className="profile-avatar">AP</div><div className="profile-copy"><b>Gym owner</b><span>Preview account</span></div></div>
        </div>
      </aside>
      {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation overlay" onClick={() => { setMobileNav(false); requestAnimationFrame(() => menuButtonRef.current?.focus()) }} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button ref={menuButtonRef} type="button" className="icon-button mobile-menu" aria-label="Open main navigation" aria-controls="preview-navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={20} /></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span><b>{section}</b></div>
          <div className="topbar-right"><span className="preview-pill"><span /> Preview mode</span><span className="topbar-divider" /><span className="today-label"><CalendarDays size={15} /> 25 Oct 2026</span><button className="icon-button notification-button" aria-label="Notifications" onClick={() => chooseSection('Follow-ups')}><Bell size={18} /><i /></button></div>
        </header>
        <div className="page-content" ref={pageContentRef}>
          <div className="page-heading">
            <div><div className="eyebrow">{section === 'Overview' ? 'SUNDAY, 25 OCTOBER 2026' : 'POWER FITNESS CLUB  /  WORKSPACE'}</div><h1 ref={headingRef} tabIndex={-1}>{section === 'Overview' ? 'Your gym, at a glance.' : section === 'Members' ? 'Members' : section === 'Attendance' ? 'Attendance' : section === 'Follow-ups' ? 'Follow-ups' : 'Reports'}</h1><p>{section === 'Overview' ? 'A little more clarity for the work you do every day.' : section === 'Members' ? 'Keep member details and memberships in one place.' : section === 'Attendance' ? 'A clear record of who walked through the door.' : section === 'Follow-ups' ? 'Small reminders that help keep members connected.' : 'Understand attendance, membership and retention at a glance.'}</p></div>
            <div className="heading-actions">{section === 'Members' && <button ref={addMemberButtonRef} type="button" className="button-primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add member</button>}{section === 'Reports' && <button type="button" className="button-secondary" onClick={downloadReport}><Download size={16} /> Export preview CSV</button>}</div>
          </div>
          {notice && <div className="notice-banner" role="status"><ShieldCheck size={17} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button></div>}
          <div className="demo-warning"><span className="demo-dot" /><span><b>Preview data</b> — these sample records are for interface testing only. Changes are not stored in a database.</span><button type="button" onClick={() => setNotice('Preview changes stay in this browser session only. Sign in from the home page to access your gym’s live, access-controlled records.')}>What’s this?</button></div>

          {section === 'Overview' && <>
            <div className="welcome-card" data-motion-reveal><img className="welcome-photo" src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1100&q=82" alt="Modern gym interior with strength-training equipment" loading="lazy" /><div className="welcome-copy"><div className="welcome-label"><Zap size={14} /> YOUR DAILY BRIEF</div><h2>Good morning. Let’s keep things moving.</h2><p>Here’s where your team’s attention can make the biggest difference today.</p><button className="text-action" onClick={() => chooseSection('Follow-ups')}>Review follow-ups <ArrowUpRight size={15} /></button></div><div className="welcome-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-orb"><Dumbbell size={35} strokeWidth={1.4} /></div><span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✳</span></div></div>
            <div className="section-head"><div><h2>The essentials</h2><p>A useful snapshot, without the noise.</p></div><span className="period-label"><CalendarDays size={14} /> This month</span></div>
            <div className="metric-grid" data-motion-reveal>
              <Metric label="Active members" value={String(activeCount)} change="+4.8%" positive detail="vs. last month" icon={Users} />
              <Metric label="Visits today" value="24" change="+12.2%" positive detail="vs. last Sunday" icon={ClipboardCheck} />
              <Metric label="Renewals soon" value={String(expiringCount)} change="Next 7 days" detail="Members to contact" icon={CalendarDays} />
              <Metric label="Need a check-in" value={String(inactiveCount)} change="7+ days away" detail="Could use a follow-up" icon={Bell} />
            </div>
            <div className="overview-grid" data-motion-reveal>
              <section className="surface attendance-panel"><div className="surface-heading"><div><h2>Attendance rhythm</h2><p>Visits across the last 7 days</p></div><button className="subtle-select" onClick={() => chooseSection('Attendance')}>View attendance <ArrowUpRight size={14} /></button></div><div className="chart-legend"><span><i className="legend-green" /> Check-ins</span><span><i className="legend-pale" /> Previous week</span></div><AttendanceChart /></section>
              <section className="surface attention-panel"><div className="surface-heading"><div><h2>Needs your attention</h2><p>Worth a quick look today</p></div><span className="count-bubble">3</span></div><AttentionRow initials="MJ" name="Meera Joshi" detail="Membership ends in 2 days" type="Renewal" onClick={() => chooseSection('Follow-ups')} /><AttentionRow initials="RP" name="Rohan Patil" detail="No visit in 12 days" type="Inactive" onClick={() => chooseSection('Follow-ups')} /><AttentionRow initials="AS" name="Ananya Shah" detail="Membership ends in 4 days" type="Renewal" onClick={() => chooseSection('Follow-ups')} /><button className="full-width-link" onClick={() => chooseSection('Follow-ups')}>Open follow-up queue <ArrowUpRight size={15} /></button></section>
            </div>
            <section className="surface recent-panel" data-motion-reveal><div className="surface-heading"><div><h2>Recent check-ins</h2><p>Member visits from today</p></div><button className="subtle-select" onClick={() => chooseSection('Attendance')}>All attendance <ArrowUpRight size={14} /></button></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>CHECK-IN TIME</th><th>MEMBERSHIP</th><th>METHOD</th></tr></thead><tbody>{members.filter(m => m.lastVisit.startsWith('Today')).slice(0, 4).map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td className="time-cell">{m.lastVisit.replace('Today, ', '')}</td><td><Status status={m.status} /></td><td><span className="method-label"><ClipboardCheck size={14} /> Manual</span></td></tr>)}</tbody></table></div></section>
          </>}

          {section === 'Members' && <section className="surface directory-panel" data-motion-reveal><div className="directory-toolbar"><div className="search-box"><Search size={17} /><input ref={searchInputRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or phone" aria-label="Search members" /><kbd>⌘/Ctrl K</kbd></div><div className="directory-filters"><label className="sr-only" htmlFor="preview-member-filter">Filter members by status</label><select id="preview-member-filter" className="filter-button" value={memberStatusFilter} onChange={e => setMemberStatusFilter(e.target.value as 'All' | MemberStatus)}><option value="All">All statuses</option><option value="Active">Active</option><option value="Expiring">Expiring</option><option value="Inactive">Inactive</option></select><span>{filtered.length} records</span></div></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>PLAN</th><th>STATUS</th><th>EXPIRES</th><th>MONTHLY FEE</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td>{m.plan}</td><td><Status status={m.status} /></td><td className="time-cell">{m.expires}</td><td className="fee-cell">{money(m.fee)}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No members match the selected search and status.</div>}</div><div className="table-foot"><span>Sample data shown for preview</span><span>Secure member records will be loaded from Supabase</span></div></section>}

          {section === 'Attendance' && <div className="page-stack" data-motion-reveal><div className="attendance-callout"><div className="qr-illustration"><ClipboardCheck size={31} /></div><div><h2>Staff-recorded check-ins.</h2><p>Select a member on the Members screen and use Manual check-in. Gym staff verify the person before saving attendance.</p></div><button type="button" className="button-primary" onClick={() => chooseSection('Members')}>Open members <ArrowUpRight size={15} /></button></div><div className="metric-grid metric-grid-two"><Metric label="Today's visits" value="24" detail="Preview count" icon={ClipboardCheck} /><Metric label="Active memberships" value={String(activeCount)} detail="Preview records" icon={Users} /></div><section className="surface"><div className="surface-heading"><div><h2>Latest visits</h2><p>Illustrative attendance history</p></div><span className="period-label">Last 7 days</span></div><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>DATE</th><th>TIME</th><th>CHECK-IN METHOD</th><th>STATUS</th></tr></thead><tbody>{members.filter(m => m.lastVisit.startsWith('Today')).map(m => <tr key={m.id}><td><PersonCell member={m} /></td><td>25 Oct 2026</td><td className="time-cell">{m.lastVisit.replace('Today, ', '')}</td><td><span className="method-label"><ClipboardCheck size={14} /> Manual</span></td><td><Status status="Active" /></td></tr>)}</tbody></table></div></section></div>}

          {section === 'Follow-ups' && <div className="followup-grid" data-motion-reveal><section className="surface followup-list"><div className="surface-heading"><div><h2>Follow-up queue</h2><p>Suggested next steps from sample records</p></div><span className="count-bubble">3</span></div><FollowupCard initials="MJ" name="Meera Joshi" detail="Membership ends 27 Oct · 2 days left" kind="Renewal reminder" onClick={() => viewMember('Meera Joshi')} /><FollowupCard initials="RP" name="Rohan Patil" detail="Last visit was 12 days ago" kind="Member re-engagement" onClick={() => viewMember('Rohan Patil')} /><FollowupCard initials="AS" name="Ananya Shah" detail="Membership ends 29 Oct · 4 days left" kind="Renewal reminder" onClick={() => viewMember('Ananya Shah')} /></section><section className="surface followup-side"><div className="tip-icon"><Sparkles size={18} /></div><div className="eyebrow">A SMALL REMINDER</div><h2>Consistency builds community.</h2><p>A personal message after a missed week can help a member feel noticed, not chased.</p><div className="tip-rule" /><div className="tip-stat"><span>Renewals to review</span><b>{expiringCount}</b></div><div className="tip-stat"><span>Members to reconnect with</span><b>{inactiveCount}</b></div></section></div>}

          {section === 'Reports' && <div className="page-stack" data-motion-reveal><div className="metric-grid"><Metric label="Members in preview" value={String(members.length)} detail="Sample records only" icon={Users} /><Metric label="Active memberships" value={String(activeCount)} detail="Preview count" icon={Activity} /><Metric label="Renewals to review" value={String(expiringCount)} detail="Next 7 days" icon={CalendarDays} /><Metric label="Inactive members" value={String(inactiveCount)} detail="7+ days since visit" icon={Bell} /></div><section className="surface report-surface"><div className="surface-heading"><div><h2>Membership overview</h2><p>Illustrative distribution from sample data</p></div><span className="period-label">October 2026</span></div><div className="report-bars"><ReportBar label="Active" count={activeCount} total={members.length} color="green" /><ReportBar label="Expiring soon" count={expiringCount} total={members.length} color="amber" /><ReportBar label="Inactive" count={inactiveCount} total={members.length} color="grey" /></div><div className="report-note"><ShieldCheck size={16} /> Revenue and retention reports will be calculated from verified database records, not sample values.</div></section></div>}
          <footer className="page-footer"><span><button type="button" className="footer-home" onClick={() => chooseSection('Overview')} aria-label="LiftDesk home, Overview"><LiftDeskLogo compact /></button> <span className="footer-dot">·</span> Built for independent gyms · © {new Date().getFullYear()}</span><span><ShieldCheck size={14} /> Preview uses sample data</span></footer>
        </div>
      </main>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) } }}><form ref={memberDialogRef} className="member-modal" role="dialog" aria-modal="true" aria-labelledby="preview-add-member-title" onSubmit={addMember}><div className="modal-heading"><div><div className="eyebrow">MEMBER DIRECTORY</div><h2 id="preview-add-member-title">Add a member</h2><p>This adds a temporary preview record only.</p></div><button type="button" className="icon-button" aria-label="Close modal" onClick={() => { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}><X size={19} /></button></div><label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Desai" /></label><label>Phone number<input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></label><div className="form-two"><label>Membership plan<select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}><option>Monthly</option><option>Quarterly</option><option>Annual</option></select></label><label>Monthly fee (₹)<input type="number" min="0" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} /></label></div><label>Membership expiry<input type="date" min={today} value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} /></label><div className="modal-note"><ShieldCheck size={16} /> Database saving and gym-level permissions are not enabled yet.</div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setModalOpen(false); requestAnimationFrame(() => addMemberButtonRef.current?.focus()) }}>Cancel</button><button type="submit" className="button-primary"><Plus size={16} /> Add preview member</button></div></form></div>}
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

function FollowupCard({ initials, name, detail, kind, onClick }: { initials: string; name: string; detail: string; kind: string; onClick: () => void }) {
  return <div className="followup-card"><span className="person-avatar">{initials}</span><div className="followup-card-copy"><b>{name}</b><small>{detail}</small><span>{kind}</span></div><button type="button" className="button-secondary button-small" onClick={onClick}>View member <ArrowUpRight size={13} /></button></div>
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
