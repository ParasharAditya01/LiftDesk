import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LoaderCircle, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import type { Gym } from './lib/gymData'
import { getOwnCoachingRecords, getOwnMemberProfile, type CoachingPlan, type MemberProfile, type MemberProgress } from './lib/gymData'
import { requireSupabase } from './lib/supabase'
import { userFacingError } from './lib/userFacingError'
import LiftDeskMark from './LiftDeskMark'

export default function MemberPortal({ gym, user }: { gym: Gym; user: User }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [coaching, setCoaching] = useState<{ diet: Omit<CoachingPlan, 'created_by' | 'created_at'>[]; workout: Omit<CoachingPlan, 'created_by' | 'created_at'>[]; progress: MemberProgress[] }>({ diet: [], workout: [], progress: [] })
  const [error, setError] = useState('')
  const [coachingError, setCoachingError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getOwnMemberProfile(user.id)
      .then(async value => {
        if (!active) return
        setProfile(value)
        try {
          const ownRecords = await getOwnCoachingRecords(value.gym_id, value.id)
          if (active) setCoaching(ownRecords)
        } catch (reason) { if (active) setCoachingError(userFacingError(reason, 'Your profile loaded, but coaching plans are temporarily unavailable.')) }
      })
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
        <div className="member-coaching-portal">
          {coachingError && <p className="auth-error" role="alert">{coachingError}</p>}
          <section className="surface member-portal-plans"><h2>Your diet plan</h2>{coaching.diet.length ? coaching.diet.map(plan => <article key={plan.id}><h3>{plan.name}</h3><p>{plan.objective} · {plan.starts_on}{plan.ends_on ? ` to ${plan.ends_on}` : ''}</p><div>{String(plan.plan_data.dietary_preferences ?? '')}</div><p>{String(plan.plan_data.restrictions ?? '')}{plan.plan_data.allergies ? ` · Allergies: ${String(plan.plan_data.allergies)}` : ''}</p><PlanScheduleList kind="diet" data={plan.plan_data}/><pre>{String(plan.plan_data.details ?? '')}</pre><small>Nutrition targets are trainer-entered estimates, not medically validated.</small></article>) : <p>No published diet plan is available yet.</p>}</section>
          <section className="surface member-portal-plans"><h2>Your workout plan</h2>{coaching.workout.length ? coaching.workout.map(plan => <article key={plan.id}><h3>{plan.name}</h3><p>{plan.objective} · {plan.starts_on}{plan.ends_on ? ` to ${plan.ends_on}` : ''}</p><div>{String(plan.plan_data.weekly_schedule ?? '')}</div><PlanScheduleList kind="workout" data={plan.plan_data}/><pre>{String(plan.plan_data.details ?? '')}</pre></article>) : <p>No published workout plan is available yet.</p>}</section>
          <section className="surface member-portal-plans"><h2>Your progress</h2>{coaching.progress.length ? coaching.progress.map(item => <article key={item.id}><h3>{date(item.recorded_on)}{item.weight_kg ? ` · ${item.weight_kg} kg` : ''}</h3>{Object.entries(item.measurements).some(([, value]) => value) && <p>Measurements (cm): {Object.entries(item.measurements).filter(([, value]) => value).map(([key, value]) => `${key.replace('_cm', '')} ${String(value)}`).join(' · ')}</p>}{item.milestone && <p>{item.milestone}</p>}{item.workout_notes && <p>{item.workout_notes}</p>}{item.member_feedback && <p>Your feedback: {item.member_feedback}</p>}</article>) : <p>No progress updates are available yet.</p>}</section>
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

function PlanScheduleList({ kind, data }: { kind: 'diet' | 'workout'; data: Record<string, unknown> }) {
  if (kind === 'diet') {
    const days = Array.isArray(data.meal_schedule) ? data.meal_schedule as { day: string; meals: { slot: string; items: string }[] }[] : []
    const targets = [data.calories_kcal && `${String(data.calories_kcal)} kcal/day`, data.protein_g && `${String(data.protein_g)} g protein`, data.carbohydrates_g && `${String(data.carbohydrates_g)} g carbohydrates`, data.fat_g && `${String(data.fat_g)} g fat`, data.water_litres && `${String(data.water_litres)} L water`].filter(Boolean)
    return <div className="member-plan-schedule">{targets.length > 0 && <p>Trainer-entered targets: {targets.join(' · ')}</p>}{days.map((day, index) => <section key={index}><b>{day.day}</b>{day.meals.map((meal, mealIndex) => <p key={mealIndex}><strong>{meal.slot}:</strong> {meal.items}</p>)}</section>)}</div>
  }
  const days = Array.isArray(data.workout_schedule) ? data.workout_schedule as { day: string; rest_day: boolean; exercises: { name: string; sets: string; reps: string; load: string; duration: string; rest: string; instructions: string }[] }[] : []
  return <div className="member-plan-schedule">{days.map((day, index) => <section key={index}><b>{day.day}{day.rest_day ? ' · Rest day' : ''}</b>{day.rest_day ? <p>Recovery day</p> : day.exercises.map((exercise, exerciseIndex) => <p key={exerciseIndex}><strong>{exercise.name}</strong> · {exercise.sets && `${exercise.sets} sets`} {exercise.reps && `× ${exercise.reps}`} {exercise.load && `· ${exercise.load}`} {exercise.duration && `· ${exercise.duration}`} {exercise.rest && `· Rest ${exercise.rest}`} {exercise.instructions && `· ${exercise.instructions}`}</p>)}</section>)}</div>
}
