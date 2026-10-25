import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, Building2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createGymForCurrentUser, getCurrentGym, type Gym, type GymRole } from './lib/gymData'
import { isSupabaseConfigured, requireSupabase } from './lib/supabase'
import App from './App'

type Workspace = { gym: Gym; role: GymRole }
type Mode = 'signin' | 'signup'

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [needsWorkspace, setNeedsWorkspace] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [gymName, setGymName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) { setBusy(false); return }
    const client = requireSupabase()
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setBusy(false)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setWorkspace(null)
      setNeedsWorkspace(false)
      setError('')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setWorkspace(null); setNeedsWorkspace(false); return }
    let alive = true
    setBusy(true)
    getCurrentGym(session.user)
      .then(result => { if (alive) { setWorkspace(result); setNeedsWorkspace(!result) } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load your gym workspace.') })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [session?.user.id])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setMessage(''); setSaving(true)
    try {
      const client = requireSupabase()
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: ownerName.trim() } } })
        if (authError) throw authError
        if (!data.session) {
          setMessage('Account created. Check your email to confirm it, then sign in. Gym setup is available after confirmation.')
        } else {
          setSession(data.session)
        }
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        setSession(data.session)
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed.') }
    finally { setSaving(false) }
  }

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.user) return
    setError(''); setSaving(true)
    try {
      await createGymForCurrentUser({ name: gymName, ownerName, city, phone })
      const result = await getCurrentGym(session.user)
      if (!result) throw new Error('Gym was created but the membership could not be loaded. Refresh and try again.')
      setWorkspace(result); setNeedsWorkspace(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the gym workspace.') }
    finally { setSaving(false) }
  }

  if (busy) return <div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={24} /><p>Loading your secure workspace…</p></div></div>

  if (!isSupabaseConfigured) return <div className="auth-screen"><section className="auth-card"><BrandMark /><p className="auth-eyebrow">SETUP REQUIRED</p><h1>Connect your Supabase project</h1><p className="auth-intro">Authentication is disabled until the project URL and browser publishable key are configured.</p><div className="auth-instructions"><b>1.</b><span>Copy <code>.env.example</code> to a local file named <code>.env</code>.</span><b>2.</b><span>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</span><b>3.</b><span>Run the SQL migrations in your Supabase SQL Editor, then restart Vite.</span></div><p className="auth-security"><ShieldCheck size={16} /> Never use a service-role key in browser settings.</p></section></div>

  if (!session) return <div className="auth-screen"><section className="auth-card"><BrandMark /><p className="auth-eyebrow">GYM OPERATIONS, MADE CLEARER</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your owner account.'}</h1><p className="auth-intro">{mode === 'signin' ? 'Sign in to access your gym workspace.' : 'Start with an account for the person responsible for the gym.'}</p>
    <form className="auth-form" onSubmit={submitAuth}>
      {mode === 'signup' && <label>Owner name<input autoComplete="name" required minLength={2} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>}
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch">{mode === 'signin' ? 'New to LiftDesk?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
    <p className="auth-security"><ShieldCheck size={16} /> Your gym data is protected by database access policies.</p>
  </section></div>

  if (needsWorkspace) return <div className="auth-screen"><section className="auth-card"><BrandMark /><p className="auth-eyebrow">FIRST-TIME SETUP</p><h1>Set up your gym.</h1><p className="auth-intro">This creates a private workspace and assigns your account the owner role.</p>
    <form className="auth-form" onSubmit={submitWorkspace}>
      <label>Gym name<input required minLength={2} maxLength={120} value={gymName} onChange={e => setGymName(e.target.value)} placeholder="e.g. Power Fitness Club" /></label>
      <label>Owner name<input required minLength={2} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>
      <label>City <span className="optional-label">Optional</span><input value={city} onChange={e => setCity(e.target.value)} placeholder="Pune" /></label>
      <label>Gym phone <span className="optional-label">Optional</span><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91…" /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Creating workspace…' : 'Create gym workspace'} <ArrowRight size={16} /></button>
    </form><button className="auth-signout" onClick={() => requireSupabase().auth.signOut()}>Sign out</button>
  </section></div>

  if (workspace) return <><div className="workspace-session-strip"><Building2 size={15} /><span>{workspace.gym.name}</span><span className="workspace-role">{workspace.role}</span><button onClick={() => requireSupabase().auth.signOut()}>Sign out</button></div><App /></>
  return <div className="auth-screen"><section className="auth-card"><h1>Workspace unavailable</h1><p className="auth-intro">{error || 'We could not load a gym for this account.'}</p><button className="auth-submit" onClick={() => requireSupabase().auth.signOut()}>Sign out</button></section></div>
}

function BrandMark() {
  return <div className="auth-brand"><span><Activity size={19} strokeWidth={2.5} /></span><b>Lift<span>Desk</span></b></div>
}
