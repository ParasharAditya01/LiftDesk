import LiftDeskMark from './LiftDeskMark'

type LiftDeskLogoProps = {
  className?: string
  tagline?: boolean
  compact?: boolean
}

/** Shared LiftDesk wordmark and symbol used throughout the app. */
export default function LiftDeskLogo({ className = '', tagline = false, compact = false }: LiftDeskLogoProps) {
  return (
    <span className={`liftdesk-logo ${className}${compact ? ' liftdesk-logo-compact' : ''}`}>
      <LiftDeskMark size={compact ? 22 : 35} className="liftdesk-logo-symbol" />
      <span className="brand-name">
        Lift<span>Desk</span>
        {tagline && <small>GYM OPERATIONS</small>}
      </span>
    </span>
  )
}
