import { useEffect } from 'react'
import LiftDeskMark from './LiftDeskMark'

const sections = [
  {
    title: '1. About these Terms',
    paragraphs: [
      'These Terms apply when you access or use LiftDesk. LiftDesk is operated by Aditya Parashar. By using the service, you agree to these Terms. If you do not agree, do not use LiftDesk.',
      'LiftDesk provides role-based gym workspaces for owners, administrators, trainers, and members. Depending on your role, the service supports member and staff records, attendance, coaching plans, follow-ups, and gym announcements.',
    ],
  },
  {
    title: '2. Accounts and workspace access',
    paragraphs: [
      'Sign in with the Google account assigned to your LiftDesk role. Keep your account secure, do not share your sign-in credentials, and use only workspaces you are authorized to access. Owners and administrators manage staff records, roles, and invitations for their gym.',
      'You are responsible for activity carried out through your account and for notifying LiftDesk if you believe it has been accessed without authorization.',
      'Your gym may remove your role or invitation, which ends that workspace access. A paused workspace is unavailable to all of its users until it is resumed.',
    ],
  },
  {
    title: '3. Your responsibilities',
    paragraphs: [
      'Use LiftDesk lawfully, provide accurate information, and do not attempt to access another gym’s workspace or records, interfere with the service, or use it to store unlawful or harmful material. Gym operators are responsible for deciding what member information to enter and who they authorize to use their workspace.',
    ],
  },
  {
    title: '4. Gym and member information',
    paragraphs: [
      'Gym records are available to authorized staff in that gym. Members can access their own membership information and coaching information shared with them. LiftDesk platform administrators can view gym directory details for account support.',
      'Gym chat messages are encrypted for registered devices. Standard messages expire after 48 hours; pinned announcements remain until removed. LiftDesk uses Supabase for authentication and data storage.',
      'Pausing or archiving a workspace does not delete its records. Archived gym records are retained unless they are separately deleted. To request access or deletion, email liftdesk11@gmail.com. Requests will be handled under applicable law; these Terms do not promise a fixed deletion period.',
      'The [LiftDesk Privacy Notice](/privacy) describes current data categories, purposes, access, service providers, and retention practices.',
    ],
  },
  {
    title: '5. Fees',
    paragraphs: [
      'LiftDesk currently charges no gym subscription or platform fee and does not process gym membership payments. A gym may record membership fee amounts in its own member records. If LiftDesk introduces fees, it will provide the applicable pricing and terms before charging you.',
    ],
  },
  {
    title: '6. Workspace pauses and changes',
    paragraphs: [
      'Features may change as LiftDesk is updated. A LiftDesk platform administrator can pause or resume a gym workspace. While paused, access is blocked for its owner, staff, and members; workspace records are preserved and become available again when access is resumed.',
    ],
  },
  {
    title: '7. Availability and liability',
    paragraphs: [
      'LiftDesk is provided on an “as available” basis. We work to keep the service useful and available, but do not promise uninterrupted access or that every feature will always be available. Nothing in these Terms limits a right or remedy that cannot be limited under applicable law.',
    ],
  },
  {
    title: '8. Governing law',
    paragraphs: [
      'These Terms are governed by the laws of India, subject to any mandatory legal protections that apply to you.',
    ],
  },
  {
    title: '9. Changes and contact',
    paragraphs: [
      'We may update these Terms as LiftDesk changes. The latest version and its update date will be posted on this page. Where applicable law requires renewed consent, we will ask you to accept updated Terms before continued access.',
      'LiftDesk is operated by Aditya Parashar. Send questions, legal notices, and privacy or deletion requests to liftdesk11@gmail.com.',
    ],
  },
]

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Terms for using LiftDesk gym workspaces.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow')
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://liftdesk.pages.dev/terms')
  }, [])

  return <div className="terms-page">
    <header className="terms-header">
      <a href="/" aria-label="LiftDesk home"><LiftDeskMark size={42} /></a>
      <a className="terms-home-link" href="/">Back to LiftDesk</a>
    </header>
    <main className="terms-main">
      <article className="terms-document">
        <p className="terms-updated">Last updated 10 November 2026</p>
        <h1>Terms of Service</h1>
        <p className="terms-lede">These Terms explain the basic rules for using LiftDesk’s gym workspaces and how access, records, fees, and service changes are handled.</p>
        <div className="terms-section-list">
          {sections.map(section => <section className="terms-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph.split(/(liftdesk11@gmail\.com|\[LiftDesk Privacy Notice\]\(\/privacy\))/g).map((part, index) => part === 'liftdesk11@gmail.com'
              ? <a key={index} href="mailto:liftdesk11@gmail.com">{part}</a>
              : part === '[LiftDesk Privacy Notice](/privacy)'
                ? <a key={index} href="/privacy">LiftDesk Privacy Notice</a>
                : part)}</p>)}
          </section>)}
        </div>
      </article>
    </main>
    <footer className="terms-footer">
      <a href="/">LiftDesk</a>
      <a href="/privacy">Privacy Notice</a>
      <a href="/?mode=signin">Sign in</a>
    </footer>
  </div>
}
