import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createMemberCheckInClient } from './lib/supabase'

type Props = { gymId: string }
type Step = 'phone' | 'otp' | 'done'
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
    theme: 'light'
  }) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global { interface Window { turnstile?: TurnstileApi } }

export default function MemberCheckIn({ gymId }: Props) {
  const client = useMemo(() => {
    try { return createMemberCheckInClient() }
    catch { return null }
  }, [])
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [memberName, setMemberName] = useState('')
  const [gymName, setGymName] = useState('')
  const [checkedInAt, setCheckedInAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const captchaContainer = useRef<HTMLDivElement>(null)
  const captchaWidgetId = useRef('')
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()

  useEffect(() => {
    if (!turnstileSiteKey) return
    let active = true
    const renderWidget = () => {
      if (!active || !window.turnstile || !captchaContainer.current || captchaWidgetId.current) return
      captchaWidgetId.current = window.turnstile.render(captchaContainer.current, {
        sitekey: turnstileSiteKey,
        theme: 'light',
        callback: token => { setCaptchaToken(token); setCaptchaError('') },
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => { setCaptchaToken(''); setCaptchaError('Human check load nahi hua. Page reload karke dobara try karein.') },
      })
    }
    const failLoad = () => setCaptchaError('Human check service load nahi hui. Page reload karke dobara try karein.')
    const scriptSelector = 'script[data-liftdesk-turnstile]'
    let script = document.querySelector<HTMLScriptElement>(scriptSelector)
    if (window.turnstile) renderWidget()
    else {
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.liftdeskTurnstile = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', renderWidget)
      script.addEventListener('error', failLoad)
    }
    return () => {
      active = false
      script?.removeEventListener('load', renderWidget)
      script?.removeEventListener('error', failLoad)
      if (captchaWidgetId.current && window.turnstile) window.turnstile.remove(captchaWidgetId.current)
      captchaWidgetId.current = ''
    }
  }, [turnstileSiteKey])

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gymId)) {
    return <main className="member-checkin-screen"><section className="member-checkin-card"><Brand/><p className="auth-eyebrow">GYM MEMBER CHECK-IN</p><h1>QR code samajh nahi aaya.</h1><p className="member-checkin-copy">Gym ka universal QR dobara scan karein ya staff se naya code lein.</p></section></main>
  }
  if (!client) {
    return <main className="member-checkin-screen"><section className="member-checkin-card"><Brand/><p className="auth-eyebrow">GYM MEMBER CHECK-IN</p><h1>Check-in abhi tayyar nahi hai.</h1><p className="member-checkin-copy">Gym staff ko batayein ki LiftDesk ka phone check-in setup complete karna baaki hai.</p></section></main>
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    if (turnstileSiteKey && !captchaToken) { setCaptchaError('Pehle human check complete karein.'); return }
    let authPhone: string
    try { authPhone = normalizeIndianPhone(phone); setPhone(authPhone) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Mobile number check karein.'); return }
    setError(''); setNotice(''); setBusy(true)
    try {
      const { error: authError } = await client.auth.signInWithOtp({ phone: authPhone, options: captchaToken ? { captchaToken } : undefined })
      if (authError) throw authError
      setStep('otp')
      setNotice('SMS code bhej diya hai. Apne phone par mila 6-digit code enter karein.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SMS code send nahi ho saka. Number check karke dobara try karein.')
    } finally { resetCaptcha(); setBusy(false) }
  }

  async function verifyAndCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    setError(''); setNotice(''); setBusy(true)
    try {
      const { error: verifyError } = await client.auth.verifyOtp({ phone: phone.trim(), token: otp.trim(), type: 'sms' })
      if (verifyError) throw verifyError

      const { data, error: checkInError } = await client.rpc('check_in_with_phone_otp', { target_gym: gymId })
      if (checkInError) throw checkInError
      const result = Array.isArray(data) ? data[0] : data
      if (!result?.member_name || !result?.gym_name || !result?.checked_in_at) {
        throw new Error('Check-in confirm nahi ho saka. Gym staff se madad lein.')
      }
      setMemberName(result.member_name)
      setGymName(result.gym_name)
      setCheckedInAt(result.checked_in_at)
      setStep('done')
      await client.auth.signOut({ scope: 'local' })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Check-in complete nahi hua.'
      setError(friendlyCheckInError(message))
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    } finally { setBusy(false) }
  }

  async function resendCode() {
    if (!client) return
    if (turnstileSiteKey && !captchaToken) { setCaptchaError('Pehle human check complete karein.'); return }
    setError(''); setNotice(''); setBusy(true)
    try {
      const { error: resendError } = await client.auth.resend({ type: 'sms', phone: phone.trim(), options: captchaToken ? { captchaToken } : undefined })
      if (resendError) throw resendError
      setNotice('Naya SMS code bhej diya hai.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Abhi naya code nahi bhej paye. Thodi der baad try karein.')
    } finally { resetCaptcha(); setBusy(false) }
  }

  function resetCaptcha() {
    setCaptchaToken('')
    if (captchaWidgetId.current && window.turnstile) window.turnstile.reset(captchaWidgetId.current)
  }

  return <main className="member-checkin-screen">
    <section className="member-checkin-card">
      <Brand/>
      {step === 'done' ? <>
        <div className="member-checkin-success-mark"><CheckCircle2 size={30}/></div>
        <p className="auth-eyebrow">ATTENDANCE RECORDED</p>
        <h1>Welcome, {memberName}.</h1>
        <p className="member-checkin-copy">{gymName} mein aapka check-in ho gaya.</p>
        <p className="member-checkin-time">{new Date(checkedInAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </> : <>
        <p className="auth-eyebrow">GYM MEMBER CHECK-IN</p>
        <h1>{step === 'phone' ? 'Scan ke baad check in karein.' : 'Apna phone verify karein.'}</h1>
        <p className="member-checkin-copy">{step === 'phone' ? 'Apne membership mein registered mobile number dalein. Hum us par one-time SMS code bhejenge.' : 'Aapke registered phone par aaya 6-digit SMS code enter karein.'}</p>
        {step === 'phone' ? <form className="member-checkin-form" onSubmit={requestCode}>
          <label>Registered mobile number<input type="tel" autoComplete="tel" inputMode="tel" required value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label>
          <button className="auth-submit" type="submit" disabled={busy || Boolean(turnstileSiteKey && !captchaToken)}>{busy ? 'Code bhej rahe hain…' : 'SMS code bhejein'}</button>
        </form> : <form className="member-checkin-form" onSubmit={verifyAndCheckIn}>
          <label>6-digit SMS code<input type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Verify kar rahe hain…</> : 'Verify aur check in karein'}</button>
          <button className="member-checkin-resend" type="button" disabled={busy || Boolean(turnstileSiteKey && !captchaToken)} onClick={() => void resendCode()}>Code nahi mila? Dobara bhejein</button>
        </form>}
        {turnstileSiteKey && <div className="member-checkin-captcha"><div ref={captchaContainer}/>{captchaError && <p className="auth-error" role="alert">{captchaError}</p>}</div>}
        {notice && <p className="member-checkin-notice" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {step === 'otp' && <button className="member-checkin-back" type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); setNotice('') }}>Phone number badlein</button>}
        <p className="member-checkin-privacy"><ShieldCheck size={15}/> Phone verify hone ke baad hi gym membership match hogi.</p>
      </>}
    </section>
  </main>
}

function Brand() {
  return <div className="member-checkin-brand"><span><Activity size={19}/></span><b>Lift<span>Desk</span></b></div>
}

function normalizeIndianPhone(value: string): string {
  const trimmed = value.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return '+91' + digits
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) return '+' + digits
  throw new Error('10-digit Indian mobile number dalein, ya country code ke saath number likhein.')
}

function friendlyCheckInError(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('no member matches')) return 'Is number se is gym mein member record nahi mila. Registered number check karein ya gym staff se baat karein.'
  if (text.includes('multiple members match')) return 'Is number se multiple member records mile. Gym staff ko records theek karne honge.'
  if (text.includes('not active')) return 'Membership active nahi hai. Gym staff se contact karein.'
  if (text.includes('expired')) return 'Membership expire ho chuki hai. Gym staff se contact karein.'
  if (text.includes('checked in moments ago')) return 'Aapka check-in abhi haal hi mein record ho chuka hai.'
  if (text.includes('phone verification is required')) return 'Phone verification complete nahi hui. Code dobara enter karein.'
  return 'Check-in complete nahi hua. Number aur membership details gym staff se verify karein.'
}
