import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Building2, Check, Clock3, LoaderCircle, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react'
import type { OwnerAccessRequest } from './lib/ownerApprovals'
import { requireSupabase } from './lib/supabase'

type Props = { onOpenWorkspace?: () => void; onSignOut: () => void }

function readableError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === '42501') return 'Your account is not authorized to manage LiftDesk owner requests.'
  return 'LiftDesk could not complete that action. Refresh the page and try again.'
}

export default function PlatformAdmin({ onOpenWorkspace, onSignOut }: Props) {
  const [requests, setRequests] = useState<OwnerAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data, error: loadError } = await requireSupabase()
        .from('owner_access_requests')
        .select('id, user_id, owner_email, owner_name, gym_name, city, phone, gym_theme, status, review_note, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (loadError) throw loadError
      setRequests((data ?? []) as OwnerAccessRequest[])
    } catch (err) { setError(readableError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(request: OwnerAccessRequest, action: 'approve' | 'reject') {
    const confirmed = action === 'approve'
      ? window.confirm(`Approve ${request.owner_name} and create the ${request.gym_name} workspace?`)
      : window.confirm(`Reject ${request.owner_name}'s request for ${request.gym_name}?`)
    if (!confirmed) return
    setBusyId(request.id); setError(''); setNotice('')
    try {
      const rpc = action === 'approve' ? 'approve_owner_workspace_request' : 'reject_owner_workspace_request'
      const args = action === 'approve'
        ? { request_id: request.id }
        : { request_id: request.id, decision_note: 'Please contact LiftDesk for more information.' }
      const { error: actionError } = await requireSupabase().rpc(rpc, args)
      if (actionError) throw actionError
      setNotice(action === 'approve' ? `${request.gym_name} is approved. Its owner can sign in now.` : `${request.gym_name} request was declined.`)
      await load()
    } catch (err) { setError(readableError(err)) }
    finally { setBusyId('') }
  }

  return <main className="platform-admin-screen">
    <header className="platform-admin-header">
      <a className="platform-admin-brand" href="/" aria-label="LiftDesk home"><Building2 size={20}/><span>LiftDesk <small>PLATFORM</small></span></a>
      <div className="platform-admin-actions">
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        {onOpenWorkspace && <button type="button" onClick={onOpenWorkspace}><ArrowLeft size={15}/> Open my gym</button>}
        <button type="button" onClick={onSignOut}><LogOut size={15}/> Sign out</button>
      </div>
    </header>
    <section className="platform-admin-content">
      <p className="platform-admin-eyebrow"><ShieldCheck size={15}/> PLATFORM ADMINISTRATION</p>
      <h1>Owner access requests</h1>
      <p className="platform-admin-intro">New gym workspaces stay private until you approve them here. Gym Owner and Admin roles cannot approve LiftDesk accounts.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-message" role="status">{notice}</p>}
      {loading ? <div className="platform-admin-empty"><LoaderCircle className="spin" size={20}/> Loading requests…</div>
        : requests.length === 0 ? <div className="platform-admin-empty"><Check size={20}/><div><b>No pending owner requests</b><span>New requests will appear here after an owner submits gym details.</span></div></div>
          : <div className="owner-request-list">{requests.map(request => <article className="owner-request-card" key={request.id}>
            <div className="owner-request-heading"><div><h2>{request.gym_name}</h2><p>{request.owner_name} · {request.owner_email}</p></div><span className="owner-request-status"><Clock3 size={13}/> Awaiting review</span></div>
            <dl><div><dt>Submitted</dt><dd>{new Date(request.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>{request.city && <div><dt>City</dt><dd>{request.city}</dd></div>}{request.phone && <div><dt>Phone</dt><dd>{request.phone}</dd></div>}</dl>
            <div className="owner-request-actions"><button type="button" className="button-secondary" disabled={busyId === request.id} onClick={() => void decide(request, 'reject')}><X size={15}/> Reject</button><button type="button" className="button-primary" disabled={busyId === request.id} onClick={() => void decide(request, 'approve')}><Check size={15}/>{busyId === request.id ? 'Processing…' : 'Approve owner'}</button></div>
          </article>)}</div>}
      <p className="platform-admin-footnote"><ShieldCheck size={15}/> Decisions are enforced by Supabase. An approval creates the Owner membership; a browser-only role change cannot grant access.</p>
    </section>
  </main>
}
