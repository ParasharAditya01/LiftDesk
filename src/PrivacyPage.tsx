import { useEffect } from 'react'
import { ArrowDown, ArrowUpRight, Mail, ShieldCheck } from 'lucide-react'
import LiftDeskMark from './LiftDeskMark'

const dataRows = [
  {
    data: 'Accounts, sign-in and consent',
    examples: 'Name, email address, authentication account ID, sign-in provider and account status; accepted Terms and Privacy Notice versions and timestamps. Member registration also records the age information and adult declaration supplied by the member. Supabase Auth handles passwords; LiftDesk does not store or read plain-text passwords.',
    purpose: 'Create and secure accounts, sign users in, connect accounts to invitations and gym roles, record policy acceptance, apply the 18+ member registration requirement and resolve account issues.',
    access: 'The account holder; Supabase for authentication; authorized LiftDesk administrators for platform provisioning and support. Google receives information when you choose Google sign-in.',
    retention: 'Accounts and legal acceptance history have no automatic deletion timer. Each accepted document version is retained as a separate record. Contact LiftDesk to request account deletion. Authentication session data is kept in your browser until sign-out or expiry.',
  },
  {
    data: 'Gym workspaces and owner requests',
    examples: 'Gym name, city, gym phone and theme; owner name, email and support phone; workspace request details, approval status, review notes, owner claim and access status; platform notices sent to owners and whether they were read.',
    purpose: 'Review requests, create and connect workspaces to owners, administer access and themes, send selected owners in-app notices, provide support and produce platform-level workspace summaries.',
    access: 'The gym owner and authorized gym staff see workspace information needed for their roles. LiftDesk platform administrators can access the gym directory, owner request and support details, workspace status, staff/member totals and latest recorded attendance time. Owner support phone is restricted to platform administrators.',
    retention: 'There is no automatic deletion timer for requests or workspace records. Pausing preserves gym records. A platform administrator can permanently delete a workspace and its gym-scoped records; separate sign-in accounts and records that must be retained independently may remain.',
  },
  {
    data: 'Members and memberships',
    examples: 'Name, email, phone, optional WhatsApp number, age and adult declaration; joining and expiry dates, membership plan, monthly fee and status; member account link and QR check-in token. Members may provide optional weight and height for their member profile.',
    purpose: 'Maintain a gym’s member directory, manage memberships and invitations, support check-ins, prepare follow-up views and show a member their own membership details.',
    access: 'Authorized Owners, Admins and Trainers in that gym according to their roles. A member can view their own membership and personal details.',
    retention: 'Until the gym removes the member record or the gym workspace is deleted. Member records have no automatic deletion timer.',
  },
  {
    data: 'Staff and attendance',
    examples: 'Staff name, assigned role, staff code, phone, email, optional photo link and notes, joining date, employment status and invitations. Attendance includes member check-in date/time, method (manual or QR) and recording account, plus staff attendance date, status, note and recording account.',
    purpose: 'Manage gym team access and employment records, record member visits and staff attendance, and prepare attendance history and reports.',
    access: 'Owners and authorized Admins manage staff records; authorized gym staff access attendance according to role. Members do not see the staff directory or staff attendance. Platform administrators see staff totals and the latest attendance time in platform summaries.',
    retention: 'Until the gym removes the relevant record or the gym workspace is deleted. Attendance and staff records have no automatic deletion timer.',
  },
  {
    data: 'Follow-ups, coaching and progress',
    examples: 'Membership expiry and visit history used to identify follow-up items; follow-up type, status, due date and notes; diet preferences, meal schedules, goals, restrictions, allergies and nutrition estimates; workout schedules and exercise details; coaching notes and reusable templates; weight, body measurements, milestones, workout notes, member feedback and trainer observations.',
    purpose: 'Show membership and attendance follow-up items, create and share coaching plans, keep coaching notes and track progress when a gym chooses to use these tools. Follow-up views do not automatically message members.',
    access: 'Authorized Owners, Admins and Trainers in that gym. Members can view their own shared diet/workout plans and progress, but not private staff coaching notes.',
    retention: 'Until the gym removes the relevant member or coaching records, or the gym workspace is deleted. These records have no automatic deletion timer.',
  },
  {
    data: 'Gym Chat and registered devices',
    examples: 'Message text stored as an encrypted envelope for new messages, sender and gym IDs, timestamps and pin status; device IDs and public encryption keys. A device’s private chat key is stored in that browser’s IndexedDB. Older messages created before encryption may remain unencrypted until removed.',
    purpose: 'Deliver shared gym chat to active workspace participants and encrypt new messages for registered participant devices.',
    access: 'Owners, Admins, Trainers and Members in the gym can read messages; only Owners and Admins can send and pin them. LiftDesk’s database stores new message ciphertext and metadata, while private device keys remain in the browser.',
    retention: 'Unpinned messages are removed after 48 hours. Pinned messages remain while pinned; once unpinned, messages older than 48 hours are eligible for removal. Device keys stay in browser storage until removed there; registered public keys remain until the device is revoked or related workspace records are deleted.',
  },
  {
    data: 'Invitations and access changes',
    examples: 'Invited email or account, gym and assigned role, invitation creator, hashed one-time token, expiry and use status; staff role and access changes.',
    purpose: 'Send single-use member and staff invitations, link the intended account to the correct gym and role, and manage access changes.',
    access: 'The relevant gym Owners and Admins and the invited account; LiftDesk platform administrators can review owner workspace requests and administer workspaces.',
    retention: 'Invitation links expire after 48 hours or when used or revoked. Invitation and access-event records have no automatic deletion timer and remain until separately removed with the workspace or related record.',
  },
  {
    data: 'Optional browser push alerts',
    examples: 'Push endpoint and delivery keys for a device that enables notifications, plus delivery status. Chat alerts use generic text and do not include the message content.',
    purpose: 'Deliver an optional alert when a gym chat message arrives, where browser support, permission and service configuration allow it.',
    access: 'LiftDesk’s Supabase service and the browser or device push service addressed by the subscription.',
    retention: 'Until you disable notifications or remove the subscription, or the push service reports that it is no longer valid. Expired endpoints are removed when detected.',
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
            <p className="privacy-lede">What LiftDesk and your gym store, why it is used, who may access it and how long it stays.</p>
            <p className="privacy-updated">Version 2.0 · Last updated 12 November 2026</p>
          </div>
          <a className="privacy-jump" href="#your-data">See the data details <ArrowDown size={16} /></a>
        </section>

        <section className="privacy-responsibility" aria-labelledby="privacy-responsibility-title">
          <div><span className="privacy-section-index">01</span><h2 id="privacy-responsibility-title">Who decides how records are used?</h2></div>
          <div className="privacy-responsibility-copy">
            <p>Your gym decides which member and staff records to enter and which of its authorized roles may use them. LiftDesk provides the website and workspace software, hosting and platform support. Ask your gym about records it entered; contact LiftDesk about your account, owner request, platform administration or a privacy request. See the <a href="/terms">Terms of Service</a>, proposed <a href="/data-processing">Data Processing Agreement</a> and <a href="/acceptable-use">Acceptable Use Policy</a>.</p>
            <p>The interactive preview on the public website uses illustrative sample records and is not populated with live gym or member data.</p>
            <p>LiftDesk platform administrators review gym requests, provision and manage workspaces, pause or resume access, and may permanently delete gym-scoped records. They can access the platform directory, owner request and support details, workspace status, staff/member totals, and latest attendance time for platform administration. LiftDesk is operated by Aditya Parashar in India.</p>
          </div>
        </section>

        <section id="your-data" className="privacy-data-section" aria-labelledby="privacy-data-title">
          <div className="privacy-section-heading">
            <div><span className="privacy-section-index">02</span><h2 id="privacy-data-title">Information, use and retention</h2></div>
            <p>The categories below reflect current LiftDesk features. Where there is no automatic deletion timer, we say so plainly.</p>
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
          <p className="privacy-retention-note"><ShieldCheck size={19} /><span><b>Pausing a gym does not delete its records.</b> Most accounts, requests, legal acceptance history, member/staff records, attendance and coaching records have no automatic deletion timer. A platform administrator’s permanent workspace deletion removes gym-scoped records from the active database; separate sign-in accounts and records that must be retained independently may remain. Provider backups or logs may follow provider retention periods. Ask your gym about records it controls, or contact LiftDesk about your account and platform data.</span></p>
        </section>

        <section className="privacy-sharing" aria-labelledby="privacy-sharing-title">
          <div className="privacy-section-heading">
            <div><span className="privacy-section-index">03</span><h2 id="privacy-sharing-title">Who helps provide LiftDesk?</h2></div>
            <p>We use service providers to run sign-in, data storage, realtime workspace features and website delivery. We do not sell personal information or use it for targeted advertising.</p>
          </div>
          <div className="privacy-provider-grid">
            <article><h3>Supabase</h3><p>Authentication, database storage, realtime workspace features and server functions, including chat push delivery where configured. Its infrastructure subprocessors may also process data.</p><a href="https://supabase.com/legal/customer-resources/subprocessor-list" target="_blank" rel="noreferrer">View subprocessors <ArrowUpRight size={14} /></a></article>
            <article><h3>Google</h3><p>Receives sign-in information when you choose Google sign-in. LiftDesk receives account details made available through that sign-in.</p><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy <ArrowUpRight size={14} /></a></article>
            <article><h3>Cloudflare</h3><p>Hosts and delivers the website and may process connection and request details needed to deliver and secure it. Provider logging and retention are not controlled by LiftDesk.</p><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare Privacy Policy <ArrowUpRight size={14} /></a></article>
            <article><h3>Browser and device push services</h3><p>May receive a device subscription endpoint, delivery keys and a generic notification when you enable chat alerts and your browser supports them.</p><span>Optional feature · can be disabled in LiftDesk or browser settings</span></article>
          </div>
          <p className="privacy-provider-footnote">When you sign in, your browser stores the authentication session needed to keep you signed in. Chat’s private encryption keys are kept in this browser’s IndexedDB. If you email LiftDesk, your email provider also processes the message you send.</p>
        </section>

        <section className="privacy-rights" aria-labelledby="privacy-rights-title">
          <div className="privacy-rights-copy"><span className="privacy-section-index">04</span><h2 id="privacy-rights-title">Questions, requests or a concern?</h2><p>Depending on applicable law, you may ask to access, correct or delete your information, withdraw consent or raise a privacy concern. For member and staff records entered by a gym, contact that gym first; for your LiftDesk account, owner request or platform data, contact us. Include the account email and gym name so we can identify the relevant records. Do not email passwords or sensitive health details.</p><p>We will review requests, verify the requester where appropriate and coordinate with the gym when it controls the records. Workspace pause is not deletion; the product has no separate archive control. Rights, timelines and complaint routes depend on the law in effect where you are. See <a href="https://www.meity.gov.in/digital-personal-data-protection-act" target="_blank" rel="noreferrer">the Ministry of Electronics and IT’s DPDP information page</a> for official information.</p><a className="privacy-email-link" href="mailto:liftdesk11@gmail.com"><Mail size={17} /> liftdesk11@gmail.com</a></div>
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
          <p>Database access policies restrict workspace records by gym and assigned role. New Gym Chat messages are encrypted on registered devices before storage; the server stores encrypted message envelopes and public device keys, while private keys stay in browser storage. Messages created before this encryption was introduced may remain unencrypted. A message delivered to a participant’s device cannot be recalled. Unpinned messages are removed after 48 hours; pinned messages remain until unpinned and are then removed under the same age rule.</p>
          <p>We use safeguards but cannot guarantee that information will never be accessed, disclosed, altered or lost without authorization. To the extent permitted by applicable law, LiftDesk is not responsible for a breach caused by a gym operator or user, a compromised account or device, a third-party service, or an event outside our reasonable control. This statement does not remove any responsibility or breach-notification duty that applicable law requires LiftDesk to meet.</p>
          <p>New member accounts are intended for people aged 18 and over. Registration requires an age declaration, but LiftDesk does not independently verify age or identity. Gym staff enter member and staff information; they are responsible for using the workspace appropriately and managing who can access those records. Turn off optional browser push alerts in Gym Chat or your browser settings.</p>
        </section>

        <nav className="legal-related" aria-label="Related legal documents"><a href="/terms">Terms of Service</a><a href="/data-processing">Data Processing Agreement</a><a href="/acceptable-use">Acceptable Use Policy</a></nav>
        <section className="privacy-contact" aria-label="Privacy contact">
          <div><span>Privacy contact</span><b>Aditya Parashar · India</b></div>
          <a href="mailto:liftdesk11@gmail.com">Email Liftdesk <ArrowUpRight size={15} /></a>
        </section>
      </article>
    </main>
    <footer className="terms-footer"><a href="/">LiftDesk</a><a href="/terms">Terms of Service</a></footer>
  </div>
}
