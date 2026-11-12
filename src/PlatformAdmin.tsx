import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Building2, Check, Clock3, Dumbbell, LoaderCircle, LogOut, Pause, Play, Plus, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { OwnerAccessRequest, PlatformGymSummary } from './lib/ownerApprovals'
import { createPlatformGymWorkspace, listPlatformGymDirectory, removePlatformGymWorkspace, setPlatformGymWorkspacePaused } from './lib/ownerApprovals'
import { requireSupabase } from './lib/supabase'

type Props = { onOpenWorkspace?: () => void; onSignOut: () => void }
type Section = 'gyms' | 'requests'

function readableError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === '42501') return 'Your account is not authorized to manage LiftDesk platform data.'
  if (code === '42883' || code === 'PGRST202') return 'The gym overview is not available yet. Apply the latest LiftDesk platform-admin database migration, then refresh.'
  return 'LiftDesk could not load this information. Check your connection and try again.'
}

function dateLabel(value: string | null, includeTime = false) {
  if (!value) return 'No check-ins yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString('en-IN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' })
}

function Stat({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: ReactNode }) {
  return <article className="platform-stat"><div className="platform-stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value.toLocaleString('en-IN')}</strong><small>{detail}</small></article>
}

export default function PlatformAdmin({ onOpenWorkspace, onSignOut }: Props) {
  const [requests, setRequests] = useState<OwnerAccessRequest[]>([])
  const [gyms, setGyms] = useState<PlatformGymSummary[]>([])
  const [section, setSection] = useState<Section>('gyms')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'needs-owner'>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [gymError, setGymError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreateGym, setShowCreateGym] = useState(false)
  const [gymForm, setGymForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPhone: '', city: '', phone: '' })

  const load = useCallback(async () => {
    setError(''); setGymError(''); setRequestError('')
    setLoading(true)
    const [requestResult, gymResult] = await Promise.allSettled([
        (async () => requireSupabase().from('owner_access_requests')
          .select('id, user_id, owner_email, owner_name, gym_name, city, phone, owner_mobile_phone, status, review_note, created_at')
          .eq('status', 'pending').order('created_at', { ascending: true }))(),
        listPlatformGymDirectory(),
      ])
    if (requestResult.status === 'fulfilled') {
      if (requestResult.value.error) setRequestError(readableError(requestResult.value.error))
      else setRequests((requestResult.value.data ?? []) as OwnerAccessRequest[])
    } else setRequestError(readableError(requestResult.reason))
    if (gymResult.status === 'fulfilled') setGyms(gymResult.value)
    else setGymError(readableError(gymResult.reason))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredGyms = useMemo(() => gyms.filter(gym => {
    const matchesQuery = `${gym.gym_name} ${gym.city ?? ''} ${gym.owner_phone ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'active' ? gym.active_owner_count > 0 : gym.active_owner_count === 0)
    return matchesQuery && matchesFilter
  }), [gyms, query, filter])

  const totals = useMemo(() => gyms.reduce((result, gym) => ({
    members: result.members + Number(gym.member_count),
    activeMembers: result.activeMembers + Number(gym.active_member_count),
    admins: result.admins + Number(gym.admin_count),
    trainers: result.trainers + Number(gym.trainer_count),
  }), { members: 0, activeMembers: 0, admins: 0, trainers: 0 }), [gyms])
  const visibleError = section === 'gyms' ? gymError : requestError

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

  async function addGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyId('create'); setError(''); setNotice('')
    try {
      const result = await createPlatformGymWorkspace({
        gymName: gymForm.name,
        ownerName: gymForm.ownerName,
        ownerEmail: gymForm.ownerEmail,
        ownerPhone: gymForm.ownerPhone,
        city: gymForm.city,
        phone: gymForm.phone,
      })
      setNotice(result.ownerAccountReady
        ? `${gymForm.name.trim()} is ready. ${result.ownerEmail} can sign in with Google.`
        : `${gymForm.name.trim()} is set up for ${result.ownerEmail}. The owner can claim it with that verified Google account.`)
      setGymForm({ name: '', ownerName: '', ownerEmail: '', ownerPhone: '', city: '', phone: '' })
      setShowCreateGym(false)
      await load()
    } catch (err) { setError(readableError(err)) }
    finally { setBusyId('') }
  }

  async function removeGym(gym: PlatformGymSummary) {
    const confirmed = window.confirm(
      `Remove ${gym.gym_name} from LiftDesk? This will disable sign-in for its owner, staff, and members and revoke outstanding staff invitations. Existing gym records will be retained for history.`
    )
    if (!confirmed) return
    setBusyId(gym.gym_id); setError(''); setNotice('')
    try {
      await removePlatformGymWorkspace(gym.gym_id)
      setNotice(`${gym.gym_name} was removed from the active gym directory. Its records are retained.`)
      await load()
    } catch (err) { setError(readableError(err)) }
    finally { setBusyId('') }
  }

  async function toggleWorkspacePause(gym: PlatformGymSummary) {
    const shouldPause = !gym.workspace_paused_at
    setBusyId(gym.gym_id); setError(''); setNotice('')
    try {
      await setPlatformGymWorkspacePaused(gym.gym_id, shouldPause)
      setNotice(shouldPause
        ? `${gym.gym_name} is paused. Its workspace access is blocked and its records are preserved.`
        : `${gym.gym_name} is resumed. Its existing owner and team access is restored.`)
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
      <h1>LiftDesk overview</h1>
      <p className="platform-admin-intro">Create gym workspaces for owners, manage active access, and review high-level membership and attendance. Owners sign in with the verified Google account assigned to their gym.</p>
      {(visibleError || error) && <p className="auth-error" role="alert">{visibleError || error}</p>}
      {notice && <p className="auth-message" role="status">{notice}</p>}

      <nav className="platform-admin-tabs" aria-label="Platform administration sections">
        <button type="button" className={section === 'gyms' ? 'is-active' : ''} aria-current={section === 'gyms' ? 'page' : undefined} onClick={() => setSection('gyms')}><Building2 size={16}/> Gyms <span>{gyms.length}</span></button>
        <button type="button" className={section === 'requests' ? 'is-active' : ''} aria-current={section === 'requests' ? 'page' : undefined} onClick={() => setSection('requests')}><Clock3 size={16}/> Owner requests <span>{requests.length}</span></button>
      </nav>

      {section === 'gyms' ? <>
        <div className="platform-stats">
          <Stat label="Gyms on LiftDesk" value={gyms.length} detail="Registered workspaces" icon={<Building2 size={17}/>}/>
          <Stat label="Members" value={totals.members} detail={`${totals.activeMembers.toLocaleString('en-IN')} active`} icon={<Users size={17}/>}/>
          <Stat label="Admin records" value={totals.admins} detail="Across gym staff directories" icon={<ShieldCheck size={17}/>}/>
          <Stat label="Trainer records" value={totals.trainers} detail="Across gym staff directories" icon={<Dumbbell size={17}/>}/>
        </div>
        <div className="platform-directory-heading">
          <div><h2>Gym workspaces</h2><p>Add an owner and gym directly. They can enter with Google using the assigned email.</p></div>
          <button className="platform-add-gym" type="button" onClick={() => { setError(''); setNotice(''); setShowCreateGym(true) }}><Plus size={16}/> Add gym</button>
        </div>
        <div className="platform-directory-toolbar">
          <label className="platform-search"><Search size={16}/><span className="sr-only">Search gyms</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by gym name or city"/></label>
          <label className="platform-filter"><span className="sr-only">Filter gyms</span><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">All gyms</option><option value="active">Active owner access</option><option value="needs-owner">No active owner</option></select></label>
          <span className="platform-result-count">{filteredGyms.length} {filteredGyms.length === 1 ? 'gym' : 'gyms'}</span>
        </div>
        {loading ? <div className="platform-admin-empty"><LoaderCircle className="spin" size={20}/> Loading gym overview…</div>
          : filteredGyms.length === 0 ? <div className="platform-admin-empty"><Building2 size={20}/><div><b>{gyms.length ? 'No gyms match this search' : 'No gym workspaces yet'}</b><span>{gyms.length ? 'Try a different name, city, or filter.' : 'Approved workspaces will appear here.'}</span></div></div>
            : <div className="platform-gym-list">{filteredGyms.map(gym => <article className="platform-gym-card" key={gym.gym_id}>
              <div className="platform-gym-heading"><div className="platform-gym-identity"><i><Building2 size={18}/></i><div><h2>{gym.gym_name}</h2><p>{gym.city || 'City not provided'} <span>·</span> Added {dateLabel(gym.created_at)}</p><p>Owner Google account: {gym.owner_email || 'Not provided'}</p><p>Owner contact: {gym.owner_phone ? <a href={`tel:${gym.owner_phone}`}>{gym.owner_phone}</a> : 'Not provided'}</p></div></div><div className="platform-gym-card-actions"><span className={`platform-health ${gym.workspace_paused_at ? 'is-paused' : gym.active_owner_count ? 'is-active' : 'needs-owner'}`}><i/>{gym.workspace_paused_at ? 'Workspace paused' : gym.active_owner_count ? 'Owner active' : 'Waiting for Google sign-in'}</span><button type="button" className="platform-pause-gym" disabled={Boolean(busyId)} onClick={() => void toggleWorkspacePause(gym)}>{busyId === gym.gym_id ? <LoaderCircle size={14} className="spin"/> : gym.workspace_paused_at ? <Play size={14}/> : <Pause size={14}/>} {gym.workspace_paused_at ? 'Resume' : 'Pause'}</button><button type="button" className="platform-remove-gym" disabled={Boolean(busyId)} onClick={() => void removeGym(gym)}>{busyId === gym.gym_id ? <LoaderCircle size={14} className="spin"/> : <X size={14}/>}Remove</button></div></div>
              <div className="platform-gym-metrics">
                <div><span>Members</span><strong>{Number(gym.member_count).toLocaleString('en-IN')}</strong><small>{Number(gym.active_member_count).toLocaleString('en-IN')} active</small></div>
                <div><span>Admins</span><strong>{Number(gym.admin_count).toLocaleString('en-IN')}</strong><small>{Number(gym.active_admin_count).toLocaleString('en-IN')} active</small></div>
                <div><span>Trainers</span><strong>{Number(gym.trainer_count).toLocaleString('en-IN')}</strong><small>{Number(gym.active_trainer_count).toLocaleString('en-IN')} active</small></div>
                <div><span>Latest attendance</span><strong className="platform-gym-last-seen">{dateLabel(gym.last_attendance_at, true)}</strong><small>Most recent recorded check-in</small></div>
              </div>
            </article>)}</div>}
        <p className="platform-admin-footnote"><ShieldCheck size={15}/> Member and staff contact information is not shown. The owner contact number is private account-support data and is visible only in this LiftDesk platform-admin view; it updates when the Owner saves a new number.</p>
      </> : <>
        <h2 className="platform-section-title">Owner access requests</h2>
        <p className="platform-section-intro">New gym workspaces stay private until you approve them here. Gym Owner and Admin roles cannot approve LiftDesk accounts.</p>
        {loading ? <div className="platform-admin-empty"><LoaderCircle className="spin" size={20}/> Loading requests…</div>
          : requests.length === 0 ? <div className="platform-admin-empty"><Check size={20}/><div><b>No pending owner requests</b><span>New requests will appear here after an owner submits gym details.</span></div></div>
            : <div className="owner-request-list">{requests.map(request => <article className="owner-request-card" key={request.id}>
              <div className="owner-request-heading"><div><h2>{request.gym_name}</h2><p>{request.owner_name} · {request.owner_email}</p></div><span className="owner-request-status"><Clock3 size={13}/> Awaiting review</span></div>
              <dl><div><dt>Submitted</dt><dd>{dateLabel(request.created_at, true)}</dd></div>{request.city && <div><dt>City</dt><dd>{request.city}</dd></div>}<div><dt>Owner mobile</dt><dd>{request.owner_mobile_phone || 'Not provided'}</dd></div>{request.phone && <div><dt>Gym phone</dt><dd>{request.phone}</dd></div>}</dl>
              <div className="owner-request-actions"><button type="button" className="button-secondary" disabled={busyId === request.id} onClick={() => void decide(request, 'reject')}><X size={15}/> Reject</button><button type="button" className="button-primary" disabled={busyId === request.id} onClick={() => void decide(request, 'approve')}><Check size={15}/>{busyId === request.id ? 'Processing…' : 'Approve owner'}</button></div>
            </article>)}</div>}
      </>}
      {showCreateGym && <div className="platform-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && busyId !== 'create') setShowCreateGym(false) }}>
        <section className="platform-create-gym-modal" role="dialog" aria-modal="true" aria-labelledby="platform-create-gym-title">
          <div className="platform-create-gym-heading"><div><p>NEW WORKSPACE</p><h2 id="platform-create-gym-title">Add a gym</h2><span>The owner will sign in with Google using the email you assign here.</span></div><button type="button" aria-label="Close" disabled={busyId === 'create'} onClick={() => setShowCreateGym(false)}><X size={18}/></button></div>
          <form onSubmit={event => void addGym(event)}>
            <label>Gym name<input required minLength={2} maxLength={120} autoFocus value={gymForm.name} onChange={event => setGymForm({ ...gymForm, name: event.target.value })} placeholder="e.g. Northside Strength"/></label>
            <div className="platform-form-two"><label>Owner’s full name<input required minLength={2} maxLength={120} value={gymForm.ownerName} onChange={event => setGymForm({ ...gymForm, ownerName: event.target.value })} autoComplete="name"/></label><label>Owner’s Google account email<input required type="email" maxLength={320} value={gymForm.ownerEmail} onChange={event => setGymForm({ ...gymForm, ownerEmail: event.target.value })} autoComplete="email" placeholder="owner@gmail.com"/></label></div>
            <div className="platform-form-two"><label>Owner’s mobile number<input required type="tel" inputMode="numeric" autoComplete="tel" pattern="[6-9][0-9]{9}" maxLength={10} value={gymForm.ownerPhone} onChange={event => setGymForm({ ...gymForm, ownerPhone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit Indian mobile" aria-describedby="owner-phone-help"/><small id="owner-phone-help">Used for LiftDesk account support.</small></label><label>City<input maxLength={120} value={gymForm.city} onChange={event => setGymForm({ ...gymForm, city: event.target.value })}/></label></div>
            <label>Gym phone<input required type="tel" inputMode="numeric" autoComplete="tel" pattern="[6-9][0-9]{9}" minLength={10} maxLength={10} value={gymForm.phone} onChange={event => setGymForm({ ...gymForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit Indian mobile"/></label>
            <p className="platform-create-gym-note">If the owner has not signed in before, LiftDesk will hold this assignment until they sign in with the same verified Google email.</p>
            <div className="platform-create-gym-actions"><button type="button" className="button-secondary" disabled={busyId === 'create'} onClick={() => setShowCreateGym(false)}>Cancel</button><button type="submit" className="button-primary" disabled={busyId === 'create'}>{busyId === 'create' ? <><LoaderCircle size={15} className="spin"/> Adding…</> : <><Plus size={15}/> Add gym</>}</button></div>
          </form>
        </section>
      </div>}
    </section>
  </main>
}
