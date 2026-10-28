import { useEffect, type RefObject } from 'react'

/** Adds a one-time entrance only when marked content enters the viewport. */
export function useScrollMotion(rootRef: RefObject<HTMLElement | null>, contentKey: string | number | boolean) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return

    const targets = root.querySelectorAll<HTMLElement>('[data-motion-reveal]')
    if (targets.length === 0) return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('motion-entered')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -28px 0px' })

    targets.forEach(target => observer.observe(target))
    return () => observer.disconnect()
  }, [rootRef, contentKey])
}
