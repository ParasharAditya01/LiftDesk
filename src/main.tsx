import React, { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import LiftDeskMark from './LiftDeskMark'
import LandingPage from './LandingPage'
import './styles.css'

const AuthGate = lazy(() => import('./AuthGate'))

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .catch(error => console.warn('LiftDesk push service worker could not be registered.', error))
}

const App = lazy(() => import('./App'))

// /preview is a sample-data walkthrough so the product can be explored
// before Supabase credentials and real gym records are configured.
const isPreview = window.location.pathname.replace(/\/$/, '') === '/preview'
const pathname = window.location.pathname.replace(/\/$/, '') || '/'
const search = new URLSearchParams(window.location.search)
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const authIntentKeys = ['invite', 'staff_invite', 'code', 'error', 'error_description', 'access_token', 'refresh_token', 'type']
const hasAuthIntent = authIntentKeys.some(key => search.has(key) || hash.has(key))
  || ['signin', 'signup'].includes(search.get('mode') || '')
const isHome = pathname === '/'
const isSignIn = pathname === '/signin' || pathname === '/signup' || pathname === '/auth/callback' || (isHome && hasAuthIntent)
const isLanding = isHome && !hasAuthIntent

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'This LiftDesk page could not be found. Return to sign in or open the preview workspace.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow')
  }, [])
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><LiftDeskMark size={38} /><b>Lift<span>Desk</span></b></div><p className="auth-eyebrow">404 · PAGE NOT FOUND</p><h1>We couldn’t find that page.</h1><p className="auth-intro">The address may have changed or the page may no longer exist.</p><div className="not-found-actions"><a className="auth-submit" href="/">Go to homepage</a><a className="button-secondary" href="/signin">Sign in</a><a className="button-secondary" href="/preview">Open the preview</a></div></section></main>
}

function RoutedApp() {
  useEffect(() => {
    if (isLanding) return
    const title = isPreview ? 'Preview workspace | LiftDesk' : 'Sign in | LiftDesk'
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', isPreview
      ? 'Explore the LiftDesk gym operations interface with clearly marked sample records.'
      : 'Sign in to your LiftDesk gym workspace.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow')
  }, [])
  if (isLanding) return <LandingPage />
  if (isPreview) return <Suspense fallback={<div className="auth-screen"><p>Opening preview…</p></div>}><App /></Suspense>
  return <Suspense fallback={<div className="auth-screen"><p>Opening sign-in…</p></div>}><AuthGate /></Suspense>
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLanding || isPreview || isSignIn ? <RoutedApp /> : <NotFound />}
  </React.StrictMode>,
)
