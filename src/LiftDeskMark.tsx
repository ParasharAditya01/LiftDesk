import type { CSSProperties } from 'react'
import './liftdesk-mark.css'

type LiftDeskMarkProps = { className?: string; size?: number; style?: CSSProperties }

/** Official LiftDesk wordmark with its descriptor beneath it. */
export default function LiftDeskMark({ className = '', size = 35, style }: LiftDeskMarkProps) {
  return (
    <div className={`liftdesk-mark ${className}`.trim()} aria-hidden="true" style={{ width: size * 3, height: size, ...style }}>
      <img className="liftdesk-logo-dark" src="/liftdesk-logo.png" alt="" />
      <img className="liftdesk-logo-light" src="/liftdesk-logo-white.png" alt="" />
      <small>GYM MANAGEMENT PLATFORM</small>
    </div>
  )
}
