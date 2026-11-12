import { useCallback, useEffect, useRef, useState } from 'react'
import { QrCode, RotateCw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Gym } from './lib/gymData'
import { issueGymCheckInChallenge } from './lib/gymData'
import { userFacingError } from './lib/userFacingError'

export default function GymCheckInDisplay({ gym, onClose }: { gym: Gym; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [challenge, setChallenge] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [rotationAt, setRotationAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const rotate = useCallback(async () => {
    setLoading(true)
    setError('')
    setChallenge('')
    try {
      const issued = await issueGymCheckInChallenge(gym.id)
      const expiry = new Date(issued.expires_at).getTime()
      setChallenge(issued.challenge)
      setExpiresAt(expiry)
      setRotationAt(Date.now() + 30_000)
    } catch (reason) {
      setError(userFacingError(reason, 'Could not prepare the check-in code.'))
    } finally { setLoading(false) }
  }, [gym.id])

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', escape)
    void rotate()
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.removeEventListener('keydown', escape); window.clearInterval(clock) }
  }, [rotate])

  useEffect(() => {
    if (loading || !challenge) return
    const delay = Math.max(0, Math.min(rotationAt, expiresAt) - Date.now())
    const timer = window.setTimeout(() => { void rotate() }, delay)
    return () => window.clearTimeout(timer)
  }, [challenge, expiresAt, loading, rotate, rotationAt])

  const scanUrl = challenge
    ? `${window.location.origin}/?checkin=${encodeURIComponent(gym.id)}&challenge=${encodeURIComponent(challenge)}`
    : ''
  const seconds = Math.max(0, Math.ceil((rotationAt - now) / 1000))

  return <div className="gym-checkin-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="gym-checkin-display" role="dialog" aria-modal="true" aria-labelledby="gym-checkin-title">
      <button ref={closeRef} type="button" className="gym-checkin-close" onClick={onClose} aria-label="Close check-in display"><X size={20}/></button>
      <div className="gym-checkin-mark"><QrCode size={20}/></div>
      <p className="gym-checkin-eyebrow">MEMBER ATTENDANCE</p>
      <h2 id="gym-checkin-title">Scan to check in</h2>
      <p className="gym-checkin-gym">{gym.name}</p>
      <div className="gym-checkin-qr" aria-label="Rotating gym check-in QR code">
        {loading ? <span className="gym-checkin-loading">Preparing a secure code…</span> : scanUrl ? <QRCodeSVG value={scanUrl} size={320} level="M" marginSize={3} title={`Check in at ${gym.name}`} /> : <span className="gym-checkin-loading" role="alert">{error}</span>}
      </div>
      {error && challenge && <p className="gym-checkin-error" role="alert">{error}</p>}
      <p className="gym-checkin-instructions">Open your phone camera and scan this code. Sign in with your linked member account if asked.</p>
      <div className="gym-checkin-timer" role="status"><span className="gym-checkin-live-dot"/> New code in <b>{seconds}s</b></div>
      {error && <button type="button" className="button-secondary gym-checkin-retry" onClick={() => void rotate()}><RotateCw size={15}/> Try again</button>}
      <small>Codes refresh automatically and expire shortly after rotation.</small>
    </section>
  </div>
}
