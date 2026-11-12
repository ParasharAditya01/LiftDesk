import { useEffect } from 'react'
import { ArrowDown, ArrowUpRight, Mail, ShieldCheck } from 'lucide-react'
import LiftDeskMark from './LiftDeskMark'

const dataRows = [
  {
    data: 'Account and sign-in',
    examples: 'Name, email, account ID, sign-in provider and account status; accepted Terms and Privacy Notice versions and server-recorded acceptance times. Supabase Auth handles password credentials; LiftDesk does not store or read plain-text passwords.',
    purpose: 'Create and secure accounts, confirm sign-in, connect people to a gym role, record acceptance of current legal documents and help resolve account issues.',
    access: 'Supabase; LiftDesk for account administration and support; Google receives information when you choose Google sign-in.',
    retention: 'Until the account is separately deleted. LiftDesk has no automatic account deletion schedule. Browser session data remains until sign-out or expiry.',
  },
  {
    data: 'Gym and owner setup',
    examples: 'Gym name, city, gym and owner contact details, owner email, workspace status, approval/claim history and selected workspace settings.',
    purpose: 'Review and provision workspaces, connect owners, maintain the directory, provide support and manage workspace access.',
    access: 'The gym owner and authorized gym admins; LiftDesk platform admins for provisioning and support. Owner support phone is restricted to platform admins.',
    retention: 'While the workspace and related records exist. Pausing or archiving does not erase data; there is no automatic deletion timer.',
  },
  {
    data: 'Members and memberships',
    examples: 'Member name, email, phone and optional WhatsApp number, age, adult age-declaration timestamp, membership dates, plan, fee, status, notes and QR check-in token.',
    purpose: 'Maintain a gym member directory, manage membership and access, contact members and record visits.',
    access: 'Authorized owner, admin and trainer accounts in that gym. Members can see their own membership information.',
    retention: 'Until the gym separately deletes the relevant records. No automatic day-based purge is configured.',
  },
  {
    data: 'Staff and attendance',
    examples: 'Staff name, role, contact information, joining date and status; member or staff check-in time, method and recording account.',
    purpose: 'Manage team access and work status, record attendance and prepare gym activity reports.',
    access: 'Authorized gym staff according to role. Members do not receive the staff directory or staff attendance records.',
    retention: 'Until separately deleted with the relevant staff, member or workspace record. No automatic day-based purge is configured.',
  },
  {
    data: 'Follow-ups and coaching',
    examples: 'Follow-up type, status, due date and notes; workout or diet plans, goals, progress measurements, feedback and trainer observations.',
    purpose: 'Help gym staff manage member follow-ups, share coaching plans and record progress when the gym chooses to use these features.',
    access: 'Authorized owners, admins and trainers in that gym; members can see their own shared plans and progress.',
    retention: 'Until separately deleted with the related member or workspace records. No automatic day-based purge is configured.',
  },
  {
    data: 'Gym chat and device keys',
    examples: 'Encrypted message content, sender and gym IDs, timestamps, pin status, public device keys, and private chat keys stored in that browser’s IndexedDB.',
    purpose: 'Deliver gym messages to registered devices while limiting message access to intended participants.',
    access: 'Chat participants can read encrypted messages on registered devices. LiftDesk stores encrypted message envelopes and related metadata.',
    retention: 'Unpinned messages are deleted after 48 hours. Pinned messages remain while pinned; after unpinning, the 48-hour age rule applies. Device keys remain until revoked or related records are removed.',
  },
  {
    data: 'Invitations and workspace requests',
    examples: 'Invited email, invitation creator, hashed one-time token, expiry and use status; workspace request contact details and review status.',
    purpose: 'Invite the intended person, prevent invitation reuse and review workspace requests.',
    access: 'Relevant gym staff and invited account; LiftDesk platform admins review workspace requests and provision gyms.',
    retention: 'Invitation links expire after 48 hours or when used/revoked. Invitation and request records have no automatic deletion schedule.',
  },
  {
    data: 'Optional push notifications',
    examples: 'Browser push endpoint and keys for an opted-in account and gym; delivery status. Alerts contain generic new-message text, not chat content.',
    purpose: 'Send an alert when a gym chat message arrives.',
    access: 'Supabase and the browser/platform push service addressed by your subscription.',
    retention: 'Until notifications are disabled, the subscription is removed, or the push service rejects the endpoint. Expired endpoints are removed when detected.',
  },
]

const privacyEmail = (subject: string) => `mailto:liftdesk11@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent('Please tell us your name, account email, gym (if applicable), and the privacy request you want to make. Do not include passwords or sensitive health details.')}`

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Notice | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'See the personal information LiftDesk stores, why it is used, who can access it, and how long it is kept.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://liftdesk.pages.dev/privacy')
  }, [])

  return <div className="terms-page privacy-page">
    <header className="terms-header">
      <a href="/" aria-label="LiftDesk home"><LiftDeskMark size={42} /></a>
      <a className="terms-home-link" href="/">Back to LiftDesk</a>
    </header>
    <main className="privacy-main">
      <article className="privacy-document">
        <section className="privacy-hero" aria-labelledby="privacy-title">
          <div className="privacy-hero-copy">
            <p className="privacy-overline">LIFTDESK · PRIVACY NOTICE</p>
            <h1 id="privacy-title">Your information,<br />clearly accounted for.</h1>
            <p className="privacy-lede">What the service stores, why it is needed, who may access it and how long it stays.</p>
            <p className="privacy-updated">Last updated 10 November 2026</p>
          </div>
          <a className="privacy-jump" href="#your-data">See the data details <ArrowDown size={16} /></a>
        </section>

        <section className="privacy-responsibility" aria-labelledby="privacy-responsibility-title">
          <div><span className="privacy-section-index">01</span><h2 id="privacy-responsibility-title">Who decides how records are used?</h2></div>
          <div className="privacy-responsibility-copy">
            <p>Your gym chooses which member and staff records it enters, why it needs them for gym operations, and which staff roles can access them. LiftDesk provides the software, hosting and support tools. Ask the gym about records it entered; contact LiftDesk about your login account, platform use or a privacy request.</p>
            <p>LiftDesk is operated by Aditya Parashar in India. Gym phone numbers are checked for format only; LiftDesk does not currently verify that a number exists, is active or belongs to the person named.</p>
          </div>
        </section>

        <section id="your-data" className="privacy-data-section" aria-labelledby="privacy-data-title">
          <div className="privacy-section-heading">
            <div><span className="privacy-section-index">02</span><h2 id="privacy-data-title">Data, purpose and retention</h2></div>
            <p>Retention below describes the current product. Where there is no timer, we say so plainly.</p>
          </div>
          <div className="privacy-record-list">
            {dataRows.map((row, index) => <article className="privacy-record" key={row.data}>
              <div className="privacy-record-heading"><span>{String(index + 1).padStart(2, '0')}</span><h3>{row.data}</h3></div>
              <div className="privacy-record-grid">
                <div><h4>What we store</h4><p>{row.examples}</p></div>
                <div><h4>Why we use it</h4><p>{row.purpose}</p></div>
                <div><h4>Who can access it</h4><p>{row.access}</p></div>
                <div><h4>How long we keep it</h4><p>{row.retention}</p></div>
              </div>
            </article>)}
          </div>
          <p className="privacy-retention-note"><ShieldCheck size={19} /><span><b>Pausing or archiving a gym does not delete its records.</b> LiftDesk has no automatic deletion timer for most accounts, member/staff records, attendance, coaching records, requests or archived workspaces. Ask the gym to remove records it controls, or contact LiftDesk about account and service data. Requests are reviewed and coordinated where appropriate.</span></p>
        </section>

        <section className="privacy-sharing" aria-labelledby="privacy-sharing-title">
          <div className="privacy-section-heading">
            <div><span className="privacy-section-index">03</span><h2 id="privacy-sharing-title">Who helps provide LiftDesk?</h2></div>
            <p>We use service providers to run the website and gym workspace. We do not sell personal information or use it for targeted advertising.</p>
          </div>
          <div className="privacy-provider-grid">
            <article><h3>Supabase</h3><p>Authentication, database storage, realtime delivery and server functions. Its infrastructure subprocessors may also process data.</p><a href="https://supabase.com/legal/customer-resources/subprocessor-list" target="_blank" rel="noreferrer">View subprocessors <ArrowUpRight size={14} /></a></article>
            <article><h3>Google</h3><p>Receives sign-in information when you choose Google sign-in. LiftDesk receives account details made available by Google.</p><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy <ArrowUpRight size={14} /></a></article>
            <article><h3>Cloudflare</h3><p>Hosts and delivers the website and may process connection and request details needed to deliver and secure it. Provider log retention is not controlled by LiftDesk.</p><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare Privacy Policy <ArrowUpRight size={14} /></a></article>
            <article><h3>Browser push services</h3><p>Receive a delivery endpoint and generic notification request only when you enable chat notifications.</p><span>Optional feature · can be disabled in browser settings</span></article>
          </div>
          <p className="privacy-provider-footnote">The public site and workspace no longer load Google Fonts or Unsplash images from their servers. Your browser still sends the requests needed to load LiftDesk and, when signed in, the configured Supabase service.</p>
        </section>

        <section className="privacy-rights" aria-labelledby="privacy-rights-title">
          <div className="privacy-rights-copy"><span className="privacy-section-index">04</span><h2 id="privacy-rights-title">Questions, requests or a concern?</h2><p>You can ask for access to your information, correction, deletion where applicable, or withdraw consent. For gym records, contact your gym first; for account and LiftDesk service data, contact us. Include the account email and gym name so we can identify the right records. Do not email passwords or sensitive health details.</p><p>We will review requests and coordinate with the gym where it controls the records. Workspace archive is not deletion. You may raise an unresolved grievance with the Data Protection Board of India after contacting us; see <a href="https://www.meity.gov.in/digital-personal-data-protection-act" target="_blank" rel="noreferrer">the Ministry’s DPDP information page</a> for current official guidance.</p><a className="privacy-email-link" href="mailto:liftdesk11@gmail.com"><Mail size={17} /> liftdesk11@gmail.com</a></div>
          <div className="privacy-request-actions" aria-label="Email LiftDesk about a privacy request">
            <a href={privacyEmail('LiftDesk privacy request: access my information')}>Access my information <ArrowUpRight size={15} /></a>
            <a href={privacyEmail('LiftDesk privacy request: correct information')}>Correct information <ArrowUpRight size={15} /></a>
            <a href={privacyEmail('LiftDesk privacy request: delete information')}>Request deletion <ArrowUpRight size={15} /></a>
            <a href={privacyEmail('LiftDesk privacy request: withdraw consent or raise a concern')}>Withdraw consent or raise a concern <ArrowUpRight size={15} /></a>
            <a href={privacyEmail('LiftDesk privacy request: nominate a representative')}>Nominate someone to act for me <ArrowUpRight size={15} /></a>
          </div>
        </section>

        <section className="privacy-security" aria-labelledby="privacy-security-title">
          <h2 id="privacy-security-title">Security and account choices</h2>
          <p>Database access rules restrict workspace records by gym and role. New gym chat messages are encrypted on registered devices before storage; older messages may not be encrypted. A message already delivered to a participant’s device cannot be recalled. Turn off browser push notifications in Gym Chat or in your browser settings.</p>
          <p>New member accounts are intended for adults aged 18 and over. Signup asks for an age declaration and does not independently verify age or identity. Existing member records are not automatically removed by this change.</p>
        </section>

        <section className="privacy-contact" aria-label="Privacy contact">
          <div><span>Privacy contact</span><b>Aditya Parashar · India</b></div>
          <a href="mailto:liftdesk11@gmail.com">Email Liftdesk <ArrowUpRight size={15} /></a>
        </section>
      </article>
    </main>
    <footer className="terms-footer"><a href="/">LiftDesk</a><a href="/terms">Terms of Service</a></footer>
  </div>
}
