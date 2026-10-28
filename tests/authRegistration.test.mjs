import test from 'node:test'
import assert from 'node:assert/strict'
import { authRedirectUrl, classifySignupResult, createRequestLock, requestOwnerSignup, requestSignupConfirmation } from '../src/lib/authRegistration.ts'
import { authErrorCode, userFacingError } from '../src/lib/userFacingError.ts'

test('rate-limit errors are actionable and retain only the provider code for diagnosis', () => {
  const error = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }
  assert.equal(authErrorCode(error), 'over_email_send_rate_limit')
  assert.match(userFacingError(error, 'fallback'), /temporarily limited/)
  assert.match(userFacingError(error, 'fallback'), /repeated requests will not bypass/)
  assert.doesNotMatch(userFacingError(error, 'fallback'), /email rate limit exceeded/i)
})

test('email recipient and SMTP configuration errors give distinct next steps', () => {
  assert.match(userFacingError({ code: 'email_address_not_authorized' }, ''), /configure email delivery in Supabase/)
  assert.match(userFacingError({ code: 'email_address_invalid' }, ''), /valid/)
  assert.match(userFacingError({ code: 'unexpected_failure', message: 'Error sending confirmation email' }, ''), /SMTP settings/)
})

test('confirmation redirect follows the current app origin in production and development', () => {
  assert.equal(authRedirectUrl('https://liftdesk.pages.dev'), 'https://liftdesk.pages.dev/')
  assert.equal(authRedirectUrl('http://localhost:5173'), 'http://localhost:5173/')
})

test('signup request forwards owner metadata and an environment-specific confirmation redirect', async () => {
  let received
  const fakeAuth = { signUp: async input => { received = input; return { data: { user: {}, session: null }, error: null } } }
  await requestOwnerSignup(fakeAuth, { email: 'owner@example.com', password: 'example-password', ownerName: 'Gym Owner', origin: 'https://liftdesk.pages.dev' })
  assert.equal(received.email, 'owner@example.com')
  assert.equal(received.options.emailRedirectTo, 'https://liftdesk.pages.dev/')
  assert.equal(received.options.data.full_name, 'Gym Owner')
})

test('signup provider failure is returned to the caller with its code instead of a false success result', async () => {
  const rateError = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }
  const fakeAuth = { signUp: async () => ({ data: { user: null, session: null }, error: rateError }) }
  const result = await requestOwnerSignup(fakeAuth, { email: 'owner@example.com', password: 'example-password', ownerName: 'Gym Owner', origin: 'https://liftdesk.pages.dev' })
  assert.equal(result.error, rateError)
  assert.equal(authErrorCode(result.error), 'over_email_send_rate_limit')
})

test('signup responses distinguish confirmation pending, existing-account response, session, and incomplete result', () => {
  assert.equal(classifySignupResult({ identities: [{ id: '1' }] }, null).kind, 'confirmation-pending')
  assert.equal(classifySignupResult({ identities: [] }, null).kind, 'existing-account')
  const session = { access_token: 'test-only' }
  assert.deepEqual(classifySignupResult({}, session), { kind: 'signed-in', session })
  assert.equal(classifySignupResult(null, null).kind, 'incomplete')
})

test('resend calls the signup confirmation endpoint with the current origin', async () => {
  let received
  const fakeAuth = { resend: async input => { received = input; return { error: null } } }
  await requestSignupConfirmation(fakeAuth, { email: 'owner@example.com', origin: 'http://localhost:5173' })
  assert.equal(received.type, 'signup')
  assert.equal(received.email, 'owner@example.com')
  assert.equal(received.options.emailRedirectTo, 'http://localhost:5173/')
})

test('resend provider errors remain failures for the UI to report', async () => {
  const providerError = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }
  const fakeAuth = { resend: async () => ({ error: providerError }) }
  const result = await requestSignupConfirmation(fakeAuth, { email: 'owner@example.com', origin: 'https://liftdesk.pages.dev' })
  assert.equal(result.error, providerError)
})

test('the request lock suppresses concurrent duplicate submissions and can be reused afterward', () => {
  const lock = createRequestLock()
  assert.equal(lock.tryAcquire(), true)
  assert.equal(lock.tryAcquire(), false)
  lock.release()
  assert.equal(lock.tryAcquire(), true)
})
