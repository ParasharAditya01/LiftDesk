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
      <a className="landing-brand" href="/" aria-label="LiftDesk home"><LiftDeskMark size={38} /><span>LiftDesk</span></a>
      <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      <nav className={'landing-nav' + (menuOpen ? ' is-open' : '')} id="landing-navigation" aria-label="Main navigation">
        {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={closeMenu}>{section.label}</a>)}
        <a className="landing-signin" href="/signin" onClick={closeMenu}>Sign in <ArrowUpRight size={15} /></a>
        <a className="landing-nav-cta" href="/?mode=signup" onClick={closeMenu}>Request a workspace <ArrowRight size={15} /></a>
      </nav>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> A calmer way to run your gym</div>
          <h1 id="landing-title">Good coaching starts with <em>good oversight.</em></h1>
          <p>Keep member records, attendance, coaching and follow-ups in one workspace your team can use every day.</p>
          <div className="landing-actions"><a className="landing-primary" href="/?mode=signup">Request owner access <ArrowRight size={17} /></a><a className="landing-secondary" href="#workspace">Take a look <ArrowDown size={15} /></a></div>
          <div className="landing-hero-foot"><span><Check size={14} /> Built around real gym workflows</span><span><Check size={14} /> Separate owner, admin and trainer roles</span></div>
        </div>

        <section className="product-preview" aria-label="Interactive LiftDesk product preview">
          <div className="preview-topline"><div className="preview-brand"><LiftDeskMark size={28} /><span>LiftDesk <small>WORKSPACE</small></span></div><span className="preview-state"><i /> SAMPLE PREVIEW</span></div>
          <div className="preview-welcome"><div><span className="preview-overline">YOUR GYM AT A GLANCE</span><h2>Today’s workspace</h2><p>A clear view of the work that needs your attention.</p></div><span className="preview-date">TODAY</span></div>
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
        <div className="landing-section-intro"><span className="landing-index">01 / THE WORKSPACE</span><h2>Less time piecing things together.<br /><em>More time with your members.</em></h2><p>LiftDesk brings the everyday details into view, so your team can spend less time searching and more time supporting the people who train with you.</p></div>
        <div className="capability-list">
          <article className="capability-row"><span className="capability-icon"><Users size={21} /></span><div><h3>A member record your team can find</h3><p>Keep contact details, membership information and attendance history together. Search by name or phone number when names are similar.</p></div><span className="capability-number">01</span></article>
          <article className="capability-row"><span className="capability-icon"><ClipboardCheck size={21} /></span><div><h3>Attendance with a clear record</h3><p>Staff can check a member in from the member list. The visit is saved to attendance history for the gym team to review.</p></div><span className="capability-number">02</span></article>
          <article className="capability-row"><span className="capability-icon"><Dumbbell size={21} /></span><div><h3>Coaching that stays connected</h3><p>Trainers can build member-specific workout and diet plans, add progress updates and keep dated coaching notes.</p></div><span className="capability-number">03</span></article>
          <article className="capability-row"><span className="capability-icon"><Bell size={21} /></span><div><h3>See who may need a follow-up</h3><p>Use each member’s latest attendance to spot longer gaps and decide who your team should check in with.</p></div><span className="capability-number">04</span></article>
          <article className="capability-row"><span className="capability-icon"><Activity size={21} /></span><div><h3>Keep gym conversations together</h3><p>Owner, admins, trainers and linked members can use the shared gym chat to stay in touch.</p></div><span className="capability-number">05</span></article>
        </div>
      </section>

      <section className="landing-process" id="how-it-works">
        <div className="process-heading"><span className="landing-index">02 / A SIMPLE ROUTINE</span><h2>One place for the day-to-day.</h2><p>Designed around how a gym team already works.</p></div>
        <div className="process-steps"><article><span>01</span><h3>Set up your gym</h3><p>An owner requests a workspace and shares the gym details for LiftDesk approval.</p></article><article><span>02</span><h3>Bring in your team</h3><p>Owners and admins manage staff access. Trainers work with members in their gym.</p></article><article><span>03</span><h3>Keep the record current</h3><p>Update memberships, record check-ins and keep coaching follow-ups moving.</p></article></div>
      </section>

      <section className="landing-faq" id="questions">
        <div className="faq-intro"><span className="landing-index">03 / GOOD TO KNOW</span><h2>Clear answers.<br /><em>No guesswork.</em></h2><p>What LiftDesk does today, in plain language.</p><a href="/signin">Already have access? Sign in <ArrowUpRight size={15} /></a></div>
        <div className="faq-list">
          {[
            { q: 'How is attendance recorded?', a: 'A staff member finds the person in Members and uses Manual check-in. LiftDesk records the visit after the membership and gym-access checks pass. Camera or member self-service QR check-in is not currently active.' },
            { q: 'Can different gyms see each other’s member records?', a: 'LiftDesk uses gym-scoped workspaces and database access policies. Team members should use the account and gym they were invited to.' },
            { q: 'How does a new gym owner get access?', a: 'The owner submits a workspace request from sign-up. LiftDesk reviews the request before the owner workspace is approved.' },
            { q: 'Can members log in to see coaching plans?', a: 'Yes. A linked member account can view its own membership details, shared diet and workout plans, and progress updates in the member portal.' },
          ].map((item, index) => <article className={'faq-item' + (faqOpen === index ? ' expanded' : '')} key={item.q}><button type="button" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(open => open === index ? null : index)}><span>{item.q}</span><ChevronDown size={18} /></button>{faqOpen === index && <p>{item.a}</p>}</article>)}
        </div>
      </section>

      <section className="landing-final-cta"><div><span className="landing-index">A CLEARER GYM WORKSPACE</span><h2>Bring the daily details together.</h2><p>Request LiftDesk owner access to get started.</p></div><a className="landing-primary" href="/?mode=signup">Request owner access <ArrowRight size={17} /></a></section>
    </main>

    <footer className="landing-footer"><a className="landing-brand" href="/" aria-label="LiftDesk home"><LiftDeskMark size={32} /><span>LiftDesk</span></a><span>Gym operations, simplified.</span><nav aria-label="Footer navigation"><a href="#workspace">Workspace</a><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><a href="/signin">Sign in</a></nav><small>© {new Date().getFullYear()} LiftDesk</small></footer>
  </div>
}
