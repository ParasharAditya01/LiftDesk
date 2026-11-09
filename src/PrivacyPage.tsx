import { useEffect } from 'react'
import LiftDeskMark from './LiftDeskMark'

const dataRows = [
  {
    data: 'Account and sign-in',
    examples: 'Name, email address, account ID, authentication provider and account status. For password sign-in, Supabase Auth handles the credential; LiftDesk does not store or read your plain-text password. Sign-in sessions are stored in your browser.',
    purpose: 'Create accounts, confirm identity, sign you in, link you to a gym role, and protect workspace access.',
    access: 'Supabase Auth; LiftDesk for account support; the Google account provider when you choose Google sign-in.',
    retention: 'Account record: until separately deleted; LiftDesk has no automatic account deletion schedule. Browser session: until sign-out or session expiry.',
  },
  {
    data: 'Gym and owner setup',
    examples: 'Gym name, city, gym contact number, owner name, owner email, owner mobile number, workspace theme, approval/claim status and workspace status.',
    purpose: 'Review and create gym workspaces, connect the owner, maintain LiftDesk’s internal gym directory, provide support and control access.',
    access: 'The gym owner and authorized gym admins; LiftDesk platform admins for provisioning and support. Owner support phone is restricted to platform admins.',
    retention: 'While the workspace exists and until records are separately deleted. Pausing or archiving does not automatically delete these records.',
  },
  {
    data: 'Member and membership records',
    examples: 'Name, phone, WhatsApp number, email, age, height, weight, membership dates, plan, status, fee amount, notes and a QR check-in token.',
    purpose: 'Maintain the gym directory, manage memberships, contact members, determine access/expiry, and record attendance.',
    access: 'Authorized staff in that gym (including owners, admins and trainers); a signed-in member can view their own membership details.',
    retention: 'Until the gym separately deletes the member record or related records. There is no automatic day-based purge for these records.',
  },
  {
    data: 'Staff and staff attendance',
    examples: 'Staff name, code, role, phone, email, joining date, employment status, optional photo link and notes; attendance date/status and who recorded it.',
    purpose: 'Manage gym staff, assign workspace access, maintain employment records and track staff attendance.',
    access: 'The gym owner and authorized admins; admin access to trainer records is limited by role. Linked staff accounts receive their assigned workspace role.',
    retention: 'Until the gym separately deletes the staff or attendance record. No automatic day-based purge is configured.',
  },
  {
    data: 'Member attendance and follow-ups',
    examples: 'Check-in date/time, method, recording staff account, visit history, follow-up type/status/due date and notes.',
    purpose: 'Track visits, show attendance reports, identify membership or attendance follow-ups, and support gym operations.',
    access: 'Authorized staff in the same gym. Members do not receive the staff attendance directory.',
    retention: 'Until separately deleted with the relevant gym/member records. The app’s 30-day report view is not a 30-day deletion rule.',
  },
  {
    data: 'Coaching and progress',
    examples: 'Workout and diet plans, goals, dates, exercises/plan details, body weight and measurements, milestones, feedback, coaching observations and trainer notes.',
    purpose: 'Let trainers prepare and update plans, record progress, and show members the plans and progress shared with them.',
    access: 'Authorized owners, admins and trainers in the gym; members can view their own progress and plans that are published to them.',
    retention: 'Until separately deleted with the member or workspace records. No automatic day-based purge is configured.',
  },
  {
    data: 'Gym chat and encryption devices',
    examples: 'Encrypted message content, sender/account and gym IDs, timestamps, pin status, and a public encryption key for each registered device. Private chat keys stay in that browser’s IndexedDB until browser storage is cleared.',
    purpose: 'Deliver gym announcements and messages to registered gym devices while limiting access to intended participants.',
    access: 'Chat participants in the same gym can read encrypted messages on registered devices. LiftDesk stores the encrypted message envelope and metadata.',
    retention: 'Unpinned messages are automatically deleted after 48 hours. Pinned announcements remain while pinned; after unpinning, the 48-hour age rule applies. Server-side device keys remain until revoked or related records are removed.',
  },
  {
    data: 'Invitations and workspace requests',
    examples: 'Invited email, invitation creator, hashed one-time token, expiry/use/revocation status; owner request name, email, phone, gym details and review status.',
    purpose: 'Invite the correct person to a gym, prevent reuse of links, review new workspace requests and provision approved gyms.',
    access: 'Relevant gym owner/admins and invited account; LiftDesk platform admins review workspace requests and provisions.',
    retention: 'Invitation links expire after 48 hours (staff and member invites) or when used/revoked. Invitation status records and owner request records have no automatic deletion schedule.',
  },
  {
    data: 'Optional chat push notifications',
    examples: 'Browser push endpoint and encryption keys associated with an opted-in account and gym; delivery status. The push text is a generic new-message alert, not the chat message.',
    purpose: 'Send a browser notification when a gym chat message arrives.',
    access: 'Supabase and the push service addressed by your browser subscription (such as the browser/platform push provider).',
    retention: 'Until you turn notifications off, remove the subscription, or the push service rejects the endpoint. Expired endpoints are removed when detected.',
  },
]

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Notice | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'What information LiftDesk stores, why it is used, how long it is kept, and who can receive it.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://liftdesk.pages.dev/privacy')
  }, [])

  return <div className="terms-page privacy-page">
    <header className="terms-header">
      <a href="/" aria-label="LiftDesk home"><LiftDeskMark size={42} /></a>
      <a className="terms-home-link" href="/">Back to LiftDesk</a>
    </header>
    <main className="terms-main privacy-main">
      <article className="terms-document privacy-document">
        <p className="terms-updated">Last updated 10 November 2026</p>
        <h1>Privacy Notice</h1>
        <p className="terms-lede">A clear view of the information LiftDesk stores, why it is used, how long it is kept, and who may receive it.</p>

        <section className="terms-section privacy-intro-section">
          <h2>Who handles your information</h2>
          <p>LiftDesk is operated by Aditya Parashar. A gym decides what member and staff information it enters and which people it authorizes to use its workspace. LiftDesk provides the software and processes workspace information to operate it and provide support.</p>
          <p>Some information describes a person, such as a name, email, phone number, account ID or attendance record. Coaching entries may also include body measurements, nutrition details or other personal notes. Gym operators should enter only information needed to run their gym and coach members. Phone numbers are entered by users or gym staff; LiftDesk currently checks format only and does not verify that a number exists, is active, or belongs to that person.</p>
        </section>

        <section className="terms-section privacy-data-section" aria-labelledby="privacy-data-title">
          <h2 id="privacy-data-title">What we store, why, access and retention</h2>
          <p>Retention below describes LiftDesk’s current application behavior. Most workspace records have no automatic deletion timer; archiving or pausing a gym does not erase them. Where no number of days is configured, the table says so rather than implying a fixed deadline.</p>
          <div className="privacy-table-wrap" role="region" aria-label="LiftDesk data use and retention table" tabIndex={0}>
            <table className="privacy-data-table">
              <thead><tr><th scope="col">Data</th><th scope="col">Examples stored</th><th scope="col">Why we use it</th><th scope="col">Who may receive or access it</th><th scope="col">How long</th></tr></thead>
              <tbody>{dataRows.map(row => <tr key={row.data}><th scope="row">{row.data}</th><td>{row.examples}</td><td>{row.purpose}</td><td>{row.access}</td><td>{row.retention}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="privacy-retention-note"><b>Important:</b> LiftDesk currently has no fixed deletion period for accounts, gym directories, member and staff records, attendance, follow-ups, coaching records, or archived workspaces. They remain until separately deleted. Contact the gym owner/admin about gym records, or LiftDesk about an account or deletion request. A request is not an automatic deletion command; we will review it and coordinate with the gym where appropriate.</p>
        </section>

        <section className="terms-section">
          <h2>Service providers and sharing</h2>
          <p>LiftDesk shares data with service providers only as needed to run the product:</p>
          <ul className="privacy-provider-list">
            <li><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a> provides authentication, database storage, realtime chat delivery and server functions. Workspace data is stored and processed through the Supabase project configured for LiftDesk. Supabase may use its infrastructure subprocessors; see its <a href="https://supabase.com/legal/customer-resources/subprocessor-list" target="_blank" rel="noreferrer">current subprocessor list</a>.</li>
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> receives information under Google’s own policies when you choose Google sign-in. LiftDesk receives account information made available by that sign-in, such as your account email and provider account ID.</li>
            <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare</a> hosts and delivers the public website. Like other web hosts, it may process connection and request data needed to deliver and secure the site; LiftDesk has no app-configured day count for provider infrastructure logs.</li>
            <li>Your browser’s push notification provider receives a notification request and delivery endpoint only if you enable chat notifications. The notification contains a generic new-message alert, not the gym chat text.</li>
          </ul>
          <p>Gym information is also shared inside the relevant workspace with the roles described in the table. LiftDesk platform administrators may access gym directory and owner support information when provisioning or supporting workspaces. LiftDesk does not sell personal information or use it for targeted advertising.</p>
        </section>

        <section className="terms-section">
          <h2>Security and your choices</h2>
          <p>LiftDesk uses role-based database access rules to limit workspace records by gym and account role. New gym chat messages are encrypted on registered devices before storage; older chat messages created before that encryption feature may not be encrypted and are subject to the chat retention rule above. A message already delivered to a participant’s device cannot be recalled from that device.</p>
          <p>You can ask your gym to correct or remove information it manages. You can turn off browser push notifications in Gym Chat or your browser settings. For account access, privacy, or deletion requests, email <a href="mailto:liftdesk11@gmail.com">liftdesk11@gmail.com</a>. Please identify the account and gym involved, and do not email passwords or sensitive health details.</p>
        </section>

        <section className="terms-section">
          <h2>Changes and contact</h2>
          <p>We may update this notice as LiftDesk changes. The latest version and date will be posted here. LiftDesk is operated by Aditya Parashar in India. Privacy questions and requests can be sent to <a href="mailto:liftdesk11@gmail.com">liftdesk11@gmail.com</a>.</p>
        </section>
      </article>
    </main>
    <footer className="terms-footer"><a href="/">LiftDesk</a><a href="/terms">Terms of Service</a></footer>
  </div>
}
