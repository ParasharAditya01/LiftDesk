import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquare, RefreshCw, Send, X } from 'lucide-react'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { requireSupabase } from './lib/supabase'

type ChatMessage = {
  id: string
  gym_id: string
  user_id: string | null
  sender_name: string
  body: string
  created_at: string
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const unique = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => unique.set(message.id, message))
  return [...unique.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-100)
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function chatErrorMessage(error: { code?: string } | null, action: 'load' | 'send') {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Gym chat is not enabled yet. Apply the gym chat migration in Supabase to turn it on.'
  }
  return action === 'load'
    ? 'Could not load gym chat. Check your connection and try again.'
    : 'Your message could not be sent. Please try again.'
}

export default function GymChat({ gymId, userId, gymName, onClose }: { gymId: string; userId: string; gymName: string; onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const client = requireSupabase()
    const loadMessages = async () => {
      const { data, error: loadError } = await client.from('gym_chat_messages')
        .select('id, gym_id, user_id, sender_name, body, created_at')
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (loadError) {
        setError(chatErrorMessage(loadError, 'load'))
      } else {
        setError('')
        setMessages(current => mergeMessages(current, ((data ?? []) as ChatMessage[]).reverse()))
      }
      setLoading(false)
    }

    void loadMessages()
    const channel = client.channel(`gym-chat-${gymId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'gym_chat_messages', filter: `gym_id=eq.${gymId}`,
      }, (payload: RealtimePostgresInsertPayload<ChatMessage>) => {
        if (active) setMessages(current => mergeMessages(current, [payload.new as ChatMessage]))
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
  }, [gymId, refreshKey])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'end' })
  }, [messages.length])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    const { data, error: sendError } = await requireSupabase().from('gym_chat_messages')
      .insert({ gym_id: gymId, user_id: userId, body })
      .select('id, gym_id, user_id, sender_name, body, created_at')
      .single()
    if (sendError || !data) {
      setError(chatErrorMessage(sendError, 'send'))
    } else {
      setMessages(current => mergeMessages(current, [data as ChatMessage]))
      setDraft('')
    }
    setSending(false)
  }

  return <section className="gym-chat surface" aria-label={`Chat for ${gymName}`}>
    <header className="gym-chat-header">
      <span className="gym-chat-mark" aria-hidden="true"><MessageSquare size={18}/></span>
      <div><h2>Gym chat</h2><p>Everyone in {gymName} can read and send messages.</p></div>
      <span className={'gym-chat-connection ' + (connected ? 'is-connected' : '')} role="status">{connected ? 'Live' : connectionError ? 'Offline' : 'Connecting'}</span>
      {onClose && <button type="button" className="gym-chat-close" aria-label="Close gym chat" onClick={onClose}><X size={17}/></button>}
    </header>

    {connectionError && <div className="gym-chat-reconnect"><span>Live updates are unavailable. Messages can still be sent.</span><button type="button" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={14}/> Reconnect</button></div>}
    {error && <p className="gym-chat-error" role="alert">{error}</p>}

    <div className="gym-chat-messages" aria-label="Gym chat messages" aria-live="polite" aria-relevant="additions text">
      {loading ? <div className="gym-chat-empty" role="status">Loading messages…</div> : messages.length === 0 ? <div className="gym-chat-empty"><MessageSquare size={20}/><b>Start the conversation</b><span>Send a message to everyone at {gymName}.</span></div> : messages.map(message => {
        const ownMessage = message.user_id === userId
        return <article key={message.id} className={'gym-chat-message ' + (ownMessage ? 'is-own-message' : '')}>
          {!ownMessage && <b className="gym-chat-sender">{message.sender_name}</b>}
          <p>{message.body}</p>
          <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
        </article>
      })}
      <div ref={endRef}/>
    </div>

    <form className="gym-chat-composer" onSubmit={sendMessage}>
      <label className="sr-only" htmlFor="gym-chat-message">Message for everyone in {gymName}</label>
      <textarea id="gym-chat-message" value={draft} maxLength={2000} rows={2} placeholder="Write a message…" onChange={event => setDraft(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
      }}/>
      <div className="gym-chat-composer-actions"><span>{draft.length}/2000 · Enter to send</span><button type="submit" className="button-primary" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? 'Sending…' : <><Send size={15}/> Send</>}</button></div>
    </form>
  </section>
}
