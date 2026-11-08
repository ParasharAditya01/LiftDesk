import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LockKeyhole, MessageSquare, Pin, PinOff, RefreshCw, Send, X } from 'lucide-react'
import type { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from '@supabase/supabase-js'
import { requireSupabase } from './lib/supabase'
import { decryptChatMessage, encryptChatMessage, ensureRegisteredChatDevice, type ChatDeviceKeys, type ChatEncryptionDevice, type ChatMessageEncryptionStatus } from './lib/gymChatEncryption'

type ChatMessage = {
  id: string
  gym_id: string
  user_id: string | null
  sender_name: string
  body: string
  created_at: string
  is_pinned: boolean
  encryptionStatus: ChatMessageEncryptionStatus
}

type StoredChatMessage = Omit<ChatMessage, 'body' | 'encryptionStatus'> & { body: string }
type OwnChatDevice = { id: string; created_at: string }

type PushStatus = 'checking' | 'off' | 'on' | 'blocked' | 'unsupported' | 'not-configured'
const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim()
const messageRetentionMs = 48 * 60 * 60 * 1000

function isRetainedMessage(message: ChatMessage, now = Date.now()) {
  return message.is_pinned || now - new Date(message.created_at).getTime() < messageRetentionMs
}

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0))
}

function encodePushKey(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const unique = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => unique.set(message.id, message))
  return [...unique.values()]
    .filter(message => isRetainedMessage(message))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-100)
}

async function decryptMessageRecord(message: StoredChatMessage, device: ChatDeviceKeys): Promise<ChatMessage> {
  const decrypted = await decryptChatMessage(message.body, message.gym_id, device)
  return { ...message, ...decrypted }
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function chatErrorMessage(error: { code?: string } | null, action: 'load' | 'send' | 'pin') {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Gym chat is not enabled yet. Apply the gym chat migration in Supabase to turn it on.'
  }
  if (action === 'send' && error?.code === '42501') {
    return 'Refresh LiftDesk to send messages securely. The chat has been updated with end-to-end encryption.'
  }
  if (action === 'pin' && (error?.code === '42703' || error?.code === 'PGRST204')) {
    return 'Message pinning is not enabled yet. Apply the chat pin migration in Supabase.'
  }
  return action === 'load'
    ? 'Could not load gym chat. Check your connection and try again.'
    : action === 'pin'
      ? 'Could not update the pinned announcement. Please try again.'
      : 'Your message could not be sent. Please try again.'
}

export default function GymChat({ gymId, userId, gymName, canManagePins, onClose }: { gymId: string; userId: string; gymName: string; canManagePins: boolean; onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pushStatus, setPushStatus] = useState<PushStatus>(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
    if (!vapidPublicKey) return 'not-configured'
    if (window.Notification.permission === 'denied') return 'blocked'
    return 'checking'
  })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushNotice, setPushNotice] = useState('')
  const [pinningMessageIds, setPinningMessageIds] = useState<Set<string>>(() => new Set())
  const [pinError, setPinError] = useState('')
  const [deviceKeys, setDeviceKeys] = useState<ChatDeviceKeys | null>(null)
  const [ownDevices, setOwnDevices] = useState<OwnChatDevice[]>([])
  const [deviceNotice, setDeviceNotice] = useState('')
  const [revokingDeviceId, setRevokingDeviceId] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setDeviceKeys(null)
    setLoading(true)
    setError('')
    void (async () => {
      const keys = await ensureRegisteredChatDevice(gymId, userId)
      if (!active) return
      setDeviceKeys(keys)
      const { data: ownedDevices } = await requireSupabase().from('gym_chat_devices')
        .select('id, created_at')
        .eq('gym_id', gymId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (active) setOwnDevices((ownedDevices ?? []) as OwnChatDevice[])
    })().catch(error => {
      console.error('Gym chat encryption setup failed:', error)
      if (active) {
        setError('Encrypted chat could not be set up on this device. Refresh the page or use a supported browser.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [gymId, userId])

  useEffect(() => {
    if (pushStatus !== 'checking') return
    let active = true
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!active) return
      if (!subscription) { setPushStatus('off'); return }
      const { data, error: lookupError } = await requireSupabase()
        .from('gym_chat_push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .eq('gym_id', gymId)
        .maybeSingle()
      if (!active) return
      if (lookupError) {
        setPushNotice('Could not check this device’s notification setting.')
        setPushStatus('off')
      } else setPushStatus(data ? 'on' : 'off')
    })().catch(() => {
      if (active) {
        setPushNotice('Could not check this device’s notification setting.')
        setPushStatus('off')
      }
    })
    return () => { active = false }
  }, [pushStatus, gymId, userId])

  useEffect(() => {
    if (!deviceKeys) return
    let active = true
    const client = requireSupabase()
    const loadMessages = async () => {
      const cutoff = new Date(Date.now() - messageRetentionMs).toISOString()
      const fields = 'id, gym_id, user_id, sender_name, body, created_at, is_pinned'
      const [recentResult, pinnedResult] = await Promise.all([
        client.from('gym_chat_messages')
          .select(fields)
          .eq('gym_id', gymId)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(100),
        client.from('gym_chat_messages')
          .select(fields)
          .eq('gym_id', gymId)
          .eq('is_pinned', true)
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      const loadError = recentResult.error ?? pinnedResult.error
      if (!active) return
      if (loadError) {
        setError(chatErrorMessage(loadError, 'load'))
      } else {
        setError('')
        const loaded = [
          ...((recentResult.data ?? []) as ChatMessage[]),
          ...((pinnedResult.data ?? []) as ChatMessage[]),
        ]
        const decrypted = await Promise.all(loaded.map(message => decryptMessageRecord(message as StoredChatMessage, deviceKeys)))
        if (active) setMessages(current => mergeMessages(current, decrypted))
      }
      setLoading(false)
    }

    void loadMessages()
    const channel = client.channel(`gym-chat-${gymId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'gym_chat_messages', filter: `gym_id=eq.${gymId}`,
      }, (payload: RealtimePostgresInsertPayload<ChatMessage>) => {
        void decryptMessageRecord(payload.new as StoredChatMessage, deviceKeys).then(message => {
          if (active) setMessages(current => mergeMessages(current, [message]))
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'gym_chat_messages', filter: `gym_id=eq.${gymId}`,
      }, (payload: RealtimePostgresUpdatePayload<ChatMessage>) => {
        void decryptMessageRecord(payload.new as StoredChatMessage, deviceKeys).then(message => {
          if (active) setMessages(current => mergeMessages(current, [message]))
        })
      })
      .subscribe(status => {
        if (!active) return
        setConnected(status === 'SUBSCRIBED')
        setConnectionError(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Gym chat realtime subscription failed:', status)
        }
        // Fetch after joining too, so a message sent during initial loading is not missed.
        if (status === 'SUBSCRIBED') void loadMessages()
      })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [deviceKeys, gymId, refreshKey])

  useEffect(() => {
    const nextExpiry = messages.reduce<number | null>((earliest, message) => {
      if (message.is_pinned) return earliest
      const expiresAt = new Date(message.created_at).getTime() + messageRetentionMs
      return earliest === null || expiresAt < earliest ? expiresAt : earliest
    }, null)
    if (nextExpiry === null) return
    const timer = window.setTimeout(() => {
      setMessages(current => current.filter(message => isRetainedMessage(message)))
    }, Math.max(0, nextExpiry - Date.now()))
    return () => window.clearTimeout(timer)
  }, [messages])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'end' })
  }, [messages.length])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending || !deviceKeys) return
    setSending(true)
    setError('')
    try {
      const client = requireSupabase()
      const { data: devices, error: devicesError } = await client.from('gym_chat_devices')
        .select('id, public_key')
        .eq('gym_id', gymId)
      if (devicesError || !devices) {
        setError('Could not prepare secure delivery for this message. Please try again.')
        return
      }
      if (!(devices as ChatEncryptionDevice[]).some(device => device.id === deviceKeys.id)) {
        throw new Error('This device is not registered for gym chat encryption yet. Refresh the page and try again.')
      }
      const encryptedBody = await encryptChatMessage(body, gymId, devices as ChatEncryptionDevice[])
      const { data, error: sendError } = await client.from('gym_chat_messages')
        .insert({ gym_id: gymId, user_id: userId, body: encryptedBody })
        .select('id, gym_id, user_id, sender_name, body, created_at, is_pinned')
        .single()
      if (sendError || !data) {
        setError(chatErrorMessage(sendError, 'send'))
      } else {
        const message = await decryptMessageRecord(data as StoredChatMessage, deviceKeys)
        setMessages(current => mergeMessages(current, [message]))
        setDraft('')
        void client.functions.invoke('send-gym-chat-push', { body: { messageId: data.id } })
          .then(({ error: pushError }) => {
            if (pushError) console.warn('Gym chat push could not be requested. The message was still sent.')
          })
      }
    } catch (sendFailure) {
      console.error('Encrypted gym chat message could not be sent:', sendFailure)
      const safeEncryptionErrors = [
        'No active gym chat devices are registered yet. Refresh chat and try again.',
        'This gym has too many registered chat devices for one encrypted message. Ask LiftDesk support for help.',
        'This device is not registered for gym chat encryption yet. Refresh the page and try again.',
      ]
      setError(sendFailure instanceof Error && safeEncryptionErrors.includes(sendFailure.message)
        ? sendFailure.message
        : 'Could not securely encrypt this message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function toggleMessagePin(message: ChatMessage) {
    if (!canManagePins || pinningMessageIds.has(message.id)) return
    setPinningMessageIds(current => new Set(current).add(message.id))
    setPinError('')
    const { data, error: updateError } = await requireSupabase()
      .from('gym_chat_messages')
      .update({ is_pinned: !message.is_pinned })
      .eq('id', message.id)
      .eq('gym_id', gymId)
      .select('id, gym_id, user_id, sender_name, body, created_at, is_pinned')
      .single()
    if (updateError || !data) setPinError(chatErrorMessage(updateError, 'pin'))
    else if (deviceKeys) {
      const decrypted = await decryptMessageRecord(data as StoredChatMessage, deviceKeys)
      setMessages(current => mergeMessages(current, [decrypted]))
    }
    setPinningMessageIds(current => {
      const next = new Set(current)
      next.delete(message.id)
      return next
    })
  }

  async function revokeChatDevice(deviceId: string) {
    if (!deviceKeys || deviceId === deviceKeys.id || revokingDeviceId) return
    if (!window.confirm('Revoke this device from future gym chat messages? Messages it already received cannot be recalled.')) return
    setRevokingDeviceId(deviceId)
    setDeviceNotice('')
    const { error: revokeError } = await requireSupabase().from('gym_chat_devices')
      .delete()
      .eq('id', deviceId)
      .eq('gym_id', gymId)
      .eq('user_id', userId)
    if (revokeError) setDeviceNotice('Could not revoke this device. Please try again.')
    else {
      setOwnDevices(current => current.filter(device => device.id !== deviceId))
      setDeviceNotice('Device revoked. It will not be included in future encrypted messages.')
    }
    setRevokingDeviceId('')
  }

  async function togglePushNotifications() {
    if (pushBusy) return
    setPushBusy(true)
    setPushNotice('')
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const subscription = await registration.pushManager.getSubscription()
      if (pushStatus === 'on') {
        if (subscription) {
          const { error: removeError } = await requireSupabase()
            .from('gym_chat_push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)
          await subscription.unsubscribe()
          if (removeError) setPushNotice('Notifications are off on this device. The server will clear the old endpoint on its next delivery attempt.')
          else setPushNotice('Chat notifications are off on this device.')
        }
        setPushStatus('off')
        return
      }

      if (!vapidPublicKey) { setPushStatus('not-configured'); return }
      const permission = window.Notification.permission === 'granted'
        ? 'granted'
        : await window.Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus(permission === 'denied' ? 'blocked' : 'off')
        setPushNotice(permission === 'denied' ? 'Allow notifications for LiftDesk in your browser settings, then try again.' : 'Notification permission was not granted.')
        return
      }

      const activeSubscription = subscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(vapidPublicKey) as BufferSource,
      })
      const p256dh = activeSubscription.getKey('p256dh')
      const auth = activeSubscription.getKey('auth')
      if (!p256dh || !auth) throw new Error('The browser returned an incomplete push subscription.')

      const { error: saveError } = await requireSupabase()
        .from('gym_chat_push_subscriptions')
        .upsert({
          gym_id: gymId,
          user_id: userId,
          endpoint: activeSubscription.endpoint,
          p256dh: encodePushKey(p256dh),
          auth: encodePushKey(auth),
        }, { onConflict: 'endpoint' })
      if (saveError) {
        await activeSubscription.unsubscribe()
        throw saveError
      }
      setPushStatus('on')
      setPushNotice('This device is set to receive gym chat notifications.')
    } catch {
      setPushNotice('Could not enable notifications. Check your browser permission and try again.')
      setPushStatus(window.Notification.permission === 'denied' ? 'blocked' : 'off')
    } finally {
      setPushBusy(false)
    }
  }

  const pushDescription: Record<PushStatus, string> = {
    checking: 'Checking this device…',
    off: 'Off on this device.',
    on: 'This device can receive chat alerts.',
    blocked: 'Blocked by your browser. Allow notifications in site settings.',
    unsupported: 'Web push is not supported by this browser.',
    'not-configured': 'Push setup is not complete for this site yet.',
  }
  const pinnedMessages = messages.filter(message => message.is_pinned)

  return <section className="gym-chat surface" aria-label={`Chat for ${gymName}`}>
    <header className="gym-chat-header">
      <span className="gym-chat-mark" aria-hidden="true"><MessageSquare size={18}/></span>
      <div><h2>Gym chat</h2><p>Owners and Admins at {gymName} can read and send messages.</p></div>
      <span className={'gym-chat-connection ' + (connected ? 'is-connected' : '')} role="status">{connected ? 'Live' : connectionError ? 'Offline' : 'Connecting'}</span>
      {onClose && <button type="button" className="gym-chat-close" aria-label="Close gym chat" onClick={onClose}><X size={17}/></button>}
    </header>

    <div className="gym-chat-notification-control">
      <div><b>Chat notifications</b><span>{pushDescription[pushStatus]}</span></div>
      {(pushStatus === 'off' || pushStatus === 'on') && <button type="button" disabled={pushBusy} onClick={() => void togglePushNotifications()}>{pushBusy ? 'Saving…' : pushStatus === 'on' ? 'Turn off' : 'Enable'}</button>}
    </div>
    {pushNotice && <p className="gym-chat-push-notice" role="status">{pushNotice}</p>}
    {deviceKeys && <p className="gym-chat-encryption-note"><LockKeyhole size={13}/> New messages are end-to-end encrypted. This device can read messages sent after it was registered. Older messages are marked if they predate encryption.</p>}
    {deviceKeys && <details className="gym-chat-devices">
      <summary>Your encrypted devices ({ownDevices.length})</summary>
      <ul>{ownDevices.map(device => <li key={device.id}>
        <span><b>{device.id === deviceKeys.id ? 'This device' : `Device · ${device.id.slice(-6)}`}</b><small>Added {new Date(device.created_at).toLocaleDateString('en-IN')}</small></span>
        {device.id !== deviceKeys.id && <button type="button" disabled={!!revokingDeviceId} onClick={() => void revokeChatDevice(device.id)}>{revokingDeviceId === device.id ? 'Revoking…' : 'Revoke'}</button>}
      </li>)}</ul>
      <p>Revoking prevents future messages from being encrypted for that device. It cannot erase messages the device already received. These keys are stored in this browser; clearing browser data can make older encrypted messages unreadable here.</p>
      {deviceNotice && <p role="status">{deviceNotice}</p>}
    </details>}
    {pinnedMessages.length > 0 && <aside className="gym-chat-pinned" aria-label="Pinned announcements">
      <div className="gym-chat-pinned-heading"><Pin size={14}/><b>Pinned announcements</b><span>{pinnedMessages.length}</span></div>
      <ul>{[...pinnedMessages].reverse().map(message => <li key={message.id}>
        <span>{message.sender_name}</span>
        {message.encryptionStatus !== 'encrypted' && <small>{message.encryptionStatus === 'legacy' ? 'Older message, not end-to-end encrypted' : 'Not available on this device'}</small>}
        <p>{message.body}</p>
      </li>)}</ul>
    </aside>}

    {connectionError && <div className="gym-chat-reconnect"><span>Live updates are unavailable. Messages can still be sent.</span><button type="button" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={14}/> Reconnect</button></div>}
    {error && <p className="gym-chat-error" role="alert">{error}</p>}
    {pinError && <p className="gym-chat-error" role="alert">{pinError}</p>}

    <div className="gym-chat-messages" aria-label="Gym chat messages" aria-live="polite" aria-relevant="additions text">
      {loading ? <div className="gym-chat-empty" role="status">Loading messages…</div> : messages.length === 0 ? <div className="gym-chat-empty"><MessageSquare size={20}/><b>Start the conversation</b><span>Send a message to Owners and Admins at {gymName}.</span></div> : messages.map(message => {
        const ownMessage = message.user_id === userId
        return <article key={message.id} className={'gym-chat-message ' + (ownMessage ? 'is-own-message' : '')}>
          {!ownMessage && <b className="gym-chat-sender">{message.sender_name}</b>}
          {message.is_pinned && <span className="gym-chat-message-pin"><Pin size={11}/> Pinned announcement</span>}
          {message.encryptionStatus !== 'encrypted' && <span className="gym-chat-encryption-status">{message.encryptionStatus === 'legacy' ? 'Older message · not encrypted' : 'Not available on this device'}</span>}
          <p>{message.body}</p>
          <div className="gym-chat-message-footer">
            <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
            {canManagePins && <button
              type="button"
              className="gym-chat-pin-button"
              disabled={pinningMessageIds.has(message.id)}
              aria-label={message.is_pinned ? `Unpin announcement from ${message.sender_name}` : `Pin announcement from ${message.sender_name}`}
              aria-pressed={message.is_pinned}
              title={message.is_pinned ? 'Unpin announcement' : 'Pin announcement'}
              onClick={() => void toggleMessagePin(message)}
            >{message.is_pinned ? <PinOff size={14}/> : <Pin size={14}/>}<span className="sr-only">{message.is_pinned ? 'Unpin' : 'Pin'}</span></button>}
          </div>
        </article>
      })}
      <div ref={endRef}/>
    </div>

    <form className="gym-chat-composer" onSubmit={sendMessage}>
      <label className="sr-only" htmlFor="gym-chat-message">Message for everyone in {gymName}</label>
      <textarea id="gym-chat-message" value={draft} maxLength={2000} rows={2} disabled={!deviceKeys} placeholder={deviceKeys ? 'Write an encrypted message…' : 'Setting up encrypted chat…'} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
      }}/>
      <div className="gym-chat-composer-actions"><span>{draft.length}/2000 · Enter to send</span><button type="submit" className="button-primary" disabled={!deviceKeys || !draft.trim() || sending} aria-label="Send message">{sending ? 'Sending…' : <><Send size={15}/> Send</>}</button></div>
    </form>
  </section>
}
