import type { CSSProperties } from 'react'
import './liftdesk-mark.css'

type LiftDeskMarkProps = { className?: string; size?: number; style?: CSSProperties }

/** Official LiftDesk wordmark. */
export default function LiftDeskMark({ className = '', size = 35, style }: LiftDeskMarkProps) {
  return <img className={`liftdesk-mark ${className}`.trim()} src="/liftdesk-logo.png" alt="" aria-hidden="true" style={{ width: size * 2, height: size, ...style }} />
}
