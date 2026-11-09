import type { CSSProperties } from 'react'
import './liftdesk-mark.css'

type LiftDeskMarkProps = { className?: string; size?: number; style?: CSSProperties }

/** Official LiftDesk wordmark with its descriptor beneath it. */
export default function LiftDeskMark({ className = '', size = 35, style }: LiftDeskMarkProps) {
  return (
    <span className={`liftdesk-mark ${className}`.trim()} aria-hidden="true" style={{ width: size * 3.5, height: size, ...style }}>
      <img src="/liftdesk-logo.png" alt="" />
      <small>GYM MANAGEMENT PLATFORM</small>
    </span>
  )
}
