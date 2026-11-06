import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, Building2, CalendarDays, Check, ClipboardCheck, Clock3, LoaderCircle, ShieldCheck } from 'lucide-react'
import { acceptMemberInvitation, createGymForCurrentUser, getCurrentGym, type Gym, type GymRole } from './lib/gymData'
import { acceptGymStaffInvitation } from './lib/staffData'
import { isSupabaseConfigured, requireSupabase } from './lib/supabase'
import GymThemeSelector from './GymThemeSelector'
import { DEFAULT_GYM_THEME, type GymThemeId } from './lib/gymThemes'
import LiftDeskMark from './LiftDeskMark'
import { userFacingError } from './lib/userFacingError'
import { authOAuthRedirectUrl, authRedirectUrl, classifySignupResult, CONFIRMATION_REQUEST_ACCEPTED_MESSAGE, createRequestLock, requestOwnerSignup, requestSignupConfirmation, SIGNUP_NEXT_STEP_MESSAGE } from './lib/authRegistration'

const LiveApp = lazy(() => import('./LiveApp'))
const MemberPortal = lazy(() => import('./MemberPortal'))

type Workspace = { gym: Gym; role: GymRole }
type Mode = 'signin' | 'signup'

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '')
  const [staffInviteToken, setStaffInviteToken] = useState(() => new URLSearchParams(window.location.search).get('staff_invite') || '')
  const [memberFullName, setMemberFullName] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [memberWhatsApp, setMemberWhatsApp] = useState('')
  const [memberAge, setMemberAge] = useState('')
  const [memberWeight, setMemberWeight] = useState('')
  const [memberHeight, setMemberHeight] = useState('')
  const invitationAttempt = useRef('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [needsWorkspace, setNeedsWorkspace] = useState(false)
  const [memberProfileRequired, setMemberProfileRequired] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [emailWaitSeconds, setEmailWaitSeconds] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [gymName, setGymName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [gymTheme, setGymTheme] = useState<GymThemeId>(DEFAULT_GYM_THEME)
  const authRequestLock = useRef(createRequestLock())

  useEffect(() => {
    if (emailWaitSeconds <= 0) return
    const timer = window.setTimeout(() => setEmailWaitSeconds(seconds => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [emailWaitSeconds])

  function startEmailCooldown() { setEmailWaitSeconds(60) }

  function logAuthCode(operation: string, value: unknown) {
    const code = (value as { code?: unknown } | null)?.code
    if (import.meta.env.DEV && typeof code === 'string') {
      // Log only the provider code, never the email address, raw message, or tokens.
      console.warn(`[LiftDesk auth] ${operation} failed`, { code })
    }
  }

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
    if (!session?.user) { setWorkspace(null); setNeedsWorkspace(false); setMemberProfileRequired(false); return }
    let alive = true
    setBusy(true)
    async function loadWorkspace() {
      try {
        if (staffInviteToken) {
          const key = session!.user.id + ':staff:' + staffInviteToken
          if (invitationAttempt.current !== key) {
            invitationAttempt.current = key
            try { await acceptGymStaffInvitation(staffInviteToken) }
            catch (err) { invitationAttempt.current = ''; throw err }
          }
          window.history.replaceState({}, '', window.location.pathname)
          if (alive) setStaffInviteToken('')
        } else if (inviteToken) {
          const key = session!.user.id + ':' + inviteToken
          if (invitationAttempt.current !== key) {
            invitationAttempt.current = key
            const meta = session!.user.user_metadata ?? {}
            if (!meta.member_full_name || !meta.member_phone || !meta.member_whatsapp || !meta.member_age || !meta.member_weight || !meta.member_height) {
              if (alive) setMemberProfileRequired(true)
              return
            }
            await acceptMemberInvitation({
              token: inviteToken,
              fullName: String(meta.member_full_name),
              phone: String(meta.member_phone),
              whatsappNumber: String(meta.member_whatsapp),
              age: Number(meta.member_age),
              weightKg: Number(meta.member_weight),
              heightCm: Number(meta.member_height),
            })
          }
          window.history.replaceState({}, '', window.location.pathname)
          if (alive) setInviteToken('')
        }
        const result = await getCurrentGym(session!.user)
        if (alive) { setWorkspace(result); setNeedsWorkspace(!result) }
      } catch (err) {
        if (alive) setError(userFacingError(err, 'Could not load your gym workspace. Check your connection and try again.'))
      } finally {
        if (alive) setBusy(false)
      }
    }
    void loadWorkspace()
    return () => { alive = false }
  }, [session?.user.id])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'signup' && emailWaitSeconds > 0) return
    if (!authRequestLock.current.tryAcquire()) return
    setError(''); setMessage(''); setSaving(true)
    try {
      const client = requireSupabase()
      if (mode === 'signup') {
        const { data, error: authError } = staffInviteToken
          ? await client.auth.signUp({
              email: email.trim(), password,
              options: {
                emailRedirectTo: authRedirectUrl(window.location.origin, import.meta.env.DEV, `${window.location.origin}/?staff_invite=${encodeURIComponent(staffInviteToken)}`),
                data: { full_name: ownerName.trim() },
              },
            })
          : await requestOwnerSignup(client.auth, {
              email: email.trim(), password, ownerName: ownerName.trim(), origin: window.location.origin, isDevelopment: import.meta.env.DEV,
            })
        if (authError) {
          logAuthCode('signup', authError)
          if ((authError as { code?: string }).code === 'over_email_send_rate_limit') {
            setShowResendConfirmation(true)
            startEmailCooldown()
          }
          throw authError
        }
        const signup = classifySignupResult(data.user, data.session)
        if (signup.kind === 'confirmation-pending' || signup.kind === 'existing-account') {
          setShowResendConfirmation(true)
          startEmailCooldown()
          setMessage(SIGNUP_NEXT_STEP_MESSAGE)
        } else if (signup.kind === 'signed-in') {
          setSession(signup.session)
        } else {
          throw new Error('Signup did not return an account or session. Please try again.')
        }
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) logAuthCode('sign-in', authError)
        if (authError?.code === 'email_not_confirmed') {
          setShowResendConfirmation(true)
          throw new Error('This account still needs email confirmation. Use the resend button below if you do not have a confirmation email.')
        }
        if (authError?.code === 'invalid_credentials') {
          throw new Error('Email or password was not accepted. If you just created this account, confirm your email first. Otherwise check the email address and password.')
        }
        if (authError) throw authError
        setSession(data.session)
      }
    } catch (err) { setError(userFacingError(err, 'Authentication failed. Check your details and try again.')) }
    finally { authRequestLock.current.release(); setSaving(false) }
  }

  async function signInWithGoogle(invitation: 'staff' | 'member' | 'none') {
    if (!authRequestLock.current.tryAcquire()) return
    setError(''); setMessage(''); setSaving(true)
    try {
      const redirect = authOAuthRedirectUrl(window.location.origin, import.meta.env.DEV, {
        inviteToken: invitation === 'member' ? inviteToken : undefined,
        staffInviteToken: invitation === 'staff' ? staffInviteToken : undefined,
      })
      const { error: oauthError } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirect, queryParams: { prompt: 'select_account' } },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      logAuthCode('Google sign-in', err)
      setError(userFacingError(err, 'Could not start Google sign-in. Please try again.'))
      authRequestLock.current.release()
      setSaving(false)
    }
  }

  async function submitMemberSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteToken || emailWaitSeconds > 0 || !authRequestLock.current.tryAcquire()) return
    setError(''); setMessage(''); setSaving(true)
    try {
      if (!/^\d{10}$/.test(memberPhone) || !/^\d{10}$/.test(memberWhatsApp)) {
        throw new Error('Phone and WhatsApp numbers must each contain exactly 10 digits.')
      }
      const redirect = new URL('/', window.location.origin)
      redirect.searchParams.set('invite', inviteToken)
      const { data, error: authError } = await requireSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectUrl(window.location.origin, import.meta.env.DEV, redirect.toString()),
          data: {
            full_name: memberFullName.trim(),
            member_full_name: memberFullName.trim(),
            member_phone: memberPhone.trim(),
            member_whatsapp: memberWhatsApp.trim(),
            member_age: Number(memberAge),
            member_weight: Number(memberWeight),
            member_height: Number(memberHeight),
          },
        },
      })
      if (authError) {
        logAuthCode('member signup', authError)
        if ((authError as { code?: string }).code === 'over_email_send_rate_limit') startEmailCooldown()
        throw authError
      }
      const signup = classifySignupResult(data.user, data.session)
      if (signup.kind === 'signed-in') setSession(signup.session)
      else if (signup.kind === 'confirmation-pending' || signup.kind === 'existing-account') {
        setShowResendConfirmation(true)
        setMessage(`${SIGNUP_NEXT_STEP_MESSAGE} The invitation link will be preserved if you resend.`)
        startEmailCooldown()
      } else throw new Error('Signup did not return an account. Please try again.')
    } catch (err) { setError(userFacingError(err, 'Could not create your member account. Check the details and try again.')) }
    finally { authRequestLock.current.release(); setSaving(false) }
  }

  async function submitGoogleMemberProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.user || !inviteToken || !authRequestLock.current.tryAcquire()) return
    setError(''); setSaving(true)
    try {
      if (!/^\d{10}$/.test(memberPhone) || !/^\d{10}$/.test(memberWhatsApp)) {
        throw new Error('Phone and WhatsApp numbers must each contain exactly 10 digits.')
      }
      await acceptMemberInvitation({
        token: inviteToken,
        fullName: memberFullName.trim(),
        phone: memberPhone.trim(),
        whatsappNumber: memberWhatsApp.trim(),
        age: Number(memberAge),
        weightKg: Number(memberWeight),
        heightCm: Number(memberHeight),
      })
      window.history.replaceState({}, '', window.location.pathname)
      setInviteToken('')
      setMemberProfileRequired(false)
      const result = await getCurrentGym(session.user)
      if (!result) throw new Error('Your member profile was created, but the gym workspace could not be loaded. Refresh and try again.')
      setWorkspace(result); setNeedsWorkspace(false)
    } catch (err) {
      setError(userFacingError(err, 'Could not finish your member profile. Check the details and try again.'))
    } finally {
      authRequestLock.current.release(); setSaving(false)
    }
  }

  async function resendConfirmation() {
    if (!authRequestLock.current.tryAcquire()) return
    if (emailWaitSeconds > 0) { authRequestLock.current.release(); return }
    setError(''); setMessage(''); setResendingConfirmation(true)
    try {
      const redirect = new URL('/', window.location.origin)
      if (inviteToken) redirect.searchParams.set('invite', inviteToken)
      if (staffInviteToken) redirect.searchParams.set('staff_invite', staffInviteToken)
      const { error: resendError } = await requestSignupConfirmation(requireSupabase().auth, {
        email: email.trim(), origin: window.location.origin, redirectTo: redirect.toString(), isDevelopment: import.meta.env.DEV,
      })
      if (resendError) logAuthCode('confirmation resend', resendError)
      if (resendError?.code === 'email_address_not_authorized') {
        throw new Error('Supabase is blocking this recipient because project email is not configured for general delivery. Configure custom SMTP in Supabase Authentication settings.')
      }
      if (resendError?.code === 'over_email_send_rate_limit') {
        startEmailCooldown()
        throw new Error('Supabase has reached its email sending limit. Wait before requesting another confirmation email.')
      }
      if (resendError) throw resendError
      setMessage(CONFIRMATION_REQUEST_ACCEPTED_MESSAGE)
      startEmailCooldown()
    } catch (err) {
      if ((err as { code?: string } | null)?.code === 'over_email_send_rate_limit') startEmailCooldown()
      setError(userFacingError(err, 'Unable to request confirmation email. Please try again later.'))
    } finally {
      authRequestLock.current.release()
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

  if (!session && staffInviteToken) return <div className="auth-screen"><section className="auth-card auth-card-theme"><BrandMark /><p className="auth-eyebrow">LIFTDESK STAFF INVITATION</p><h1>{mode === 'signin' ? 'Sign in to accept your invite.' : 'Create your staff account.'}</h1><p className="auth-intro">Use the email address this invitation was sent to. Your access will be linked to the gym and role assigned by its Owner or Admin.</p>
    <button className="auth-google" type="button" onClick={() => void signInWithGoogle('staff')} disabled={saving || resendingConfirmation}>
      <GoogleMark /> {saving ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
    <p className="auth-or">or use email and password</p>
    <form className="auth-form" onSubmit={submitAuth}>
      {mode === 'signup' && <label>Your name<input autoComplete="name" required minLength={2} maxLength={120} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>}
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Work email address" /></label>
      <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
      {showResendConfirmation && <button className="auth-resend" type="button" onClick={resendConfirmation} disabled={saving || resendingConfirmation || emailWaitSeconds > 0}>{resendingConfirmation ? 'Requesting email…' : emailWaitSeconds > 0 ? `Wait ${emailWaitSeconds}s to resend` : 'Resend confirmation email'}</button>}
      <button className="auth-submit" type="submit" disabled={saving || resendingConfirmation || (mode === 'signup' && emailWaitSeconds > 0)}>{saving ? 'Please wait…' : mode === 'signup' ? 'Create staff account' : 'Sign in and accept invitation'} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch">{mode === 'signin' ? 'New to LiftDesk?' : 'Already have an account?'} <button disabled={saving || resendingConfirmation} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setShowResendConfirmation(false) }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
    <p className="auth-security"><ShieldCheck size={16} /> This invitation is single-use, expires after 48 hours, and only works for its invited email.</p>
  </section></div>

  if (!session && inviteToken) return <div className="auth-screen"><section className="auth-card auth-card-theme"><BrandMark /><p className="auth-eyebrow">GYM MEMBER INVITATION</p><h1>Create your member account.</h1><p className="auth-intro">Continue with Google to avoid email confirmation. After sign-in, you’ll enter your member details. Or create an account using email and password below.</p>
    <button className="auth-google" type="button" onClick={() => void signInWithGoogle('member')} disabled={saving || resendingConfirmation}>
      <GoogleMark /> {saving ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
    <p className="auth-or">or use email and password</p>
    <form className="auth-form" onSubmit={submitMemberSignup}>
      <label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={memberFullName} onChange={e => setMemberFullName(e.target.value)} placeholder="Your full name" /></label>
      <label>Phone number<input autoComplete="tel-national" type="tel" inputMode="numeric" required minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits, without +91 or spaces." value={memberPhone} onChange={e => setMemberPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" /></label>
      <label>WhatsApp number<input type="tel" inputMode="numeric" required minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits, without +91 or spaces." value={memberWhatsApp} onChange={e => setMemberWhatsApp(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit WhatsApp number" /></label>
      <div className="form-two"><label>Age<input type="number" required min="13" max="120" value={memberAge} onChange={e => setMemberAge(e.target.value)} /></label><label>Weight (kg)<input type="number" required min="20" max="500" step="0.1" value={memberWeight} onChange={e => setMemberWeight(e.target.value)} /></label></div>
      <label>Height (cm)<input type="number" required min="80" max="260" step="0.1" value={memberHeight} onChange={e => setMemberHeight(e.target.value)} /></label>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
      {showResendConfirmation && <button className="auth-resend" type="button" onClick={resendConfirmation} disabled={saving || resendingConfirmation || emailWaitSeconds > 0}>{resendingConfirmation ? 'Requesting email…' : emailWaitSeconds > 0 ? `Wait ${emailWaitSeconds}s to resend` : 'Resend confirmation email'}</button>}
      <button className="auth-submit" type="submit" disabled={saving || resendingConfirmation || emailWaitSeconds > 0}>{saving ? 'Creating account…' : emailWaitSeconds > 0 ? `Wait ${emailWaitSeconds}s…` : 'Create member account'} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-security"><ShieldCheck size={16} /> This invitation is gym-specific, expires after 48 hours, and can be used once.</p>
  </section></div>

  if (!session) return <div className="auth-screen auth-screen-premium">
    <aside className="auth-showcase" aria-label="LiftDesk product introduction">
      <div className="showcase-top"><BrandMark /><span className="showcase-status">Gym management for owner-run teams</span></div>
      <div className="showcase-copy"><p className="showcase-kicker">Members · attendance · renewals</p><h2>Know who came in.<br /><span>Know what comes next.</span></h2><p>Keep membership records, check-ins, renewals, and follow-ups in one private workspace.</p></div>
      <section className="showcase-preview" aria-label="Sample LiftDesk workspace">
        <header className="preview-window-top"><span className="preview-window-mark"><Activity size={15}/></span><div className="preview-window-title"><b>Gym overview</b><span>Sample workspace</span></div><span className="preview-window-label">Sample data</span></header>
        <div className="preview-metrics" aria-label="Example workspace summary">
          <div className="preview-metric"><span>Active members</span><b>128</b></div>
          <div className="preview-metric"><span>Check-ins today</span><b>24</b></div>
          <div className="preview-metric preview-metric-accent"><span>Renewals due</span><b>6</b><small>Next 7 days</small></div>
        </div>
        <div className="preview-details">
          <section className="preview-list" aria-label="Recent check-ins">
            <h3><ClipboardCheck size={14}/> Recent check-ins</h3>
            <div className="preview-list-row"><span className="preview-person-mark">AS</span><span className="preview-row-copy"><b>Arjun S.</b><small>Checked in</small></span><time><Clock3 size={12}/> 08:42</time></div>
            <div className="preview-list-row"><span className="preview-person-mark">NP</span><span className="preview-row-copy"><b>Nisha P.</b><small>Checked in</small></span><time><Clock3 size={12}/> 08:16</time></div>
          </section>
          <section className="preview-list preview-renewals" aria-label="Upcoming renewals">
            <h3><CalendarDays size={14}/> Renewal watch</h3>
            <div className="preview-renewal-count"><b>6</b><span>members need a follow-up this week</span></div>
            <div className="preview-renewal-note"><Check size={13}/> Dates stay visible in your workspace</div>
          </section>
        </div>
      </section>
      <div className="showcase-footer"><span>Members</span><span>Attendance</span><span>Follow-ups</span></div>
    </aside>
    <main className="auth-main"><section className="auth-card auth-card-premium"><div className="auth-mobile-brand"><BrandMark /></div><p className="auth-eyebrow">{mode === 'signin' ? 'Gym workspace' : 'Owner account'}</p><h1>{mode === 'signin' ? 'Sign in to LiftDesk' : 'Create your owner account'}</h1><p className="auth-intro">{mode === 'signin' ? 'Open your gym workspace.' : 'Set up an account for the person responsible for the gym.'}</p>
      <form className="auth-form" onSubmit={submitAuth}>
        {mode === 'signup' && <label>Owner name<input autoComplete="name" required minLength={2} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>}
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
        {showResendConfirmation && <button className="auth-resend" type="button" onClick={resendConfirmation} disabled={saving || resendingConfirmation || emailWaitSeconds > 0}>{resendingConfirmation ? 'Requesting email…' : emailWaitSeconds > 0 ? `Wait ${emailWaitSeconds}s to resend` : 'Resend confirmation email'}</button>}
        <button className="auth-submit" type="submit" disabled={saving || resendingConfirmation || (mode === 'signup' && emailWaitSeconds > 0)}>{saving ? 'Please wait…' : mode === 'signup' && emailWaitSeconds > 0 ? `Please wait ${emailWaitSeconds}s…` : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button>
      </form>
      {mode === 'signin' && <>
        <p className="auth-or">or</p>
        <button className="auth-google" type="button" onClick={() => void signInWithGoogle('none')} disabled={saving || resendingConfirmation}>
          <GoogleMark /> {saving ? 'Connecting to Google…' : 'Continue with Google'}
        </button>
      </>}
      <p className="auth-switch">{mode === 'signin' ? 'New to LiftDesk?' : 'Already have an account?'} <button disabled={saving || resendingConfirmation} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setShowResendConfirmation(false) }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      <p className="auth-security"><ShieldCheck size={16} /> Your gym data is protected by database access policies.</p>
    </section><p className="auth-main-foot">LiftDesk <span>·</span> Gym operations, made clearer</p></main>
  </div>

  if (session && inviteToken && memberProfileRequired && !workspace) return <div className="auth-screen"><section className="auth-card auth-card-theme"><BrandMark /><p className="auth-eyebrow">GYM MEMBER INVITATION</p><h1>Complete your member profile.</h1><p className="auth-intro">Your Google account is signed in. Add these details to join the gym that invited you.</p>
    <form className="auth-form" onSubmit={submitGoogleMemberProfile}>
      <label>Google account<input type="email" value={session.user.email ?? ''} readOnly /></label>
      <label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={memberFullName} onChange={e => setMemberFullName(e.target.value)} placeholder="Your full name" /></label>
      <label>Phone number<input autoComplete="tel-national" type="tel" inputMode="numeric" required minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits, without +91 or spaces." value={memberPhone} onChange={e => setMemberPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" /></label>
      <label>WhatsApp number<input type="tel" inputMode="numeric" required minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits, without +91 or spaces." value={memberWhatsApp} onChange={e => setMemberWhatsApp(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit WhatsApp number" /></label>
      <div className="form-two"><label>Age<input type="number" required min="13" max="120" value={memberAge} onChange={e => setMemberAge(e.target.value)} /></label><label>Weight (kg)<input type="number" required min="20" max="500" step="0.1" value={memberWeight} onChange={e => setMemberWeight(e.target.value)} /></label></div>
      <label>Height (cm)<input type="number" required min="80" max="260" step="0.1" value={memberHeight} onChange={e => setMemberHeight(e.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Joining gym…' : 'Complete member setup'} <ArrowRight size={16} /></button>
    </form>
    <button className="auth-signout" type="button" onClick={() => void requireSupabase().auth.signOut()}>Sign out</button>
  </section></div>

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

  if (workspace?.role === 'member') return <div className="gym-theme-boundary" data-theme={workspace.gym.theme}><div className="workspace-session-strip"><Building2 size={15} /><span>{workspace.gym.name}</span><span className="workspace-role">Member</span><button onClick={() => void requireSupabase().auth.signOut()}>Sign out</button></div><Suspense fallback={<div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={24}/><p>Opening your member portal…</p></div></div>}><MemberPortal gym={workspace.gym} user={session!.user} /></Suspense></div>

  if (workspace) return <div className="gym-theme-boundary" data-theme={workspace.gym.theme}><div className="workspace-session-strip"><Building2 size={15} /><span>{workspace.gym.name}</span><span className="workspace-role">{workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}</span><button onClick={() => requireSupabase().auth.signOut()}>Sign out</button></div><Suspense fallback={<div className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={24}/><p>Opening your workspace…</p></div></div>}><LiveApp gym={workspace.gym} role={workspace.role} user={session.user} /></Suspense></div>
  return <div className="auth-screen"><section className="auth-card"><h1>Workspace unavailable</h1><p className="auth-intro">{error || 'We could not load a gym for this account.'}</p><button className="auth-submit" onClick={() => requireSupabase().auth.signOut()}>Sign out</button></section></div>
}

function BrandMark() {
  return <div className="auth-brand"><LiftDeskMark size={38} /><b>Lift<span>Desk</span></b></div>
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.88c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.93c4.47-4.13 7.18-10.21 7.18-17.58Z" transform="translate(0 1)"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1-.75-4.59c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.93 7.55 2.56 10.78l7.97-6.19Z" transform="translate(1 0)"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.78l-7.65-5.93c-2.13 1.43-4.85 2.27-8.25 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -2)"/>
  </svg>
}
