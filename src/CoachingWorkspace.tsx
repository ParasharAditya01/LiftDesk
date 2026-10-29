import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Activity, Archive, ClipboardList, Dumbbell, LoaderCircle, Plus, Search, UserRound, Utensils, Weight } from 'lucide-react'
import { addCoachingNote, addMemberProgress, archiveCoachingPlan, createCoachingTemplate, listCoachingPlanSummary, listCoachingRecords, listCoachingTemplates, type AttendanceRecord, type CoachingNote, type CoachingPlan, type CoachingTemplate, type Gym, type GymMember, type MemberProgress } from './lib/gymData'
import { userFacingError } from './lib/userFacingError'

type Props = { gym: Gym; user: User; members: GymMember[]; attendance: AttendanceRecord[] }
type Tab = 'Overview' | 'Diet Plan' | 'Workout Plan' | 'Progress' | 'Coaching Notes' | 'Attendance'
const tabs: { name: Tab; icon: typeof UserRound }[] = [
  { name: 'Overview', icon: UserRound }, { name: 'Diet Plan', icon: Utensils }, { name: 'Workout Plan', icon: Dumbbell },
  { name: 'Progress', icon: Weight }, { name: 'Coaching Notes', icon: ClipboardList }, { name: 'Attendance', icon: Activity },
]
const today = () => new Date().toISOString().slice(0, 10)
const statusLabel = (status: string) => status[0].toUpperCase() + status.slice(1)
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase()
const editorKindTarget = (data: Record<string, unknown>, kind: 'diet' | 'workout') => kind === 'diet' ? data.dietary_preferences : data.weekly_schedule
type Meal = { slot: string; items: string }
type DietDay = { day: string; meals: Meal[] }
type Exercise = { name: string; sets: string; reps: string; load: string; duration: string; rest: string; instructions: string }
type WorkoutDay = { day: string; rest_day: boolean; exercises: Exercise[] }
const blankMeal = (): Meal => ({ slot: 'Breakfast', items: '' })
const blankExercise = (): Exercise => ({ name: '', sets: '', reps: '', load: '', duration: '', rest: '', instructions: '' })
const defaultDietDays = (): DietDay[] => [{ day: 'Monday', meals: [blankMeal()] }]
const defaultWorkoutDays = (): WorkoutDay[] => [{ day: 'Monday', rest_day: false, exercises: [blankExercise()] }]
const moveEntry = <T,>(entries: T[], index: number, offset: number) => { const next = [...entries]; const target = index + offset; if (target < 0 || target >= next.length) return next; [next[index], next[target]] = [next[target], next[index]]; return next }

export default function CoachingWorkspace({ gym, user, members, attendance }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [tab, setTab] = useState<Tab>('Overview')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [membershipFilter, setMembershipFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [summary, setSummary] = useState<{ diet: { member_id: string; status: string }[]; workout: { member_id: string; status: string }[]; progress: { member_id: string; recorded_on: string }[] }>({ diet: [], workout: [], progress: [] })
  const [records, setRecords] = useState<{ diet: CoachingPlan[]; workout: CoachingPlan[]; progress: MemberProgress[]; notes: CoachingNote[] }>({ diet: [], workout: [], progress: [], notes: [] })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<'diet' | 'workout' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [templates, setTemplates] = useState<CoachingTemplate[]>([])
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [planForm, setPlanForm] = useState({ name: '', objective: '', starts_on: today(), ends_on: '', status: 'draft', details: '', target: '', restrictions: '', allergies: '', calories: '', protein: '', carbs: '', fat: '', water: '' })
  const [dietDays, setDietDays] = useState<DietDay[]>(defaultDietDays)
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(defaultWorkoutDays)
  const [progressForm, setProgressForm] = useState({ recorded_on: today(), weight_kg: '', waist_cm: '', chest_cm: '', hips_cm: '', milestone: '', workout_notes: '', member_feedback: '', observations: '' })
  const [noteForm, setNoteForm] = useState({ category: 'general', note: '', follow_up_on: '' })

  const selected = members.find(member => member.id === selectedId) ?? null
  const memberAttendance = useMemo(() => attendance.filter(row => row.member_id === selectedId), [attendance, selectedId])
  useEffect(() => {
    let current = true
    listCoachingPlanSummary(gym.id).then(value => { if (current) setSummary(value) }).catch(reason => { if (current) setError(userFacingError(reason, 'Could not load coaching plan filters.')) })
    return () => { current = false }
  }, [gym.id])

  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesText = `${member.full_name} ${member.id}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = membershipFilter === 'all' || member.status === membershipFilter
    const hasDiet = summary.diet.some(plan => plan.member_id === member.id && plan.status === 'active')
    const hasWorkout = summary.workout.some(plan => plan.member_id === member.id && plan.status === 'active')
    const matchesPlans = planFilter === 'all' || (planFilter === 'diet' ? hasDiet : planFilter === 'workout' ? hasWorkout : hasDiet && hasWorkout)
    return matchesText && matchesStatus && matchesPlans
  }).sort((a, b) => sortBy === 'attendance' ? (attendance.find(row => row.member_id === b.id)?.checked_in_at ?? '').localeCompare(attendance.find(row => row.member_id === a.id)?.checked_in_at ?? '') : sortBy === 'progress' ? (summary.progress.find(row => row.member_id === b.id)?.recorded_on ?? '').localeCompare(summary.progress.find(row => row.member_id === a.id)?.recorded_on ?? '') : a.full_name.localeCompare(b.full_name)), [members, query, membershipFilter, planFilter, summary, sortBy, attendance])

  useEffect(() => {
    if (!selectedId) { setRecords({ diet: [], workout: [], progress: [], notes: [] }); return }
    let current = true
    setLoading(true); setError('')
    listCoachingRecords(gym.id, selectedId).then(value => { if (current) setRecords(value) }).catch(reason => { if (current) setError(userFacingError(reason, 'Could not load this member’s coaching records.')) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [gym.id, selectedId])

  useEffect(() => {
    if (!editor) { setTemplates([]); return }
    let current = true
    listCoachingTemplates(gym.id, editor).then(value => { if (current) setTemplates(value) }).catch(reason => { if (current) setError(userFacingError(reason, 'Could not load saved plan templates.')) })
    return () => { current = false }
  }, [gym.id, editor])

  function openPlan(kind: 'diet' | 'workout', plan?: CoachingPlan) {
    setEditor(kind); setEditingId(plan?.id ?? '')
    setSaveAsTemplate(false)
    const data = plan?.plan_data ?? {}
    setPlanForm({
      name: plan?.name ?? '', objective: plan?.objective ?? '', starts_on: plan?.starts_on ?? today(), ends_on: plan?.ends_on ?? '', status: plan?.status ?? 'draft',
      details: String(data.details ?? ''), target: String(editorKindTarget(data, kind) ?? ''), restrictions: String(data.restrictions ?? data.equipment_or_limitations ?? ''), allergies: String(data.allergies ?? data.instructions ?? ''), calories: String(data.calories_kcal ?? ''), protein: String(data.protein_g ?? ''), carbs: String(data.carbohydrates_g ?? ''), fat: String(data.fat_g ?? ''), water: String(data.water_litres ?? ''),
    })
    setDietDays(Array.isArray(data.meal_schedule) ? data.meal_schedule as DietDay[] : defaultDietDays())
    setWorkoutDays(Array.isArray(data.workout_schedule) ? data.workout_schedule as WorkoutDay[] : defaultWorkoutDays())
  }

  function duplicatePlan(kind: 'diet' | 'workout', plan: CoachingPlan) {
    openPlan(kind, plan)
    setEditingId('')
    setPlanForm(current => ({ ...current, name: `${current.name} copy`, status: 'draft' }))
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault(); if (!selected || !editor) return
    setSaving(true); setError(''); setNotice('')
    try {
      const base = { gym_id: gym.id, member_id: selected.id, name: planForm.name.trim(), starts_on: planForm.starts_on, ends_on: planForm.ends_on || null, status: planForm.status }
      const client = (await import('./lib/supabase')).requireSupabase()
      if (editor === 'diet') {
        const planData = { details: planForm.details, dietary_preferences: planForm.target, restrictions: planForm.restrictions, allergies: planForm.allergies, calories_kcal: planForm.calories, protein_g: planForm.protein, carbohydrates_g: planForm.carbs, fat_g: planForm.fat, water_litres: planForm.water, meal_schedule: dietDays }
        const result = editingId ? await client.from('diet_plans').update({ ...base, objective: planForm.objective, plan_data: planData }).eq('id', editingId).eq('gym_id', gym.id).eq('member_id', selected.id) : await client.from('diet_plans').insert({ ...base, created_by: user.id, objective: planForm.objective, plan_data: planData })
        if (result.error) throw result.error
      } else {
        const planData = { details: planForm.details, weekly_schedule: planForm.target, equipment_or_limitations: planForm.restrictions, instructions: planForm.allergies, workout_schedule: workoutDays }
        const result = editingId ? await client.from('workout_plans').update({ ...base, goal: planForm.objective, plan_data: planData }).eq('id', editingId).eq('gym_id', gym.id).eq('member_id', selected.id) : await client.from('workout_plans').insert({ ...base, created_by: user.id, goal: planForm.objective, plan_data: planData })
        if (result.error) throw result.error
      }
      let templateSaved = false
      let templateFailed = false
      if (saveAsTemplate) {
        try {
          const templatePlanData = editor === 'diet' ? { details: planForm.details, dietary_preferences: planForm.target, restrictions: planForm.restrictions, allergies: planForm.allergies, calories_kcal: planForm.calories, protein_g: planForm.protein, carbohydrates_g: planForm.carbs, fat_g: planForm.fat, water_litres: planForm.water, meal_schedule: dietDays } : { details: planForm.details, weekly_schedule: planForm.target, equipment_or_limitations: planForm.restrictions, instructions: planForm.allergies, workout_schedule: workoutDays }
          await createCoachingTemplate(gym.id, user.id, { kind: editor, name: planForm.name.trim(), objective: planForm.objective, plan_data: templatePlanData })
          templateSaved = true
        } catch { templateFailed = true }
      }
      await reload(); setEditor(null); setNotice(templateSaved ? 'Plan saved and reusable template created.' : templateFailed ? 'Plan saved, but the reusable template could not be saved. Try creating it again later.' : `Plan saved for ${selected.full_name}.`)
    } catch (reason) { setError(userFacingError(reason, 'Could not save the plan. Check the details and try again.')) }
    finally { setSaving(false) }
  }

  async function reload() {
    if (!selected) return
    setRecords(await listCoachingRecords(gym.id, selected.id))
  }

  async function archive(kind: 'diet' | 'workout', plan: CoachingPlan) {
    if (!selected || !window.confirm(`Archive “${plan.name}”?`)) return
    try { await archiveCoachingPlan(gym.id, selected.id, kind, plan.id); await reload(); setNotice('Plan archived.') }
    catch (reason) { setError(userFacingError(reason, 'Could not archive this plan.')) }
  }

  async function saveProgress(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    setSaving(true); setError('')
    try {
      await addMemberProgress(gym.id, selected.id, user.id, { recorded_on: progressForm.recorded_on, weight_kg: progressForm.weight_kg ? Number(progressForm.weight_kg) : null, measurements: { waist_cm: progressForm.waist_cm, chest_cm: progressForm.chest_cm, hips_cm: progressForm.hips_cm }, milestone: progressForm.milestone, workout_notes: progressForm.workout_notes, member_feedback: progressForm.member_feedback, observations: progressForm.observations })
      setProgressForm({ recorded_on: today(), weight_kg: '', waist_cm: '', chest_cm: '', hips_cm: '', milestone: '', workout_notes: '', member_feedback: '', observations: '' }); await reload(); setNotice('Progress update saved.')
    } catch (reason) { setError(userFacingError(reason, 'Could not save this progress update.')) }
    finally { setSaving(false) }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    setSaving(true); setError('')
    try { await addCoachingNote(gym.id, selected.id, user.id, noteForm); setNoteForm({ category: 'general', note: '', follow_up_on: '' }); await reload(); setNotice('Coaching note added to the history.') }
    catch (reason) { setError(userFacingError(reason, 'Could not save this coaching note.')) }
    finally { setSaving(false) }
  }

  return <div className="coaching-workspace">
    {!selected ? <>
      <section className="surface coaching-directory">
        <div className="coaching-toolbar">
          <label className="search-box"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search member name or ID" aria-label="Search members"/></label>
          <label className="coaching-filter">Membership<select value={membershipFilter} onChange={event => setMembershipFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="paused">Paused</option></select></label>
          <label className="coaching-filter">Active plans<select value={planFilter} onChange={event => setPlanFilter(event.target.value)}><option value="all">Any</option><option value="diet">Diet plan</option><option value="workout">Workout plan</option><option value="both">Diet and workout</option></select></label>
          <label className="coaching-filter">Sort by<select value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="name">Name</option><option value="attendance">Recent attendance</option><option value="progress">Latest progress</option></select></label>
          <span className="coaching-count">{filteredMembers.length} members</span>
        </div>
        {error && <div role="alert" className="coaching-message coaching-error">{error}</div>}
        <div className="coaching-member-list">{filteredMembers.map(member => {
          const latestAttendance = attendance.find(row => row.member_id === member.id)
          return <button type="button" className="coaching-member-row" key={member.id} onClick={() => { setSelectedId(member.id); setTab('Overview'); setNotice('') }}>
            <span className="coaching-avatar">{initials(member.full_name)}</span><span className="coaching-member-copy"><b>{member.full_name}</b><small>Member ID · {member.id.slice(0, 8)} · {member.plan_name}</small></span>
            <span className={'coaching-status status-' + member.status}>{statusLabel(member.status)}</span><span className="coaching-recent">{latestAttendance ? `Last visit ${new Date(latestAttendance.checked_in_at).toLocaleDateString('en-IN')}` : 'No attendance yet'} · {summary.diet.some(plan => plan.member_id === member.id && plan.status === 'active') ? 'Diet active' : 'No diet'} · {summary.workout.some(plan => plan.member_id === member.id && plan.status === 'active') ? 'Workout active' : 'No workout'}</span><span className="coaching-open">Open profile →</span>
          </button>
        })}{filteredMembers.length === 0 && <div className="empty-state" role="status">{members.length ? 'No members match these filters.' : 'No member records in this gym yet.'}</div>}</div>
      </section>
      <p className="coaching-privacy">Member coaching records are private to authorized staff in {gym.name}. Member access is limited to published plans and their own progress.</p>
    </> : <>
      <div className="coaching-profile-heading"><button type="button" className="button-secondary" onClick={() => { setSelectedId(''); setTab('Overview') }}>← All members</button><div className="coaching-profile-person"><span className="coaching-avatar">{initials(selected.full_name)}</span><span><h2>{selected.full_name}</h2><p>ID {selected.id.slice(0, 8)} · {selected.plan_name} · {statusLabel(selected.status)}{selected.membership_expires_on ? ` · Expires ${selected.membership_expires_on}` : ''}</p></span></div><span className="coaching-profile-spacer"/></div>
      <nav className="coaching-tabs" aria-label="Member coaching sections">{tabs.map(({ name, icon: Icon }) => <button type="button" key={name} aria-current={tab === name ? 'page' : undefined} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon size={16}/>{name}</button>)}</nav>
      {error && <div role="alert" className="coaching-message coaching-error">{error}</div>}{notice && <div role="status" className="coaching-message">{notice}</div>}
      {loading ? <div className="surface live-loading" aria-busy="true"><LoaderCircle className="spin" size={22}/><p>Loading coaching records…</p></div> : <>
        {tab === 'Overview' && <div className="coaching-overview-grid">
          <section className="surface coaching-overview-card"><div className="coaching-card-title"><UserRound size={17}/><h3>Member overview</h3></div><p>Membership is <b>{statusLabel(selected.status)}</b>. {selected.membership_expires_on ? `Expires ${selected.membership_expires_on}.` : 'No expiry date recorded.'}</p><p>Recent attendance: <b>{memberAttendance[0] ? new Date(memberAttendance[0].checked_in_at).toLocaleString('en-IN') : 'No check-ins recorded'}</b></p><p>Trainer assignment: <b>Not tracked in the current membership data</b></p></section>
          <section className="surface coaching-overview-card"><div className="coaching-card-title"><Utensils size={17}/><h3>Current plans</h3></div><p>Diet plan: <b>{records.diet.find(plan => plan.status === 'active')?.name ?? 'No active plan'}</b></p><p>Workout plan: <b>{records.workout.find(plan => plan.status === 'active')?.name ?? 'No active plan'}</b></p><p>Latest progress: <b>{records.progress[0]?.recorded_on ?? 'No progress update'}</b></p></section>
          <section className="surface coaching-overview-card"><div className="coaching-card-title"><ClipboardList size={17}/><h3>Latest trainer note</h3></div><p>{records.notes[0]?.note ?? 'No coaching notes yet.'}</p>{records.notes[0]?.follow_up_on && <small>Follow-up · {records.notes[0].follow_up_on}</small>}</section>
          <section className="surface coaching-overview-card"><div className="coaching-card-title"><Activity size={17}/><h3>Recent attendance</h3></div>{memberAttendance.slice(0, 5).map(row => <p key={row.id}>{new Date(row.checked_in_at).toLocaleString('en-IN')} · {row.method === 'qr' ? 'QR check-in' : 'Manual check-in'}</p>)}{!memberAttendance.length && <p>No attendance history is available.</p>}</section>
        </div>}
        {tab === 'Diet Plan' && <PlanPanel kind="diet" plans={records.diet} onCreate={() => openPlan('diet')} onEdit={plan => openPlan('diet', plan)} onDuplicate={plan => duplicatePlan('diet', plan)} onArchive={plan => void archive('diet', plan)}/>}
        {tab === 'Workout Plan' && <PlanPanel kind="workout" plans={records.workout} onCreate={() => openPlan('workout')} onEdit={plan => openPlan('workout', plan)} onDuplicate={plan => duplicatePlan('workout', plan)} onArchive={plan => void archive('workout', plan)}/>}
        {tab === 'Progress' && <div className="coaching-detail-grid"><form className="surface coaching-form" onSubmit={saveProgress}><h3>Record progress</h3><p>Record only information the member has chosen to share.</p><label>Date<input type="date" required value={progressForm.recorded_on} onChange={event => setProgressForm({ ...progressForm, recorded_on: event.target.value })}/></label><label>Body weight (kg)<input type="number" min="20" max="500" step="0.1" value={progressForm.weight_kg} onChange={event => setProgressForm({ ...progressForm, weight_kg: event.target.value })}/></label><div className="form-two"><label>Waist (cm)<input type="number" min="0" step="0.1" value={progressForm.waist_cm} onChange={event => setProgressForm({ ...progressForm, waist_cm: event.target.value })}/></label><label>Chest (cm)<input type="number" min="0" step="0.1" value={progressForm.chest_cm} onChange={event => setProgressForm({ ...progressForm, chest_cm: event.target.value })}/></label></div><label>Hips (cm)<input type="number" min="0" step="0.1" value={progressForm.hips_cm} onChange={event => setProgressForm({ ...progressForm, hips_cm: event.target.value })}/></label><label>Strength or endurance milestone<textarea value={progressForm.milestone} onChange={event => setProgressForm({ ...progressForm, milestone: event.target.value })}/></label><label>Workout completion notes<textarea value={progressForm.workout_notes} onChange={event => setProgressForm({ ...progressForm, workout_notes: event.target.value })}/></label><label>Member feedback<textarea value={progressForm.member_feedback} onChange={event => setProgressForm({ ...progressForm, member_feedback: event.target.value })}/></label><label>Coaching observations<textarea value={progressForm.observations} onChange={event => setProgressForm({ ...progressForm, observations: event.target.value })}/></label><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save progress update'}</button></form><section className="surface coaching-history"><h3>Progress history</h3>{records.progress.map(item => <article className="coaching-history-item" key={item.id}><b>{item.recorded_on}{item.weight_kg ? ` · ${item.weight_kg} kg` : ''}</b>{Object.entries(item.measurements).some(([, value]) => value) && <p>Measurements (cm): {Object.entries(item.measurements).filter(([, value]) => value).map(([key, value]) => `${key.replace('_cm', '')} ${value}`).join(' · ')}</p>}{item.milestone && <p>{item.milestone}</p>}{item.workout_notes && <p>{item.workout_notes}</p>}{item.member_feedback && <p>Member feedback: {item.member_feedback}</p>}{item.observations && <p>{item.observations}</p>}</article>)}{!records.progress.length && <p className="coaching-empty">No progress recorded yet.</p>}</section></div>}
        {tab === 'Coaching Notes' && <div className="coaching-detail-grid"><form className="surface coaching-form" onSubmit={saveNote}><h3>Add coaching note</h3><p>Notes are time-stamped and kept as an append-only history.</p><label>Category<select value={noteForm.category} onChange={event => setNoteForm({ ...noteForm, category: event.target.value })}><option value="general">General</option><option value="diet">Diet</option><option value="workout">Workout</option><option value="follow-up">Follow-up</option></select></label><label>Note<textarea required minLength={1} maxLength={5000} value={noteForm.note} onChange={event => setNoteForm({ ...noteForm, note: event.target.value })}/></label><label>Follow-up date (optional)<input type="date" value={noteForm.follow_up_on} onChange={event => setNoteForm({ ...noteForm, follow_up_on: event.target.value })}/></label><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Add note'}</button></form><section className="surface coaching-history"><h3>Notes history</h3>{records.notes.map(note => <article className="coaching-history-item" key={note.id}><b>{note.category} · {new Date(note.created_at).toLocaleString('en-IN')}</b><p>{note.note}</p>{note.follow_up_on && <small>Follow-up · {note.follow_up_on}</small>}</article>)}{!records.notes.length && <p className="coaching-empty">No notes yet.</p>}</section></div>}
        {tab === 'Attendance' && <section className="surface coaching-history"><h3>Attendance history</h3>{memberAttendance.map(row => <article className="coaching-history-item" key={row.id}><b>{new Date(row.checked_in_at).toLocaleString('en-IN')}</b><p>{row.method === 'qr' ? 'QR check-in' : 'Manual check-in'}</p></article>)}{!memberAttendance.length && <p className="coaching-empty">No attendance recorded for this member.</p>}</section>}
      </>}
    </>}
    {editor && selected && <div className="modal-backdrop" role="presentation"><section className="member-modal coaching-plan-modal" role="dialog" aria-modal="true" aria-labelledby="coaching-plan-title"><div className="modal-heading"><div><p className="auth-eyebrow">{editor === 'diet' ? 'PERSONALIZED NUTRITION' : 'DAY-WISE TRAINING'}</p><h2 id="coaching-plan-title">{editingId ? 'Edit' : 'Create'} {editor === 'diet' ? 'diet' : 'workout'} plan</h2></div><button type="button" className="button-secondary" onClick={() => setEditor(null)}>Close</button></div><form onSubmit={savePlan}>{templates.length > 0 && <label>Use a saved template<select defaultValue="" onChange={event => { const template = templates.find(item => item.id === event.target.value); if (!template) return; const data = template.plan_data; setEditingId(""); setPlanForm(current => ({ ...current, name: template.name, objective: template.objective, details: String(data.details ?? ""), target: String(editorKindTarget(data, editor) ?? ""), restrictions: String(data.restrictions ?? data.equipment_or_limitations ?? ""), allergies: String(data.allergies ?? data.instructions ?? ""), calories: String(data.calories_kcal ?? ""), protein: String(data.protein_g ?? ""), carbs: String(data.carbohydrates_g ?? ""), fat: String(data.fat_g ?? ""), water: String(data.water_litres ?? ""), status: "draft" })); setDietDays(Array.isArray(data.meal_schedule) ? data.meal_schedule as DietDay[] : defaultDietDays()); setWorkoutDays(Array.isArray(data.workout_schedule) ? data.workout_schedule as WorkoutDay[] : defaultWorkoutDays()) }}><option value="">Choose a reusable template</option>{templates.map(template => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>}<label>Plan name<input required minLength={2} maxLength={120} value={planForm.name} onChange={event => setPlanForm({ ...planForm, name: event.target.value })}/></label><label>{editor === 'diet' ? 'Objective' : 'Training goal'}<input value={planForm.objective} onChange={event => setPlanForm({ ...planForm, objective: event.target.value })} placeholder={editor === 'diet' ? 'e.g. Build consistent meal habits' : 'e.g. General fitness, strength, endurance'}/></label><div className="form-two"><label>Start date<input type="date" required value={planForm.starts_on} onChange={event => setPlanForm({ ...planForm, starts_on: event.target.value })}/></label><label>End date (optional)<input type="date" min={planForm.starts_on} value={planForm.ends_on} onChange={event => setPlanForm({ ...planForm, ends_on: event.target.value })}/></label></div><label>Status<select value={planForm.status} onChange={event => setPlanForm({ ...planForm, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>{editor === 'diet' ? <><label>Preferences and goal<textarea value={planForm.target} onChange={event => setPlanForm({ ...planForm, target: event.target.value })} placeholder="Dietary preferences and meal timing"/></label><div className="form-two"><label>Restrictions<textarea value={planForm.restrictions} onChange={event => setPlanForm({ ...planForm, restrictions: event.target.value })}/></label><label>Allergies (if shared)<textarea value={planForm.allergies} onChange={event => setPlanForm({ ...planForm, allergies: event.target.value })}/></label></div><div className="form-two"><label>Calories (optional)<input inputMode="numeric" value={planForm.calories} onChange={event => setPlanForm({ ...planForm, calories: event.target.value })}/></label><label>Water target (L/day)<input inputMode="decimal" value={planForm.water} onChange={event => setPlanForm({ ...planForm, water: event.target.value })}/></label></div><div className="form-two"><label>Protein (g)<input inputMode="numeric" value={planForm.protein} onChange={event => setPlanForm({ ...planForm, protein: event.target.value })}/></label><label>Carbohydrates (g)<input inputMode="numeric" value={planForm.carbs} onChange={event => setPlanForm({ ...planForm, carbs: event.target.value })}/></label></div><label>Fat (g)<input inputMode="numeric" value={planForm.fat} onChange={event => setPlanForm({ ...planForm, fat: event.target.value })}/></label><DietScheduleEditor days={dietDays} onChange={setDietDays}/><label>Trainer instructions<textarea value={planForm.details} onChange={event => setPlanForm({ ...planForm, details: event.target.value })}/></label><p className="coaching-medical-note">Nutrition values are trainer-entered estimates, not medically validated. Members with medical conditions, pregnancy, eating-disorder concerns or significant dietary restrictions should consult a qualified healthcare professional or registered dietitian.</p></> : <><label>Weekly schedule overview<textarea value={planForm.target} onChange={event => setPlanForm({ ...planForm, target: event.target.value })} placeholder="Goals and weekly rhythm"/></label><label>Equipment or limitations<textarea value={planForm.restrictions} onChange={event => setPlanForm({ ...planForm, restrictions: event.target.value })}/></label><label>Warm-up, cool-down and progression notes<textarea value={planForm.allergies} onChange={event => setPlanForm({ ...planForm, allergies: event.target.value })}/></label><WorkoutScheduleEditor days={workoutDays} onChange={setWorkoutDays}/><label>Additional plan notes<textarea value={planForm.details} onChange={event => setPlanForm({ ...planForm, details: event.target.value })}/></label></>}<label className="template-save-check"><input type="checkbox" checked={saveAsTemplate} onChange={event => setSaveAsTemplate(event.target.checked)}/>Save this plan as a reusable template for this gym</label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button></div></form></section></div>}
  </div>
}

function PlanPanel({ kind, plans, onCreate, onEdit, onDuplicate, onArchive }: { kind: 'diet' | 'workout'; plans: CoachingPlan[]; onCreate: () => void; onEdit: (plan: CoachingPlan) => void; onDuplicate: (plan: CoachingPlan) => void; onArchive: (plan: CoachingPlan) => void }) {
  return <section className="surface coaching-history"><div className="coaching-panel-heading"><div><h3>{kind === 'diet' ? 'Diet plans' : 'Workout plans'}</h3><p>Plans are stored for this member only.</p></div><button type="button" className="button-primary" onClick={onCreate}><Plus size={16}/>Create plan</button></div>{plans.map(plan => <article className="coaching-plan-card" key={plan.id}><div className="coaching-plan-head"><div><h4>{plan.name}</h4><p>{plan.objective} · {plan.starts_on}{plan.ends_on ? ` to ${plan.ends_on}` : ''}</p></div><span className={'coaching-plan-status plan-' + plan.status}>{statusLabel(plan.status)}</span></div><div className="coaching-plan-copy"><p>{kind === 'diet' ? plan.plan_data.dietary_preferences as string : plan.plan_data.weekly_schedule as string}</p><PlanSchedule kind={kind} data={plan.plan_data}/><p>{plan.plan_data.details as string}</p>{kind === 'diet' && <small>Nutrition values are trainer-entered estimates only.</small>}</div><div className="coaching-plan-actions"><button type="button" className="button-secondary" onClick={() => onEdit(plan)}>Edit plan</button><button type="button" className="button-secondary" onClick={() => onDuplicate(plan)}>Duplicate plan</button>{plan.status !== 'archived' && <button type="button" className="button-secondary" onClick={() => onArchive(plan)}><Archive size={14}/>Archive</button>}</div></article>)}{!plans.length && <div className="empty-state"><p>No {kind} plan yet.</p><button type="button" className="button-primary" onClick={onCreate}><Plus size={16}/>Create the first plan</button></div>}</section>
}

function PlanSchedule({ kind, data }: { kind: 'diet' | 'workout'; data: Record<string, unknown> }) {
  if (kind === 'diet') {
    const days = Array.isArray(data.meal_schedule) ? data.meal_schedule as DietDay[] : []
    return <div className="plan-schedule">{days.map((day, index) => <div key={index}><b>{day.day || 'Day'}</b>{day.meals.map((meal, mealIndex) => <p key={mealIndex}><strong>{meal.slot}:</strong> {meal.items || 'No meal details'}</p>)}</div>)}</div>
  }
  const days = Array.isArray(data.workout_schedule) ? data.workout_schedule as WorkoutDay[] : []
  return <div className="plan-schedule">{days.map((day, index) => <div key={index}><b>{day.day || 'Day'}{day.rest_day ? ' · Rest' : ''}</b>{day.rest_day ? <p>Rest day</p> : day.exercises.map((exercise, exerciseIndex) => <p key={exerciseIndex}><strong>{exercise.name || 'Exercise'}</strong> · {exercise.sets && `${exercise.sets} sets`} {exercise.reps && `× ${exercise.reps}`} {exercise.load && `· ${exercise.load}`} {exercise.duration && `· ${exercise.duration}`} {exercise.rest && `· Rest ${exercise.rest}`} {exercise.instructions && `· ${exercise.instructions}`}</p>)}</div>)}</div>
}

function DietScheduleEditor({ days, onChange }: { days: DietDay[]; onChange: (days: DietDay[]) => void }) {
  return <section className="schedule-editor"><div className="schedule-editor-heading"><b>Meals by day</b><button type="button" className="button-secondary" onClick={() => onChange([...days, { day: '', meals: [blankMeal()] }])}><Plus size={14}/>Add day</button></div>{days.map((day, dayIndex) => <article className="schedule-day" key={dayIndex}><div className="schedule-day-heading"><label>Day<input value={day.day} placeholder="Monday" onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, day: event.target.value } : item))}/></label><button type="button" className="button-secondary" onClick={() => onChange([...days, { ...day, day: day.day ? `${day.day} copy` : 'Copy', meals: day.meals.map(meal => ({ ...meal })) }])}>Duplicate day</button><button type="button" className="button-secondary" aria-label="Remove day" onClick={() => onChange(days.filter((_, index) => index !== dayIndex))}>Remove</button></div>{day.meals.map((meal, mealIndex) => <div className="schedule-meal" key={mealIndex}><label>Meal<select value={meal.slot} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, meals: item.meals.map((entry, index2) => index2 === mealIndex ? { ...entry, slot: event.target.value } : entry) } : item))}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label><label>Food, quantity and serving<textarea value={meal.items} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, meals: item.meals.map((entry, index2) => index2 === mealIndex ? { ...entry, items: event.target.value } : entry) } : item))}/></label><button type="button" className="button-secondary" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, meals: item.meals.filter((_, index2) => index2 !== mealIndex) } : item))}>Remove meal</button></div>)}<button type="button" className="button-secondary" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, meals: [...item.meals, blankMeal()] } : item))}><Plus size={14}/>Add meal</button></article>)}</section>
}

function WorkoutScheduleEditor({ days, onChange }: { days: WorkoutDay[]; onChange: (days: WorkoutDay[]) => void }) {
  return <section className="schedule-editor"><div className="schedule-editor-heading"><b>Workout days and exercises</b><button type="button" className="button-secondary" onClick={() => onChange([...days, { day: '', rest_day: false, exercises: [blankExercise()] }])}><Plus size={14}/>Add day</button></div>{days.map((day, dayIndex) => <article className="schedule-day" key={dayIndex}><div className="schedule-day-heading"><label>Day<input value={day.day} placeholder="Monday" onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, day: event.target.value } : item))}/></label><label className="rest-day-toggle"><input type="checkbox" checked={day.rest_day} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, rest_day: event.target.checked } : item))}/>Rest day</label><button type="button" className="button-secondary" onClick={() => onChange([...days, { ...day, day: day.day ? `${day.day} copy` : 'Copy', exercises: day.exercises.map(exercise => ({ ...exercise })) }])}>Duplicate day</button><button type="button" className="button-secondary" aria-label="Remove workout day" onClick={() => onChange(days.filter((_, index) => index !== dayIndex))}>Remove</button></div>{!day.rest_day && day.exercises.map((exercise, exerciseIndex) => <div className="schedule-exercise" key={exerciseIndex}><label>Exercise<input value={exercise.name} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, name: event.target.value } : entry) } : item))}/></label><div className="form-two"><label>Sets<input inputMode="numeric" value={exercise.sets} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, sets: event.target.value } : entry) } : item))}/></label><label>Reps<input value={exercise.reps} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, reps: event.target.value } : entry) } : item))}/></label></div><div className="form-two"><label>Weight/resistance<input value={exercise.load} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, load: event.target.value } : entry) } : item))}/></label><label>Duration/distance<input value={exercise.duration} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, duration: event.target.value } : entry) } : item))}/></label></div><label>Rest between sets<input value={exercise.rest} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, rest: event.target.value } : entry) } : item))}/></label><label>Instructions<textarea value={exercise.instructions} onChange={event => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.map((entry, index2) => index2 === exerciseIndex ? { ...entry, instructions: event.target.value } : entry) } : item))}/></label><button type="button" className="button-secondary" aria-label="Move exercise up" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: moveEntry(item.exercises, exerciseIndex, -1) } : item))}>↑</button><button type="button" className="button-secondary" aria-label="Move exercise down" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: moveEntry(item.exercises, exerciseIndex, 1) } : item))}>↓</button><button type="button" className="button-secondary" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.filter((_, index2) => index2 !== exerciseIndex) } : item))}>Remove exercise</button></div>)}{!day.rest_day && <button type="button" className="button-secondary" onClick={() => onChange(days.map((item, index) => index === dayIndex ? { ...item, exercises: [...item.exercises, blankExercise()] } : item))}><Plus size={14}/>Add exercise</button>}</article>)}</section>
}
