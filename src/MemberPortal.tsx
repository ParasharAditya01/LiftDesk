import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, CalendarDays, CheckCircle2, Clock3, Dumbbell, LoaderCircle, ShieldCheck, Utensils, Weight } from 'lucide-react'
import type { Gym } from './lib/gymData'
import { getOwnCoachingRecords, getOwnMemberProfile, type CoachingPlan, type MemberProfile, type MemberProgress } from './lib/gymData'
import { userFacingError } from './lib/userFacingError'
import LiftDeskMark from './LiftDeskMark'
import FloatingGymChat from './FloatingGymChat'

type MemberCoaching = {
  diet: Omit<CoachingPlan, 'created_by' | 'created_at'>[]
  workout: Omit<CoachingPlan, 'created_by' | 'created_at'>[]
  progress: MemberProgress[]
}

type DietMeal = { slot: string; items: string }
type DietDay = { day: string; meals: DietMeal[] }
type Exercise = { name: string; sets: string; reps: string; load: string; duration: string; rest: string; instructions: string }
type WorkoutDay = { day: string; rest_day: boolean; exercises: Exercise[] }

const emptyCoaching: MemberCoaching = { diet: [], workout: [], progress: [] }
const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== ''
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase()

export default function MemberPortal({ gym, user }: { gym: Gym; user: User }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [coaching, setCoaching] = useState<MemberCoaching>(emptyCoaching)
  const [error, setError] = useState('')
  const [coachingError, setCoachingError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setCoachingError('')
    getOwnMemberProfile(user.id)
      .then(async value => {
        if (!active) return
        setProfile(value)
        try {
          const ownRecords = await getOwnCoachingRecords(value.gym_id, value.id)
          if (active) setCoaching(ownRecords)
        } catch (reason) {
          if (active) setCoachingError(userFacingError(reason, 'Your profile loaded, but coaching plans are temporarily unavailable.'))
        }
      })
      .catch(reason => { if (active) setError(userFacingError(reason, 'Could not load your member profile. Contact your gym staff.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id, reloadKey])

  const date = (value: string | null) => value
    ? new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'No expiry date set'

  const reload = () => {
    setProfile(null)
    setCoaching(emptyCoaching)
    setReloadKey(value => value + 1)
  }

  const activeDiet = coaching.diet.filter(plan => plan.status === 'active').length
  const activeWorkout = coaching.workout.filter(plan => plan.status === 'active').length
  const latestProgress = coaching.progress[0]
  const readableStatus = profile?.status ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : '—'

  return <main className="member-portal-shell">
    <header className="member-portal-header">
      <div className="member-portal-brand"><LiftDeskMark size={38}/><div><b>Lift<span>Desk</span></b><small>MEMBER PORTAL</small></div></div>
    </header>

    <div className="member-portal-content">
      {loading ? <section className="member-portal-loading" role="status"><LoaderCircle className="spin" size={23}/><p>Loading your membership…</p></section> : error ? <section className="member-portal-error" role="alert"><h1>We couldn’t load your member profile</h1><p>{error}</p><button type="button" className="member-portal-retry" onClick={reload}>Try again</button></section> : profile && <>
        <section className="member-portal-hero" aria-labelledby="member-portal-title">
          <div className="member-portal-hero-copy">
            <h1 id="member-portal-title">Your membership, at a glance.</h1>
            <p>Review your membership, coaching plans and progress at {gym.name}.</p>
          </div>
          <div className="member-portal-person">
            <div className="member-portal-avatar" aria-hidden="true">{initials(profile.full_name)}</div>
            <div className="member-portal-person-copy"><b>{profile.full_name}</b><span>Your member account</span></div>
            <span className={'member-portal-status member-status-' + profile.status}><i aria-hidden="true"/>{readableStatus}</span>
          </div>
        </section>

        <section className="member-portal-summary" aria-label="Membership and coaching summary">
          <SummaryItem label="Membership plan" value={profile.plan_name || 'Not set'} detail="Your current plan"/>
          <SummaryItem label="Membership status" value={readableStatus} detail="As recorded by your gym"/>
          <SummaryItem label="Membership expiry" value={date(profile.membership_expires_on)} detail="Contact the gym for renewal"/>
          <SummaryItem label="Current coaching" value={`${activeDiet + activeWorkout} active ${activeDiet + activeWorkout === 1 ? 'plan' : 'plans'}`} detail={`${activeDiet} diet · ${activeWorkout} workout`}/>
        </section>

        <nav className="member-portal-nav" aria-label="Member portal sections">
          <a href="#member-membership">Membership</a>
          <a href="#member-diet">Diet plan</a>
          <a href="#member-workout">Workout plan</a>
          <a href="#member-progress">Progress</a>
        </nav>

        {coachingError && <div className="member-portal-notice" role="alert"><span>{coachingError}</span><button type="button" onClick={reload}>Reload</button></div>}

        <section id="member-membership" className="member-portal-section" aria-labelledby="member-membership-title">
          <div className="member-portal-section-heading"><div><p className="member-portal-overline">ACCOUNT DETAILS</p><h2 id="member-membership-title">Membership</h2></div><span className="member-portal-section-meta">Managed by {gym.name}</span></div>
          <div className="member-membership-card">
            <div className="member-membership-mark"><CheckCircle2 size={19}/></div>
            <div className="member-membership-copy"><span>Membership plan</span><h3>{profile.plan_name || 'Plan not set'}</h3><p>Your gym staff can help with renewals and corrections.</p></div>
            <div className="member-membership-expiry"><span>Expires on</span><b>{date(profile.membership_expires_on)}</b></div>
          </div>
          <details className="member-personal-details">
            <summary>View personal details</summary>
            <dl>
              <ProfileField label="Phone" value={profile.phone || 'Not provided'}/>
              <ProfileField label="WhatsApp" value={profile.whatsapp_number || 'Not provided'}/>
              <ProfileField label="Age" value={profile.age == null ? 'Not provided' : `${profile.age} years`}/>
              <ProfileField label="Weight" value={profile.weight_kg == null ? 'Not provided' : `${profile.weight_kg} kg`}/>
              <ProfileField label="Height" value={profile.height_cm == null ? 'Not provided' : `${profile.height_cm} cm`}/>
            </dl>
            <p>These details are private to your account. Ask gym staff to correct anything that looks wrong.</p>
          </details>
        </section>

        <section id="member-diet" className="member-portal-section" aria-labelledby="member-diet-title">
          <div className="member-portal-section-heading"><div><p className="member-portal-overline">COACHING</p><h2 id="member-diet-title"><Utensils size={19}/> Diet plan</h2></div><span className="member-portal-section-meta">{coaching.diet.length} shared {coaching.diet.length === 1 ? 'plan' : 'plans'}</span></div>
          {coaching.diet.length ? <div className="member-plan-list">{coaching.diet.map(plan => <PlanCard key={plan.id} plan={plan} kind="diet" date={date}/>)}</div> : <EmptyPlan kind="diet"/>}
          {coaching.diet.length > 0 && <p className="member-plan-disclaimer"><ShieldCheck size={15}/> Nutrition targets are trainer-entered estimates, not medically validated. Ask a qualified healthcare professional about medical or significant dietary needs.</p>}
        </section>

        <section id="member-workout" className="member-portal-section" aria-labelledby="member-workout-title">
          <div className="member-portal-section-heading"><div><p className="member-portal-overline">COACHING</p><h2 id="member-workout-title"><Dumbbell size={20}/> Workout plan</h2></div><span className="member-portal-section-meta">{coaching.workout.length} shared {coaching.workout.length === 1 ? 'plan' : 'plans'}</span></div>
          {coaching.workout.length ? <div className="member-plan-list">{coaching.workout.map(plan => <PlanCard key={plan.id} plan={plan} kind="workout" date={date}/>)}</div> : <EmptyPlan kind="workout"/>}
        </section>

        <section id="member-progress" className="member-portal-section" aria-labelledby="member-progress-title">
          <div className="member-portal-section-heading"><div><p className="member-portal-overline">COACHING</p><h2 id="member-progress-title"><Activity size={20}/> Progress</h2></div><span className="member-portal-section-meta">{coaching.progress.length} {coaching.progress.length === 1 ? 'update' : 'updates'}</span></div>
          {latestProgress ? <div className="member-progress-list">{coaching.progress.map(item => <ProgressEntry key={item.id} item={item} date={date}/>)}</div> : <div className="member-portal-empty"><div className="member-empty-symbol"><Weight size={19}/></div><div><b>No progress updates yet</b><p>Your coach’s updates will appear here when they add them.</p></div></div>}
        </section>

        <footer className="member-portal-footer"><span><ShieldCheck size={15}/> You can only view your own membership and coaching records.</span><span>LiftDesk · {gym.name}</span></footer>
      </>}
    </div>
    {!loading && !error && profile && <FloatingGymChat gymId={gym.id} userId={user.id} gymName={gym.name} canManagePins={false}/>}
  </main>
}

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="member-summary-item"><span>{label}</span><b>{value}</b><small>{detail}</small></div>
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function EmptyPlan({ kind }: { kind: 'diet' | 'workout' }) {
  const label = kind === 'diet' ? 'diet plan' : 'workout plan'
  const Icon = kind === 'diet' ? Utensils : Dumbbell
  return <div className="member-portal-empty"><div className="member-empty-symbol"><Icon size={19}/></div><div><b>No {label} shared yet</b><p>When your coach publishes one for you, it will appear here.</p></div></div>
}

function PlanCard({ plan, kind, date }: { plan: Omit<CoachingPlan, 'created_by' | 'created_at'>; kind: 'diet' | 'workout'; date: (value: string | null) => string }) {
  const data = plan.plan_data
  const days = kind === 'diet'
    ? Array.isArray(data.meal_schedule) ? data.meal_schedule as DietDay[] : []
    : Array.isArray(data.workout_schedule) ? data.workout_schedule as WorkoutDay[] : []
  const values = kind === 'diet'
    ? [
        hasValue(data.calories_kcal) && { label: 'Calories', value: `${String(data.calories_kcal)} kcal/day` },
        hasValue(data.protein_g) && { label: 'Protein', value: `${String(data.protein_g)} g` },
        hasValue(data.carbohydrates_g) && { label: 'Carbohydrates', value: `${String(data.carbohydrates_g)} g` },
        hasValue(data.fat_g) && { label: 'Fat', value: `${String(data.fat_g)} g` },
        hasValue(data.water_litres) && { label: 'Water target', value: `${String(data.water_litres)} L/day` },
      ].filter((value): value is { label: string; value: string } => Boolean(value))
    : []
  const preference = String(kind === 'diet' ? data.dietary_preferences ?? '' : data.weekly_schedule ?? '').trim()
  const restrictions = String(kind === 'diet' ? data.restrictions ?? '' : data.equipment_or_limitations ?? '').trim()
  const details = String(data.details ?? '').trim()

  return <article className="member-plan-card">
    <header className="member-plan-header"><div><div className="member-plan-heading-line"><h3>{plan.name}</h3><span className={'member-plan-status member-plan-status-' + plan.status}>{plan.status}</span></div>{plan.objective && <p>{plan.objective}</p>}</div><span className="member-plan-dates"><CalendarDays size={14}/>{date(plan.starts_on)}{plan.ends_on ? ` – ${date(plan.ends_on)}` : ''}</span></header>
    {preference && <p className="member-plan-summary">{preference}</p>}
    {values.length > 0 && <dl className="member-plan-targets">{values.map(value => <div key={value.label}><dt>{value.label}</dt><dd>{value.value}</dd></div>)}</dl>}
    {days.length > 0 && <PlanSchedule kind={kind} days={days}/>}
    {(Boolean(restrictions) || hasValue(data.allergies) || hasValue(data.instructions)) && <div className="member-plan-notes">{restrictions && <p><b>{kind === 'diet' ? 'Restrictions' : 'Equipment or limitations'}</b>{restrictions}</p>}{kind === 'diet' && hasValue(data.allergies) && <p><b>Allergies</b>{String(data.allergies)}</p>}{kind === 'workout' && hasValue(data.instructions) && <p><b>Warm-up, cool-down and progression</b>{String(data.instructions)}</p>}</div>}
    {details && <details className="member-plan-details"><summary>{kind === 'diet' ? 'Trainer instructions' : 'Additional plan notes'}</summary><p>{details}</p></details>}
  </article>
}

function PlanSchedule({ kind, days }: { kind: 'diet' | 'workout'; days: DietDay[] | WorkoutDay[] }) {
  if (kind === 'diet') {
    return <div className="member-schedule-list">
      {(days as DietDay[]).map((day, index) => <section className="member-schedule-day" key={`${day.day}-${index}`}>
        <h4>{day.day}</h4>
        {day.meals?.length ? <div className="member-schedule-entries">{day.meals.map((meal, mealIndex) => <div className="member-schedule-entry" key={`${meal.slot}-${mealIndex}`}><b>{meal.slot}</b><p>{meal.items || 'No meal details added.'}</p></div>)}</div> : <p className="member-schedule-empty">No meals listed for this day.</p>}
      </section>)}
    </div>
  }

  return <div className="member-schedule-list">
    {(days as WorkoutDay[]).map((day, index) => <section className="member-schedule-day" key={`${day.day}-${index}`}>
      <h4>{day.day}{day.rest_day && <span>Rest</span>}</h4>
      {day.rest_day ? <p className="member-schedule-empty">Recovery day</p> : day.exercises?.length ? <div className="member-exercise-list">{day.exercises.map((exercise, exerciseIndex) => {
        const volume = [exercise.sets && `${exercise.sets} sets`, exercise.reps && `${exercise.reps} reps`].filter(Boolean).join(' × ')
        const notes = [exercise.load, exercise.duration, exercise.rest && `Rest ${exercise.rest}`].filter(Boolean).join(' · ')
        return <div className="member-exercise" key={`${exercise.name}-${exerciseIndex}`}>
          <div className="member-exercise-main"><b>{exercise.name}</b><span>{volume || 'Follow your coach’s instructions'}</span></div>
          {notes && <small>{notes}</small>}{exercise.instructions && <p>{exercise.instructions}</p>}
        </div>
      })}</div> : <p className="member-schedule-empty">No exercises listed for this day.</p>}
    </section>)}
  </div>
}

function ProgressEntry({ item, date }: { item: MemberProgress; date: (value: string | null) => string }) {
  const measurements = Object.entries(item.measurements ?? {}).filter(([, value]) => hasValue(value))
  return <article className="member-progress-entry">
    <div className="member-progress-date"><Clock3 size={15}/><time>{date(item.recorded_on)}</time></div>
    <div className="member-progress-body">
      <div className="member-progress-headline">{item.weight_kg != null && <p className="member-progress-weight"><Weight size={16}/><b>{item.weight_kg} kg</b><span>Body weight</span></p>}{item.milestone && <p className="member-progress-milestone">{item.milestone}</p>}</div>
      {measurements.length > 0 && <dl className="member-progress-measurements">{measurements.map(([key, value]) => <div key={key}><dt>{key.replace(/_cm$/i, '').replace(/_/g, ' ')}</dt><dd>{String(value)} cm</dd></div>)}</dl>}
      {item.workout_notes && <p className="member-progress-note"><b>Workout update</b>{item.workout_notes}</p>}
      {item.member_feedback && <p className="member-progress-note"><b>Your feedback</b>{item.member_feedback}</p>}
    </div>
  </article>
}
