import { useEffect } from 'react'
import LiftDeskMark from './LiftDeskMark'

type Props = { kind: 'dpa' | 'acceptable-use' }
const documents = {
  dpa: {
    title: 'Data Processing Agreement', version: 'Draft for review · 12 November 2026',
    description: 'Proposed processing terms for Gym Data handled through LiftDesk. This document is not effective until reviewed and agreed by the Gym and LiftDesk.',
    meta: 'Proposed data processing terms for LiftDesk gym customers. Review the subprocessors, security and transfer details before agreement.',
    sections: [
      ['Status and scope', 'This document is a proposed DPA for a Gym’s use of LiftDesk. It is not yet accepted by the parties and does not replace the Terms of Service or Privacy Notice. The parties should have Indian counsel review and agree its final terms before relying on it.'],
      ['Parties and roles', 'The Gym customer and LiftDesk, operated by Aditya Parashar in India, are the parties. For Gym-directed workspace activity, the Gym determines what information is collected and why, while LiftDesk supplies and maintains the application. Each party’s legal role depends on the processing activity and applicable law; this draft does not assign a universal statutory role. LiftDesk may separately handle account, security and service data for its own operations.'],
      ['Processing scope and purposes', 'LiftDesk processes Workspace information to authenticate users, connect accounts with gym roles, store and display records, support attendance and coaching features, deliver chat and notices, administer workspaces, maintain security and provide support. Processing is limited to providing and maintaining the Services and applicable instructions agreed with the Gym.'],
      ['Data subjects and categories', 'Data subjects may include Gym members, owners, staff, trainers, administrators and invitees. Categories may include identity and contact details, account and role identifiers, membership plans and dates, attendance, staff records, follow-up notes, coaching and progress information, chat messages and device public keys, invitations, notifications and usage/security records. The Gym must not submit information it is not authorised to provide and should avoid unnecessary sensitive personal data.'],
      ['Gym instructions and responsibilities', 'The Gym instructs LiftDesk to process Workspace information through the features it chooses to use and the account actions it authorises. The Gym is responsible for its lawful basis, notices and permissions, data accuracy, account permissions and responding to requests concerning records it controls. A material new processing instruction should be documented through an agreed update to this DPA.'],
      ['LiftDesk responsibilities and confidentiality', 'LiftDesk will process information to provide and maintain LiftDesk, apply the safeguards described in the Privacy Notice, restrict internal access to service and support needs, and provide reasonable cooperation with privacy requests relating to Workspace information. Personnel access and confidentiality arrangements should be confirmed in the final agreement.'],
      ['Security safeguards', 'Current controls include Supabase authentication and database access policies, gym and role-scoped access, and device-side encryption for new Gym Chat messages. Historical messages created before encryption may not be encrypted. Private chat keys are held in browser IndexedDB and are not recoverable by LiftDesk. These controls are not a certification or guarantee that incidents cannot occur. A detailed control inventory and incident response commitments must be verified and reviewed before signing.'],
      ['Subprocessors and hosting', 'Current service providers include Supabase (authentication, database, realtime and server functions), Google (when Google sign-in is selected), Cloudflare (website hosting and delivery), and browser/device notification services when push is enabled. Supabase may use infrastructure subprocessors. The final DPA should attach the applicable provider/subprocessor list, describe change notices and provide a way for the Gym to raise a reasonable objection.'],
      ['Privacy requests and incident cooperation', 'Each party will reasonably assist the other with requests and incidents involving information relevant to its role. The Gym remains the first contact for records it controls. LiftDesk will notify the Gym of a confirmed security incident affecting its Workspace information as soon as reasonably practicable after becoming aware, subject to applicable law and verified operational contact details. A specific notice deadline and response process require operational and legal review before agreement.'],
      ['Retention, deletion and return', 'Most Workspace records have no automatic deletion timer. Pausing a Workspace preserves its records. A platform administrator can permanently delete gym-scoped records from the active database; separate authentication accounts and independently retained records may remain. The product does not currently provide a general live data export, owner-controlled backup or restore function. The parties must agree a workable return/export and deletion process, including any provider backup/log retention limits, before this DPA becomes effective.'],
      ['Audit and compliance cooperation', 'LiftDesk can provide reasonable information about its current processing and safeguards on request, subject to security, confidentiality and other customers’ rights. No independent audit, certification or fixed audit schedule is represented as currently available. Any additional audit rights, evidence package, cost and frequency must be agreed in the final DPA.'],
      ['International transfers', 'The locations from which providers may process or store information, and any applicable transfer safeguards, have not been verified for this draft. Before signature, confirm current provider locations and applicable transfer requirements, then document the relevant safeguards and instructions.'],
      ['Term and termination', 'This proposed DPA would apply for the period the Gym uses LiftDesk and handles Workspace information. On termination, access, Workspace pause/deletion, retention and return are governed by the agreed service terms and applicable law. This draft sets no fixed deletion or export period.'],
      ['Items requiring confirmation before signature', 'The parties should confirm LiftDesk’s legal entity details and notice channels; provider locations and current subprocessor list; backup and restore configuration; security incident workflow and deadlines; staff confidentiality/access arrangements; request-assistance process; export format and timing; deletion behavior in provider backups/logs; audit evidence; and the final allocation of statutory roles under Indian law.'],
    ] as [string, string][],
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy', version: 'Version 1.0 · Effective 12 November 2026',
    description: 'Rules for safe and authorised use of LiftDesk gym workspaces.',
    meta: 'LiftDesk Acceptable Use Policy covering workspace access, account security, records, communications and security testing.',
    sections: [
      ['Authorised access', 'Use only the account, Workspace and records assigned to you. Do not bypass Gym-level access controls, use another person’s invitation, access another Gym, or attempt to view another person’s private records.'],
      ['Accounts and credentials', 'Do not share credentials, impersonate another person or transfer account access. Keep devices secure and report suspected compromise to liftdesk11@gmail.com.'],
      ['Records and privacy', 'Do not falsify attendance, make unauthorised membership changes, collect personal information without authority, disclose private records improperly, or add unlawful content. Use coaching fields responsibly and do not submit unnecessary sensitive information.'],
      ['Communications and automation', 'Do not send spam, abusive or unlawful messages, or use chat and notifications to harass users. Do not scrape or bulk extract Workspace information, automate access abusively, or interfere with normal service operation.'],
      ['Security and software', 'Do not introduce malicious software, disrupt LiftDesk, probe or exploit vulnerabilities, reverse engineer or copy the service, or conduct security testing without prior written authorisation. Report a suspected vulnerability privately to liftdesk11@gmail.com and do not access, alter or disclose other users’ data while investigating.'],
      ['Enforcement and reporting', 'LiftDesk may investigate suspected misuse and restrict access where reasonably necessary for security, legal compliance or serious violations, as described in the Terms of Service. Contact liftdesk11@gmail.com to report an issue. This Policy is subject to rights and exceptions that applicable law does not allow LiftDesk to restrict.'],
    ] as [string, string][],
  },
}

export default function AdditionalLegalPage({ kind }: Props) {
  const doc = documents[kind]
  const path = kind === 'dpa' ? '/data-processing' : '/acceptable-use'
  useEffect(() => {
    document.title = `${doc.title} | LiftDesk`
    document.querySelector('meta[name="description"]')?.setAttribute('content', doc.meta)
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://liftdesk.pages.dev${path}`)
  }, [doc, path])
  return <div className="terms-page"><header className="terms-header"><a href="/" aria-label="LiftDesk home"><LiftDeskMark size={42} /></a><a className="terms-home-link" href="/">Back to LiftDesk</a></header>
    <main className="terms-main"><article className="terms-document legal-document"><p className="terms-updated">{doc.version}</p><h1>{doc.title}</h1><p className="terms-lede">{doc.description}</p>
      <nav className="legal-toc" aria-label={`${doc.title} contents`}><h2>On this page</h2><ol>{doc.sections.map(([title], i) => <li key={title}><a href={`#${kind}-${i + 1}`}>{title}</a></li>)}</ol></nav>
      <div className="terms-section-list">{doc.sections.map(([title, body], i) => <section className="terms-section" id={`${kind}-${i + 1}`} key={title}><h2>{i + 1}. {title}</h2><p>{body}</p></section>)}</div>
      <nav className="legal-related" aria-label="Related legal documents"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Notice</a>{kind === 'dpa' && <a href="/acceptable-use">Acceptable Use Policy</a>}</nav>
    </article></main><footer className="terms-footer"><a href="/">LiftDesk</a><a href="mailto:liftdesk11@gmail.com">liftdesk11@gmail.com</a></footer></div>
}
