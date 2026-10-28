import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, Building2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createGymForCurrentUser, getCurrentGym, type Gym, type GymRole } from './lib/gymData'
import { isSupabaseConfigured, requireSupabase } from './lib/supabase'
import GymThemeSelector from './GymThemeSelector'
import { DEFAULT_GYM_THEME, type GymThemeId } from './lib/gymThemes'
import { userFacingError } from './lib/userFacingError'

const LiveApp = lazy(() => import('./LiveApp'))

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
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [gymName, setGymName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [gymTheme, setGymTheme] = useState<GymThemeId>(DEFAULT_GYM_THEME)

  useEffect(() => {
    if (!isSupabaseConfigured) { setBusy(false); return }
    const client = requireSupabase()
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(userFacingError(sessionError, 'Could not check your sign-in session. Refresh the page and try again.'))
      setSession(data.session)
      setBusy(false)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      // Token refreshes keep the same user. Preserve the loaded workspace unless
      // the user identity changes; the session effect below reloads on sign-in/out.
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setWorkspace(null); setNeedsWorkspace(false); return }
    let alive = true
    setBusy(true)
    getCurrentGym(session.user)
      .then(result => { if (alive) { setWorkspace(result); setNeedsWorkspace(!result) } })
      .catch(err => { if (alive) setError(userFacingError(err, 'Could not load your gym workspace. Check your connection and try again.')) })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [session?.user.id])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setMessage(''); setSaving(true)
    try {
      const client = requireSupabase()
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Return the confirmation link to this app so Supabase can exchange
            // its callback code and establish the first session here.
            emailRedirectTo: new URL('/', window.location.origin).toString(),
            data: { full_name: ownerName.trim() },
          },
        })
        if (authError) throw authError
        if (!data.session) {
          const accountAlreadyExists = data.user?.identities?.length === 0
          setShowResendConfirmation(true)
          setMessage(accountAlreadyExists
            ? 'No new account was created for this email. It may already be registered. Switch to sign in, or resend a confirmation if you have not verified it yet.'
            : 'Check your inbox and spam folder for the confirmation email. The newest link will return you to LiftDesk. If it does not arrive, you can request another below.')
        } else {
          setSession(data.session)
        }
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (authError?.code === 'email_not_confirmed') {
          throw new Error('Please confirm your email using the newest link we sent before signing in.')
        }
        if (authError?.code === 'invalid_credentials') {
          throw new Error('Email or password was not accepted. If you just created this account, confirm your email first. Otherwise check the email address and password.')
        }
        if (authError) throw authError
        setSession(data.session)
      }
    } catch (err) { setError(userFacingError(err, 'Authentication failed. Check your details and try again.')) }
    finally { setSaving(false) }
  }

  async function resendConfirmation() {
    setError(''); setMessage(''); setResendingConfirmation(true)
    try {
      const { error: resendError } = await requireSupabase().auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: new URL('/', window.location.origin).toString() },
      })
      if (resendError?.code === 'email_address_not_authorized') {
        throw new Error('Supabase is blocking this recipient because project email is not configured for general delivery. Configure custom SMTP in Supabase Authentication settings.')
      }
      if (resendError?.code === 'over_email_send_rate_limit') {
        throw new Error('Supabase has reached its email sending limit. Wait before requesting another confirmation email.')
      }
      if (resendError) throw resendError
      setMessage('If this account still needs confirmation, Supabase has accepted a new email request. Check your inbox and spam folder. If you already confirmed the address, switch to sign in instead.')
    } catch (err) {
      setError(userFacingError(err, 'Could not request another confirmation email. Check your connection and try again.'))
    } finally {
      setResendingConfirmation(false)
    }
  }

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.user) return
    setError(''); setSaving(true)
    try {
      await createGymForCurrentUser({ name: gymName, ownerName, city, phone, theme: gymTheme })
      const result = await getCurrentGym(session.user)
      if (!result) throw new Error('Gym was created but the membership could not be loaded. Refresh and try again.')
      setWorkspace(result); setNeedsWorkspace(false)
    } catch (err) { setError(userFacingError(err, 'Could not create the gym workspace. Check the details and try again.')) }
    finally { setSaving(false) }
  }

  if (busy) return <div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={24} /><p>Loading your secure workspace…</p></div></div>

  if (!isSupabaseConfigured) return <div className="auth-screen"><section className="auth-card"><BrandMark /><p className="auth-eyebrow">SETUP REQUIRED</p><h1>Connect your Supabase project</h1><p className="auth-intro">Authentication is disabled until the project URL and browser publishable key are configured.</p><div className="auth-instructions"><b>1.</b><span>Copy <code>.env.example</code> to a local file named <code>.env</code>.</span><b>2.</b><span>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</span><b>3.</b><span>Run the SQL migrations in your Supabase SQL Editor, then restart Vite.</span></div><p className="auth-security"><ShieldCheck size={16} /> Never use a service-role key in browser settings.</p></section></div>

  if (!session) return <div className="auth-screen auth-screen-premium">
    <aside className="auth-showcase" aria-label="LiftDesk product introduction">
      <div className="showcase-top"><BrandMark /><span className="showcase-status"><i /> BUILT FOR GYM OWNERS</span></div>
      <div className="showcase-copy"><p className="showcase-kicker">LESS ADMIN. MORE MOMENTUM.</p><h2>Your gym,<br /><span>running in rhythm.</span></h2><p>A clearer way to manage memberships, track attendance, and stay ahead of renewals.</p></div>
      <div className="showcase-preview" aria-label="Illustrative product preview">
        <div className="preview-window-top"><span className="preview-window-mark"><Activity size={13}/></span><b>Workspace overview</b><span className="preview-window-label">PRODUCT PREVIEW</span></div>
        <div className="preview-stat-row"><div className="preview-stat"><span>MEMBER DIRECTORY</span><b>Everything in one place</b><div className="preview-member-lines"><i/><i/><i/></div></div><div className="preview-stat"><span>ATTENDANCE ACTIVITY</span><b>See the bigger picture</b><div className="preview-bars"><i/><i/><i/><i/><i/><i/><i/></div></div></div>
        <div className="preview-followup"><span className="preview-followup-icon"><ShieldCheck size={15}/></span><div><b>Renewals, without the guesswork</b><span>A clear view of what needs attention.</span></div><ArrowRight size={15}/></div>
      </div>
      <div className="showcase-footer"><span>BUILT FOR THE EVERYDAY BUSINESS OF FITNESS</span><span>01 / OPERATIONS</span></div>
    </aside>
    <main className="auth-main"><section className="auth-card auth-card-premium"><div className="auth-mobile-brand"><BrandMark /></div><p className="auth-eyebrow">{mode === 'signin' ? 'YOUR WORKSPACE AWAITS' : 'START WITH A CLEARER WORKSPACE'}</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your owner account.'}</h1><p className="auth-intro">{mode === 'signin' ? 'Sign in to pick up where your gym left off.' : 'Set up an account for the person responsible for the gym.'}</p>
      <form className="auth-form" onSubmit={submitAuth}>
        {mode === 'signup' && <label>Owner name<input autoComplete="name" required minLength={2} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>}
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
        {mode === 'signup' && showResendConfirmation && <button className="auth-resend" type="button" onClick={resendConfirmation} disabled={resendingConfirmation}>{resendingConfirmation ? 'Requesting email…' : 'Resend confirmation email'}</button>}
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">{mode === 'signin' ? 'New to LiftDesk?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setShowResendConfirmation(false) }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      <p className="auth-security"><ShieldCheck size={16} /> Your gym data is protected by database access policies.</p>
    </section><p className="auth-main-foot">LIFTDESK <span>·</span> GYM OPERATIONS, MADE CLEARER</p></main>
  </div>

  if (needsWorkspace) return <div className="auth-screen"><section className="auth-card auth-card-theme"><BrandMark /><p className="auth-eyebrow">FIRST-TIME SETUP</p><h1>Set up your gym.</h1><p className="auth-intro">This creates a private workspace and assigns your account the owner role.</p>
    <form className="auth-form" onSubmit={submitWorkspace}>
      <label>Gym name<input required minLength={2} maxLength={120} value={gymName} onChange={e => setGymName(e.target.value)} placeholder="e.g. Power Fitness Club" /></label>
      <label>Owner name<input required minLength={2} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>
      <label>City <span className="optional-label">Optional</span><input value={city} onChange={e => setCity(e.target.value)} placeholder="Pune" /></label>
      <label>Gym phone <span className="optional-label">Optional</span><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91…" /></label>
      <GymThemeSelector value={gymTheme} onChange={setGymTheme} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Creating workspace…' : 'Create gym workspace'} <ArrowRight size={16} /></button>
    </form><button className="auth-signout" onClick={() => requireSupabase().auth.signOut()}>Sign out</button>
  </section></div>

  if (workspace) return <div className="gym-theme-boundary" data-theme={workspace.gym.theme}><div className="workspace-session-strip"><Building2 size={15} /><span>{workspace.gym.name}</span><span className="workspace-role">{workspace.role}</span><button onClick={() => requireSupabase().auth.signOut()}>Sign out</button></div><Suspense fallback={<div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={24}/><p>Opening your workspace…</p></div></div>}><LiveApp gym={workspace.gym} role={workspace.role} user={session.user} /></Suspense></div>
  return <div className="auth-screen"><section className="auth-card"><h1>Workspace unavailable</h1><p className="auth-intro">{error || 'We could not load a gym for this account.'}</p><button className="auth-submit" onClick={() => requireSupabase().auth.signOut()}>Sign out</button></section></div>
}

function BrandMark() {
  return <div className="auth-brand"><span><Activity size={19} strokeWidth={2.5} /></span><b>Lift<span>Desk</span></b></div>
}
