import { useEffect, useState } from 'react'
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarCheck, Check, ChevronDown, ClipboardCheck, Dumbbell, Menu, Users, X } from 'lucide-react'
import LiftDeskMark from './LiftDeskMark'

type PreviewTab = 'Members' | 'Attendance' | 'Coaching' | 'Follow-ups'

const previewRows: Record<PreviewTab, { label: string; detail: string; badge: string }[]> = {
  Members: [
    { label: 'Member 014', detail: 'Monthly · Active', badge: 'Active' },
    { label: 'Member 027', detail: 'Quarterly · Active', badge: 'Active' },
    { label: 'Member 031', detail: 'Monthly · Renewal due', badge: 'Review' },
  ],
  Attendance: [
    { label: 'Member 014', detail: 'Today · 07:42 am', badge: 'Manual' },
    { label: 'Member 027', detail: 'Today · 08:16 am', badge: 'Manual' },
    { label: 'Member 031', detail: 'Yesterday · 06:31 pm', badge: 'Manual' },
  ],
  Coaching: [
    { label: 'Member 014', detail: 'Strength · Active plan', badge: 'Workout' },
    { label: 'Member 027', detail: 'Progress updated · 2 days ago', badge: 'Progress' },
    { label: 'Member 031', detail: 'Nutrition · Draft plan', badge: 'Draft' },
  ],
  'Follow-ups': [
    { label: 'Member 014', detail: 'Last visit · 9 days ago', badge: 'Check in' },
    { label: 'Member 027', detail: 'Last visit · 2 days ago', badge: 'On track' },
    { label: 'Member 031', detail: 'Last visit · 12 days ago', badge: 'Check in' },
  ],
}

const sections = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'questions', label: 'Questions' },
]

export default function LandingPage() {
  const [tab, setTab] = useState<PreviewTab>('Members')
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    document.title = 'LiftDesk — Gym operations, simplified'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Keep gym members, attendance, coaching and follow-ups together in one clear workspace with LiftDesk.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return <div className="landing-page">
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="LiftDesk home"><LiftDeskMark size={46} /></a>
      <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <nav className={'landing-nav' + (menuOpen ? ' is-open' : '')} id="landing-navigation" aria-label="Main navigation">
        {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={closeMenu}>{section.label}</a>)}
        <a className="landing-signin" href="/?mode=signin" onClick={closeMenu}>Sign in <ArrowUpRight size={15} /></a>
        <a className="landing-nav-cta" href="/?mode=signup" onClick={closeMenu}>Request a workspace <ArrowRight size={15} /></a>
      </nav>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> Gym operations platform</div>
          <h1 id="landing-title">Gym operations, <em>under control.</em></h1>
          <p>Manage members, attendance, coaching and staff in one workspace.</p>
          <div className="landing-actions"><a className="landing-primary" href="/?mode=signup">Request access <ArrowRight size={17} /></a><a className="landing-secondary" href="#workspace">View platform <ArrowDown size={15} /></a></div>
          <div className="landing-hero-foot"><span><Check size={14} /> Designed for gym operations</span><span><Check size={14} /> Role-based access</span></div>
        </div>

        <section className="product-preview" aria-label="Interactive LiftDesk product preview">
          <div className="preview-topline"><div className="preview-brand"><LiftDeskMark size={38} /></div><span className="preview-state"><i /> SAMPLE PREVIEW</span></div>
          <div className="preview-welcome"><div><span className="preview-overline">YOUR GYM AT A GLANCE</span><h2>Today’s workspace</h2><p>Members, attendance and coaching in one view.</p></div><span className="preview-date">TODAY</span></div>
          <div className="preview-metrics"><div><span>Members</span><b><Users size={17} /> Directory</b></div><div><span>Attendance</span><b><CalendarCheck size={17} /> Check-ins</b></div><div><span>Coaching</span><b><Dumbbell size={17} /> Plans</b></div></div>
          <div className="preview-table-head"><span>WORKSPACE VIEW</span><span>SELECT A SECTION</span></div>
          <div className="preview-tabs" role="group" aria-label="Preview workspace sections">{(['Members', 'Attendance', 'Coaching', 'Follow-ups'] as PreviewTab[]).map(item => <button key={item} type="button" aria-pressed={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
          <div className="preview-records" aria-live="polite" aria-label={`${tab} sample records`}>
            {previewRows[tab].map((row, index) => <div className="preview-record" key={row.label}><span className="preview-avatar">{String(index + 1).padStart(2, '0')}</span><span className="preview-record-copy"><b>{row.label}</b><small>{row.detail}</small></span><span className={'preview-tag' + (row.badge === 'Check in' || row.badge === 'Review' ? ' attention' : '')}>{row.badge}</span></div>)}
          </div>
          <div className="preview-disclaimer"><Activity size={15} /><span>Illustrative interface only. No live member data.</span></div>
        </section>
      </section>

      <div className="landing-proofline" aria-label="Product principles"><span>ONE GYM WORKSPACE</span><i /><span>ROLE-BASED ACCESS</span><i /><span>REAL RECORDS, CLEARLY ORGANIZED</span><i /><span>MADE FOR DAILY OPERATIONS</span></div>

      <section className="landing-section landing-capabilities" id="workspace">
        <div className="landing-section-intro"><span className="landing-index">01 / THE WORKSPACE</span><h2>One platform for<br /><em>your gym operations.</em></h2><p>Manage member records, attendance, coaching and follow-ups from one workspace.</p></div>
        <div className="capability-list">
          <article className="capability-row"><span className="capability-icon"><Users size={21} /></span><div><h3>Member management</h3><p>Maintain member contact details, memberships and attendance records in a searchable directory.</p></div><span className="capability-number">01</span></article>
          <article className="capability-row"><span className="capability-icon"><ClipboardCheck size={21} /></span><div><h3>Attendance tracking</h3><p>Record member check-ins and review visit history by date.</p></div><span className="capability-number">02</span></article>
          <article className="capability-row"><span className="capability-icon"><Dumbbell size={21} /></span><div><h3>Coaching plans</h3><p>Create workout and nutrition plans, record progress and maintain coaching notes.</p></div><span className="capability-number">03</span></article>
          <article className="capability-row"><span className="capability-icon"><Bell size={21} /></span><div><h3>Member follow-ups</h3><p>Review attendance gaps and identify members for follow-up.</p></div><span className="capability-number">04</span></article>
          <article className="capability-row"><span className="capability-icon"><Activity size={21} /></span><div><h3>Team announcements</h3><p>Share encrypted announcements with trainers and members.</p></div><span className="capability-number">05</span></article>
        </div>
      </section>

      <section className="landing-process" id="how-it-works">
        <div className="process-heading"><span className="landing-index">02 / A SIMPLE ROUTINE</span><h2>A unified operations workspace.</h2><p>Tools for owners, administrators and trainers.</p></div>
        <div className="process-steps"><article><span>01</span><h3>Set up your gym</h3><p>Request a gym workspace for review.</p></article><article><span>02</span><h3>Bring in your team</h3><p>Manage staff access and assign roles.</p></article><article><span>03</span><h3>Keep the record current</h3><p>Maintain memberships, attendance and coaching records.</p></article></div>
      </section>

      <section className="landing-privacy" id="privacy" aria-labelledby="privacy-title">
        <div className="landing-privacy-intro"><span className="landing-index">03 / PRIVACY BASICS</span><h2 id="privacy-title">Privacy and access</h2><p>How gym and member information is handled.</p></div>
        <div className="landing-privacy-list">
          <article className="privacy-row"><span>01</span><div><h3>What we store and why</h3><p>Account and contact details, gym/member/staff records, memberships, attendance, follow-ups and coaching plans or progress. We use them to sign users in and run gym workspaces. Phone numbers are format-checked, not verified as real or owned.</p></div></article>
          <article className="privacy-row"><span>02</span><div><h3>Who can access it</h3><p>Gym owners, admins and trainers can access records for their gym according to their role. Members can see their own membership and shared coaching information. LiftDesk platform admins access the gym directory and owner support details for provisioning and support.</p></div></article>
          <article className="privacy-row"><span>03</span><div><h3>Who helps us provide LiftDesk</h3><p>Supabase provides sign-in and data storage; Google handles sign-in when you choose it; Cloudflare hosts the website. If you enable chat notifications, your browser’s push provider receives a generic alert and delivery endpoint. We do not sell personal information or use it for targeted ads.</p></div></article>
          <article className="privacy-row"><span>04</span><div><h3>How long we keep it</h3><p>Unpinned chat messages are deleted after 48 hours; pinned announcements remain while pinned. Most accounts and gym records have no automatic deletion timer and stay until separately deleted. Pausing or archiving a gym does not erase its records. <a href="/privacy">Read the full Privacy Notice</a> or email <a href="mailto:liftdesk11@gmail.com">liftdesk11@gmail.com</a>.</p></div></article>
        </div>
      </section>

      <section className="landing-faq" id="questions">
        <div className="faq-intro"><span className="landing-index">04 / GOOD TO KNOW</span><h2>Frequently asked<br /><em>questions.</em></h2><p>Platform features and access.</p><a href="/?mode=signin">Already have access? Sign in <ArrowUpRight size={15} /></a></div>
        <div className="faq-list">
          {[
            { q: 'How is attendance recorded?', a: 'Authorized staff record check-ins from the member directory.' },
            { q: 'Can different gyms see each other’s member records?', a: 'No. Member records are restricted to their gym workspace.' },
            { q: 'How does a new gym owner get access?', a: 'LiftDesk provisions owner access after workspace approval.' },
            { q: 'Can members log in to see coaching plans?', a: 'Yes. Linked members can view their membership, shared plans and progress updates.' },
          ].map((item, index) => <article className={'faq-item' + (faqOpen === index ? ' expanded' : '')} key={item.q}><button type="button" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(open => open === index ? null : index)}><span>{item.q}</span><ChevronDown size={18} /></button>{faqOpen === index && <p>{item.a}</p>}</article>)}
        </div>
      </section>

      <section className="landing-final-cta"><div><span className="landing-index">A CLEARER GYM WORKSPACE</span><h2>Manage your gym in one place.</h2><p>Request access to LiftDesk.</p></div><a className="landing-primary" href="/?mode=signup">Request access <ArrowRight size={17} /></a></section>
    </main>

    <footer className="landing-footer"><a className="landing-brand" href="/" aria-label="LiftDesk home"><LiftDeskMark size={40} /></a><span>Gym management platform.</span><nav aria-label="Footer navigation"><a href="#workspace">Workspace</a><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a><a href="#questions">Questions</a><a href="/privacy">Privacy Notice</a><a href="/terms">Terms of Service</a><a href="/?mode=signin">Sign in</a></nav><small>© {new Date().getFullYear()} LiftDesk</small></footer>
  </div>
}
