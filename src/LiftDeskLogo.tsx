import LiftDeskMark from './LiftDeskMark'

type LiftDeskLogoProps = { className?: string; tagline?: boolean; compact?: boolean }

/** Shared LiftDesk wordmark used throughout the app. */
export default function LiftDeskLogo({ className = '', compact = false }: LiftDeskLogoProps) {
  return <span className={`liftdesk-logo${className ? ` ${className}` : ''}${compact ? ' liftdesk-logo-compact' : ''}`}><LiftDeskMark size={compact ? 28 : 40} /></span>
}
