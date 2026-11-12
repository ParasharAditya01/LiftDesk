import { useEffect } from 'react'
import LiftDeskMark from './LiftDeskMark'

const sections = [
  ['About these Terms', [
    'LiftDesk is a gym operations web application operated by Aditya Parashar in India. These Terms apply to visitors and people who register for, are invited to, or use LiftDesk. By using the Services, you agree to these Terms. The Privacy Notice at /privacy explains personal information handling and forms part of LiftDesk’s legal documents.',
    '“Gym” means a gym or fitness business using LiftDesk. “Gym Owner” means the person who owns or is authorised to represent a Gym in its Workspace. “Administrator” means a gym staff user assigned the admin role. “Trainer” means gym staff assigned the trainer role. “Member” means a person whose membership is recorded by a Gym and who may have a member account. “Workspace” means the LiftDesk area and records associated with one Gym. “User” means anyone who visits or uses the Services. “Services” means the LiftDesk website, application, workspace tools and related support. “Gym Data” means information a Gym or its users submit to a Workspace. “Personal Data” has the meaning given by applicable law.',
  ]],
  ['Accounts and eligibility', [
    'Provide accurate information and keep it current. A Gym Owner must be authorised to represent the Gym. Where Google sign-in is required or offered for a role, use the Google account assigned to that role. Protect sign-in credentials and devices, do not share or impersonate accounts, and promptly contact liftdesk11@gmail.com if you suspect unauthorised access. LiftDesk does not independently verify every Gym, member or user identity. LiftDesk may reasonably restrict an account to address a security concern or comply with law.',
    'Member registration is intended for people aged 18 or older and requires an age declaration; LiftDesk does not independently verify age. Invitation links are intended for the invited person, are single-use and expire after 48 hours.',
  ]],
  ['Workspace access and permissions', [
    'A Gym Owner is responsible for the Gym Workspace, authorising appropriate administrators and assigning authorised users. An Administrator may perform the gym-management actions allowed by the assigned role and must respect those permissions. A Trainer may use the features and records available to the trainer role and must not access information beyond that authorisation. A Member may access information the Gym makes available to that member and must not try to access another person’s or Gym’s private records. Owners and Administrators are responsible for granting and periodically reviewing staff access. Actual access is also controlled by the application’s role-based permissions and database policies.',
    'LiftDesk platform administrators can review owner requests, provision and administer workspaces, pause or resume workspace access, permanently delete a workspace and its gym-scoped records, and send in-app notices to selected Gym Owners. Pausing preserves records and blocks workspace access. Permanent workspace deletion removes gym-scoped records from the active database; separate sign-in accounts and records retained independently may remain. There is no separate archive control.',
  ]],
  ['Acceptable use', [
    'Use LiftDesk only as authorised and lawfully. You must not access another Gym’s Workspace or another user’s private records without authority; share credentials or impersonate someone; manipulate or falsify attendance; make unauthorised changes to membership records; upload unlawful material; collect or disclose personal information without authority; copy, resell or redistribute LiftDesk; interfere with its security or operation; scrape or automate access abusively; introduce malicious code; exploit vulnerabilities; bypass Gym-level controls; or conduct security testing without written authorisation. These restrictions apply subject to rights that cannot be limited by law. See the [Acceptable Use Policy](/acceptable-use).',
  ]],
  ['Gym Data, ownership and processing', [
    'The Gym decides what member and staff information to collect and is responsible for an appropriate lawful basis, required notices and permissions or consent, accuracy, staff access, Gym-controlled corrections and requests, and avoiding unnecessary or sensitive information. The Gym retains its rights in its business records and Gym Data, including its member database.',
    'LiftDesk provides and maintains the software service, processes information to operate and support it, applies technical and organisational safeguards, handles information under applicable law and the service relationship, and provides reasonable cooperation with applicable privacy requests. The parties’ legal roles may depend on the specific processing activity and applicable Indian law; these Terms do not label LiftDesk as a Data Fiduciary or Data Processor for every activity. A separate [Data Processing Agreement](/data-processing) describes proposed processing terms and requires review and agreement by the Gym before it governs a relationship.',
    'LiftDesk retains ownership of its software, branding, logo, application design and documentation. No ownership of Gym Data transfers to LiftDesk by these Terms.',
  ]],
  ['Product features and records', [
    'Attendance can be recorded by authorised staff or by a member who scans the gym’s shared rotating QR while signed in to the LiftDesk account linked to their membership. The QR challenge is short-lived; LiftDesk checks the member’s gym, account link, active status, membership expiry and whether a check-in was already recorded for that India calendar day. A scan does not independently prove physical presence, and accuracy depends on correct use and available system functionality.',
    'Gym operators enter membership dates, plans, fees and statuses. Expiry, renewal and inactivity indicators are administrative tools based on the records available; incomplete or incorrect attendance and membership data can make them inaccurate. Displaying a follow-up does not mean a member received or acted on a reminder. LiftDesk does not collect Gym membership payments. A payment or fee entered in LiftDesk is a Gym record and does not mean LiftDesk collected it.',
    'Staff management, coaching plans, templates, notes and progress tools are available according to assigned roles. The Gym must have authority to collect and use coaching information and should avoid unnecessary sensitive data. Coaching content is not medical advice, diagnosis or treatment.',
    'Reports and workspace summaries depend on underlying records and are not independently verified financial or accounting statements. The live Workspace does not currently provide a general data-export tool. A CSV download in the public preview contains sample data only.',
  ]],
  ['Privacy, security and chat', [
    'Read the [Privacy Notice](/privacy) for data categories, access, retention and privacy request details. The Gym is responsible for information it collects and staff permissions; LiftDesk is responsible for safeguards within its service, and users must secure their accounts and devices. Each party should promptly cooperate with the other about a suspected incident affecting the other’s records or users.',
    'New Gym Chat messages are encrypted on registered devices before storage; older messages created before encryption was introduced may remain unencrypted until removed. The server stores encrypted message envelopes and public device keys. Private keys are stored in the registering browser’s IndexedDB; losing browser data may make messages unreadable, and LiftDesk cannot recover that private key. Unpinned messages are removed after 48 hours. Pinned announcements remain while pinned; once unpinned, messages older than 48 hours are eligible for the database cleanup process. This does not promise removal from backups or devices where a message was already delivered. Optional browser push depends on device, browser permission and service configuration.',
  ]],
  ['Third-party services', [
    'LiftDesk relies on Supabase for authentication, database, realtime features and server functions; Google when you choose Google sign-in; Cloudflare for hosting and delivery; and browser or device notification services when push is enabled. These providers may change their services or experience outages. Their involvement does not remove LiftDesk’s own responsibilities under applicable law.',
  ]],
  ['Fees, billing and taxes', [
    'LiftDesk currently charges no Gym subscription or platform fee and does not process Gym membership payments. The Gym manages its own membership payments, taxes and payment disputes. Recording a payment in LiftDesk is record-keeping only. If LiftDesk introduces a paid subscription, applicable pricing, billing frequency, due dates, taxes, failed-payment handling, cancellation and refund terms will be clearly provided before charges begin. Any pricing change will be communicated before it takes effect.',
  ]],
  ['Intellectual property and licence', [
    'LiftDesk and its licensors own the Services, software, branding, logo, design and documentation. While you comply with these Terms, LiftDesk grants you a limited, non-exclusive, non-transferable right to use the Services for their intended gym-management purpose. You may not copy, resell or redistribute the Services without permission, except to the extent applicable law permits. Gym owners retain rights in their Gym Data.',
  ]],
  ['Availability and maintenance', [
    'LiftDesk aims to maintain useful availability, but does not guarantee uninterrupted access or a particular uptime. Maintenance, upgrades, security work, feature changes and third-party outages may affect access. LiftDesk will make reasonable efforts to minimise disruption. Features may change as the service develops; material changes will be communicated where appropriate.',
  ]],
  ['Backups and data loss', [
    'The Workspace does not currently provide a Gym-owner-controlled backup, restore or general export function. LiftDesk has not verified a specific backup frequency, point-in-time recovery setting or tested restoration commitment for this service and does not promise a particular recovery point or recovery time. Supabase or other providers may maintain backups or logs under their own configuration and terms; their existence or retention does not guarantee that a particular record can be restored. Contact liftdesk11@gmail.com promptly if records appear missing.',
  ]],
  ['Suspension and restriction', [
    'LiftDesk may restrict or suspend access when reasonably necessary for a serious violation of these Terms, suspected account compromise, a security threat, unlawful use, serious misuse or a legal or regulatory requirement. Where practical, LiftDesk will notify the Gym or affected user, explain the issue and allow a reasonable opportunity to correct it. Emergency restrictions may take effect without advance notice when reasonably necessary. Access may be restored after the reason is resolved and it is safe and lawful to do so.',
  ]],
  ['Termination and workspace closure', [
    'A temporary pause blocks access while preserving Workspace records. The product has no separate archive action. Permanent termination or workspace deletion is different: a platform administrator may permanently delete gym-scoped records from the active database, and this may not be reversible. Staff and member access to those records ends. Separate authentication accounts and records that must be retained independently may remain. A Gym Owner may request workspace closure or account help at liftdesk11@gmail.com. LiftDesk will explain applicable handling; no fixed export or deletion period is promised. Information may be retained where required by law or for legitimate security and service records, subject to applicable law.',
  ]],
  ['Data export and portability', [
    'A general export of live member, membership, attendance, payment, staff or follow-up records is not currently available in the Workspace. The public preview CSV contains illustrative sample records only. A Gym Owner may email liftdesk11@gmail.com to discuss a data request; a request is not a promise that every category can be exported in a particular format or timeframe. LiftDesk should provide a practical retrieval method before offering a self-service export capability.',
  ]],
  ['Warranties and disclaimers', [
    'LiftDesk is a management and record-keeping tool. It does not guarantee Gym revenue, member retention or business outcomes, and does not independently verify all information entered by users. It is not a substitute for professional accounting, legal or medical advice. The Services are provided subject to applicable law. Nothing in these Terms excludes a warranty, consumer right or remedy that cannot legally be excluded.',
  ]],
  ['Limitation of liability', [
    'To the extent permitted by applicable law, LiftDesk is not liable for losses arising from interruptions, third-party infrastructure failures, incorrect user-entered information, unauthorised account or device use, or data loss outside LiftDesk’s reasonable control. LiftDesk is not liable for indirect or consequential losses where exclusion is legally permitted. This wording does not exclude or limit liability for LiftDesk’s own acts or omissions where such exclusion is prohibited, or any liability, remedy or right that cannot legally be excluded or limited. No arbitrary monetary cap is imposed by this clause.',
  ]],
  ['Indemnification', [
    'To the extent permitted by law, a Gym is responsible for third-party claims to the extent caused by its unlawful collection or unauthorised use of personal information, its misuse of the Services, its breach of these Terms, or its infringement of another person’s rights. A party seeking indemnity must give prompt notice, reasonable cooperation and control of the defence to the indemnifying party; settlement cannot impose an admission or obligation on the other party without consent. Responsibility is allocated according to each party’s conduct and applicable law.',
  ]],
  ['Disputes and governing law', [
    'These Terms are governed by the laws of India, subject to mandatory consumer and statutory rights. If a concern arises, contact liftdesk11@gmail.com with relevant details so the parties can try to resolve it informally. If it is not resolved, either party may use the remedies available under applicable law. These Terms do not designate an exclusive court or limit a forum or remedy that the law preserves.',
  ]],
  ['Changes, notices and contact', [
    'The current Terms, version and update date are published on this page. LiftDesk may update them as the Services or law changes. Material changes will be communicated by an appropriate in-product or account channel where available; where required, users must accept the updated version before continuing. Notices and complaints may be sent to liftdesk11@gmail.com. LiftDesk is operated by Aditya Parashar in India; no postal address, telephone number or grievance officer is designated by this document.',
  ]],
] as const

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const links: Record<string, string> = { '[Privacy Notice](/privacy)': '/privacy', '[Acceptable Use Policy](/acceptable-use)': '/acceptable-use', '[Data Processing Agreement](/data-processing)': '/data-processing' }

function inlineLinks(value: string) {
  return value.split(/(\[Privacy Notice\]\(\/privacy\)|\[Acceptable Use Policy\]\(\/acceptable-use\)|\[Data Processing Agreement\]\(\/data-processing\)|liftdesk11@gmail\.com)/g).map((part, index) => Object.prototype.hasOwnProperty.call(links, part)
    ? <a key={index} href={links[part]}>{part.slice(1, part.indexOf(']'))}</a>
    : part === 'liftdesk11@gmail.com' ? <a key={index} href="mailto:liftdesk11@gmail.com">{part}</a> : part)
}

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service v2.0 | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'LiftDesk Terms of Service v2.0: accounts, gym workspaces, data, product features, fees, security, and your responsibilities.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://liftdesk.pages.dev/terms')
  }, [])
  return <div className="terms-page"><header className="terms-header"><a href="/" aria-label="LiftDesk home"><LiftDeskMark size={42} /></a><a className="terms-home-link" href="/">Back to LiftDesk</a></header>
    <main className="terms-main"><article className="terms-document legal-document">
      <p className="terms-updated">Version 2.0 · Effective 12 November 2026 · Last updated 12 November 2026</p><h1>Terms of Service</h1>
      <p className="terms-lede">Terms for LiftDesk accounts and gym workspaces, including member records, attendance, coaching, chat and administration.</p>
      <nav className="legal-toc" aria-label="Terms of Service contents"><h2>On this page</h2><ol>{sections.map(([title]) => <li key={title}><a href={`#${slug(title)}`}>{title}</a></li>)}</ol></nav>
      <div className="terms-section-list">{sections.map(([title, paragraphs], index) => <section className="terms-section" id={slug(title)} key={title} aria-labelledby={`${slug(title)}-heading`}><h2 id={`${slug(title)}-heading`}>{index + 1}. {title}</h2>{paragraphs.map((paragraph, i) => <p key={i}>{inlineLinks(paragraph)}</p>)}</section>)}</div>
      <nav className="legal-related" aria-label="Related legal documents"><a href="/privacy">Privacy Notice</a><a href="/data-processing">Data Processing Agreement</a><a href="/acceptable-use">Acceptable Use Policy</a></nav>
    </article></main><footer className="terms-footer"><a href="/">LiftDesk</a><a href="mailto:liftdesk11@gmail.com">liftdesk11@gmail.com</a><a href="/?mode=signin">Sign in</a></footer></div>
}
