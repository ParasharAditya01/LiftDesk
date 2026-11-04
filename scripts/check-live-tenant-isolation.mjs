const required = [
  'LIFTDESK_SUPABASE_URL',
  'LIFTDESK_SUPABASE_PUBLISHABLE_KEY',
  'LIFTDESK_GYM_A_ACCESS_TOKEN',
  'LIFTDESK_GYM_A_ID',
  'LIFTDESK_GYM_B_ACCESS_TOKEN',
  'LIFTDESK_GYM_B_ID',
]

export function readConfig(env = process.env) {
  const missing = required.filter(name => !env[name]?.trim())
  if (missing.length) throw new Error(`Missing required test settings: ${missing.join(', ')}`)
  if (env.LIFTDESK_GYM_A_ID === env.LIFTDESK_GYM_B_ID) throw new Error('The two test gym IDs must be different.')
  return {
    url: env.LIFTDESK_SUPABASE_URL.replace(/\/$/, ''),
    key: env.LIFTDESK_SUPABASE_PUBLISHABLE_KEY,
    gymA: env.LIFTDESK_GYM_A_ID,
    tokenA: env.LIFTDESK_GYM_A_ACCESS_TOKEN,
    gymB: env.LIFTDESK_GYM_B_ID,
    tokenB: env.LIFTDESK_GYM_B_ACCESS_TOKEN,
  }
}

async function visibleRowCount(config, table, gymId, accessToken, fetchImpl, gymColumn = 'gym_id') {
  const query = new URLSearchParams({ select: 'id', [gymColumn]: `eq.${gymId}`, limit: '1' })
  const response = await fetchImpl(`${config.url}/rest/v1/${table}?${query}`, {
    method: 'HEAD',
    headers: {
      apikey: config.key,
      authorization: `Bearer ${accessToken}`,
      prefer: 'count=exact',
      range: '0-0',
    },
  })
  if (!response.ok) throw new Error(`Query failed for ${table} (HTTP ${response.status}).`)
  const contentRange = response.headers.get('content-range') ?? ''
  const count = Number(contentRange.match(/\/(\d+)$/)?.[1])
  if (!Number.isInteger(count)) throw new Error(`Supabase did not return an exact row count for ${table}.`)
  return count
}

const checks = [
  ['gyms', 'id'],
  ['gym_memberships', 'gym_id'],
  ['members', 'gym_id'],
  ['attendance', 'gym_id'],
  ['follow_ups', 'gym_id'],
  ['gym_staff', 'gym_id'],
  ['gym_staff_attendance', 'gym_id'],
  ['gym_staff_access_events', 'gym_id'],
  ['diet_plans', 'gym_id'],
  ['workout_plans', 'gym_id'],
  ['member_progress', 'gym_id'],
  ['coaching_notes', 'gym_id'],
  ['coaching_plan_templates', 'gym_id'],
  ['coaching_plan_revisions', 'gym_id'],
]

export async function runTenantIsolationChecks(config, fetchImpl = fetch) {
  const outcomes = []
  for (const [table, gymColumn] of checks) {
    const ownRows = await visibleRowCount(config, table, config.gymA, config.tokenA, fetchImpl, gymColumn)
    const otherGymOwnRows = await visibleRowCount(config, table, config.gymB, config.tokenB, fetchImpl, gymColumn)
    const crossGymRows = await visibleRowCount(config, table, config.gymB, config.tokenA, fetchImpl, gymColumn)
    outcomes.push({ table, status: ownRows > 0 && otherGymOwnRows > 0 && crossGymRows === 0 ? 'PASS' : 'NEEDS_FIXTURE_OR_REVIEW' })
  }
  return outcomes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const config = readConfig()
    const outcomes = await runTenantIsolationChecks(config)
    for (const { table, status } of outcomes) console.log(`${status} ${table}`)
    const passed = outcomes.filter(result => result.status === 'PASS').length
    console.log(`Tenant isolation: ${passed}/${outcomes.length} tables have fixture-backed pass results.`)
    if (passed !== outcomes.length) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Tenant isolation check failed.')
    process.exitCode = 1
  }
}
