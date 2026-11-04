import test from 'node:test'
import assert from 'node:assert/strict'
import { readConfig, runTenantIsolationChecks } from '../scripts/check-live-tenant-isolation.mjs'

const validEnv = {
  LIFTDESK_SUPABASE_URL: 'https://example.supabase.co/',
  LIFTDESK_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  LIFTDESK_GYM_A_ACCESS_TOKEN: 'token-a',
  LIFTDESK_GYM_A_ID: 'gym-a',
  LIFTDESK_GYM_B_ACCESS_TOKEN: 'token-b',
  LIFTDESK_GYM_B_ID: 'gym-b',
}

test('tenant test configuration requires separate gym fixtures without echoing credentials', () => {
  assert.throws(() => readConfig({}), /Missing required test settings/)
  assert.throws(() => readConfig({ ...validEnv, LIFTDESK_GYM_B_ID: 'gym-a' }), /must be different/)
  const config = readConfig(validEnv)
  assert.equal(config.url, 'https://example.supabase.co')
  assert.equal(config.tokenA, 'token-a')
})

test('tenant harness only reports fixture-backed scope outcomes and never row contents', async () => {
  const calls = []
  const fetchMock = async (url, options) => {
    calls.push({ url: String(url), token: options.headers.authorization, method: options.method })
    const foreignGymRequested = String(url).includes('eq.gym-b')
    const isGymBUser = options.headers.authorization === 'Bearer token-b'
    const hasRows = !foreignGymRequested || isGymBUser
    return new Response(null, {
      status: 200,
      headers: { 'content-range': hasRows ? '0-0/1' : '*/0' },
    })
  }

  const result = await runTenantIsolationChecks(readConfig(validEnv), fetchMock)
  assert.equal(result.length, 14)
  assert.ok(result.every(row => row.status === 'PASS'))
  assert.equal(calls.length, 42)
  assert.ok(calls.every(call => call.method === 'HEAD'))
  assert.ok(result.every(row => !('count' in row) && !('records' in row)))
})

test('tenant harness fails closed when the test identity cannot see its own fixture', async () => {
  const fetchMock = async () => new Response(null, { status: 200, headers: { 'content-range': '*/0' } })
  const result = await runTenantIsolationChecks(readConfig(validEnv), fetchMock)
  assert.ok(result.every(row => row.status === 'NEEDS_FIXTURE_OR_REVIEW'))
})

test('tenant harness does not pass if Gym A can see a Gym B fixture', async () => {
  const fetchMock = async () => new Response(null, { status: 200, headers: { 'content-range': '0-0/1' } })
  const result = await runTenantIsolationChecks(readConfig(validEnv), fetchMock)
  assert.ok(result.every(row => row.status === 'NEEDS_FIXTURE_OR_REVIEW'))
})
