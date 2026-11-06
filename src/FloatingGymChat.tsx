import { useEffect, useRef, useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import GymChat from './GymChat'

type Props = { gymId: string; userId: string; gymName: string }

export default function FloatingGymChat({ gymId, userId, gymName }: Props) {
  const [open, setOpen] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      requestAnimationFrame(() => launcherRef.current?.focus())
    }
    document.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(() => document.getElementById('gym-chat-message')?.focus())
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return <>
    {open && <div id="gym-chat-floating-panel" className="gym-chat-floating-panel" role="dialog" aria-label={`Gym chat for ${gymName}`}>
      <GymChat gymId={gymId} userId={userId} gymName={gymName} onClose={() => {
        setOpen(false)
        requestAnimationFrame(() => launcherRef.current?.focus())
      }}/>
    </div>}
    <button
      ref={launcherRef}
      type="button"
      className="gym-chat-floating-launcher"
      aria-controls={open ? 'gym-chat-floating-panel' : undefined}
      aria-expanded={open}
      aria-label={open ? 'Close gym chat' : 'Open gym chat'}
      onClick={() => setOpen(value => !value)}
    >
      {open ? <X size={19}/> : <MessageSquare size={19}/>}
      <span>{open ? 'Close chat' : 'Chat'}</span>
    </button>
  </>
}
