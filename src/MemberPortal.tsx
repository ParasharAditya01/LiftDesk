import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LoaderCircle, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import type { Gym } from './lib/gymData'
import { getOwnMemberProfile, type MemberProfile } from './lib/gymData'
import { requireSupabase } from './lib/supabase'
import { userFacingError } from './lib/userFacingError'
import LiftDeskMark from './LiftDeskMark'

export default function MemberPortal({ gym, user }: { gym: Gym; user: User }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getOwnMemberProfile(user.id)
      .then(value => { if (active) setProfile(value) })
      .catch(reason => { if (active) setError(userFacingError(reason, 'Could not load your member profile. Contact your gym staff.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id])

  const date = (value: string | null) => value
    ? new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'Not set'

  return <main className="auth-screen">
    <section className="auth-card" style={{ width: 'min(100%, 680px)' }}>
      <div className="auth-brand"><LiftDeskMark size={38} /><b>Lift<span>Desk</span></b></div>
      <p className="auth-eyebrow">MEMBER PORTAL</p>
      <h1>{gym.name}</h1>
      <p className="auth-intro">Your personal membership information. Only your own profile is shown here.</p>
      {loading ? <div className="auth-loading"><LoaderCircle className="spin" size={22}/><p>Loading your profile…</p></div> : error ? <p className="auth-error" role="alert">{error}</p> : profile && <>
        <div className="surface" style={{ padding: 22, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div className="metric-icon"><UserRound size={20}/></div>
            <div><h2 style={{ margin: 0 }}>{profile.full_name}</h2><p style={{ margin: '4px 0 0', color: 'var(--muted, #6b7280)' }}>Member profile · {profile.status}</p></div>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, margin: 0 }}>
            <ProfileField label="Phone number" value={profile.phone}/>
            <ProfileField label="WhatsApp number" value={profile.whatsapp_number || 'Not provided'}/>
            <ProfileField label="Age" value={profile.age == null ? 'Not provided' : String(profile.age) + ' years'}/>
            <ProfileField label="Weight" value={profile.weight_kg == null ? 'Not provided' : String(profile.weight_kg) + ' kg'}/>
            <ProfileField label="Height" value={profile.height_cm == null ? 'Not provided' : String(profile.height_cm) + ' cm'}/>
            <ProfileField label="Membership plan" value={profile.plan_name}/>
            <ProfileField label="Membership expiry" value={date(profile.membership_expires_on)}/>
          </dl>
        </div>
        <p className="auth-security"><ShieldCheck size={16}/> Profile details are read-only. Ask gym staff to correct an error.</p>
      </>}
      <button className="auth-signout" onClick={() => void requireSupabase().auth.signOut()}><LogOut size={16}/> Sign out</button>
    </section>
  </main>
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><dt style={{ fontSize: 12, color: 'var(--muted, #6b7280)', marginBottom: 6 }}>{label}</dt><dd style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</dd></div>
}
