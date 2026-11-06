import { withSupabase } from 'npm:@supabase/server@1.9.1'
import webpush from 'npm:web-push@3.6.7'

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true
  try {
    return /^(?:[a-z0-9-]+\.)?liftdesk\.pages\.dev$/i.test(new URL(origin).hostname)
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? 'https://liftdesk.pages.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

const respond = (body: Record<string, unknown>, status: number) => Response.json(body, { status })

const authenticatedHandler = withSupabase({ auth: 'user' }, async (request, context) => {
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  // @supabase/server normalizes the authenticated user's subject to `id`.
  // The raw JWT uses `sub`, but that field is not present on userClaims.
  const userId = context.userClaims?.id
  if (!userId) return respond({ error: 'Sign in to send notifications.' }, 401)

  let messageId: unknown
  try {
    ({ messageId } = await request.json())
  } catch {
    return respond({ error: 'Invalid notification request.' }, 400)
  }
  if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return respond({ error: 'Invalid notification request.' }, 400)
  }

  // The request may only notify for this caller's newly-created message.
  const recentSince = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  const { data: message, error: messageError } = await context.supabase
    .from('gym_chat_messages')
    .select('id, gym_id, user_id')
    .eq('id', messageId)
    .eq('user_id', userId)
    .gte('created_at', recentSince)
    .maybeSingle()
  if (messageError) {
    console.error('Could not authorize gym chat push request:', messageError.code)
    return respond({ error: 'Could not prepare chat notifications.' }, 500)
  }
  if (!message) return respond({ error: 'Message not found.' }, 404)

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Gym chat push is missing VAPID secrets.')
    return respond({ error: 'Push notifications are not configured.' }, 503)
  }

  const subscriptions: PushSubscriptionRow[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error: subscriptionsError } = await context.supabaseAdmin
      .from('gym_chat_push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('gym_id', message.gym_id)
      .neq('user_id', userId)
      .order('id')
      .range(offset, offset + 499)
    if (subscriptionsError) {
      console.error('Could not load gym chat push subscriptions:', subscriptionsError.code)
      return respond({ error: 'Could not prepare chat notifications.' }, 500)
    }
    subscriptions.push(...(data as PushSubscriptionRow[] ?? []))
    if (!data || data.length < 500) break
  }

  // Load the recipient set before claiming the message so a transient database
  // read failure does not permanently suppress a later delivery attempt.
  // Atomically claim before sending so concurrent retries cannot spam recipients.
  const { data: claimed, error: claimError } = await context.supabaseAdmin
    .from('gym_chat_messages')
    .update({ push_dispatched_at: new Date().toISOString() })
    .eq('id', message.id)
    .is('push_dispatched_at', null)
    .select('id')
    .maybeSingle()
  if (claimError) {
    console.error('Could not claim gym chat push request:', claimError.code)
    return respond({ error: 'Could not prepare chat notifications.' }, 500)
  }
  if (!claimed) return respond({ ok: true, alreadyProcessed: true, accepted: 0 }, 200)
  if (!subscriptions.length) return respond({ ok: true, accepted: 0 }, 200)

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const payload = JSON.stringify({
    title: 'New gym chat message',
    body: 'Open LiftDesk to read the latest message.',
    url: '/?open_chat=1',
    tag: `gym-chat-${message.id}`,
  })
  let accepted = 0
  for (let offset = 0; offset < subscriptions.length; offset += 40) {
    const batch = subscriptions.slice(offset, offset + 40)
    await Promise.all(batch.map(async subscription => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 3600 })
        accepted += 1
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : 0
        if (statusCode === 404 || statusCode === 410) {
          const { error: removeError } = await context.supabaseAdmin
            .from('gym_chat_push_subscriptions')
            .delete()
            .eq('id', subscription.id)
          if (removeError) console.error('Could not remove expired push subscription:', removeError.code)
        } else {
          console.error('Gym chat push provider rejected a notification:', statusCode || 'network error')
        }
      }
    }))
  }

  // "accepted" means the push service accepted the request, not that a device displayed it.
  return respond({ ok: true, attempted: subscriptions.length, accepted }, 200)
})

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) return respond({ error: 'Origin not allowed.' }, 403)
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') return new Response('ok', { headers })

  const response = await authenticatedHandler(request)
  const responseHeaders = new Headers(response.headers)
  Object.entries(headers).forEach(([key, value]) => responseHeaders.set(key, value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders })
})
