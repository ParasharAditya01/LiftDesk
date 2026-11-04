import { Check } from 'lucide-react'
import { gymThemes, type GymThemeId } from './lib/gymThemes'

export default function GymThemeSelector({ value, onChange }: { value: GymThemeId; onChange: (value: GymThemeId) => void }) {
  return <fieldset className="gym-theme-fieldset">
    <legend>Choose your gym’s look</legend>
    <p className="gym-theme-help">You can pick from these styles. This choice sets the colors for your gym dashboard.</p>
    <div className="gym-theme-grid">
      {gymThemes.map(theme => <label className="gym-theme-option" key={theme.id}>
        <input type="radio" name="gym-theme" value={theme.id} checked={value === theme.id} onChange={() => onChange(theme.id)} />
        <span className="gym-theme-preview" aria-hidden="true" style={{ background: theme.canvas }}>
          <span className="gym-theme-preview-sidebar" style={{ background: theme.sidebar }} />
          <span className="gym-theme-preview-main"><i style={{ background: 'accentSwatch' in theme ? theme.accentSwatch : theme.accent }} /><i /><i /></span>
        </span>
        <span className="gym-theme-option-copy"><b>{theme.name}</b><span className="gym-theme-swatches" aria-label="Theme colors"><i style={{ background: 'accentSwatch' in theme ? theme.accentSwatch : theme.accent }} /><i style={{ background: theme.sidebar }} /><i style={{ background: theme.canvas }} /></span></span>
        <span className="gym-theme-check" aria-hidden="true"><Check size={13} /></span>
      </label>)}
    </div>
  </fieldset>
}
