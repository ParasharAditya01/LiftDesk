import type { CSSProperties } from 'react'
import './liftdesk-mark.css'

type LiftDeskMarkProps = { className?: string; size?: number; style?: CSSProperties }

/** Brand mark is intentionally fixed-colour and independent of gym theme tokens. */
export default function LiftDeskMark({ className = '', size = 35, style }: LiftDeskMarkProps) {
  return (
    <span className={`liftdesk-mark ${className}`.trim()} style={{ width: size, height: size, ...style }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width="72%" height="72%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 13.5H17.5C20 13.5 20 16 20 18.5V21.5C20 24 22.5 26.5 25 26.5H32" stroke="#C5F36B" strokeWidth="3.2" strokeLinecap="round"/>
        <path d="M8 26.5H15C17.5 26.5 20 24 20 21.5V18.5C20 16 22.5 13.5 25 13.5H32" stroke="#F4F1E9" strokeWidth="3.2" strokeLinecap="round"/>
      </svg>
    </span>
  )
}
