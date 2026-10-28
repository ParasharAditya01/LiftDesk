import React, { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import LiftDeskMark from './LiftDeskMark'
import './styles.css'

const App = lazy(() => import('./App'))

// /preview is a sample-data walkthrough so the product can be explored
// before Supabase credentials and real gym records are configured.
const isPreview = window.location.pathname.replace(/\/$/, '') === '/preview'
const isHome = window.location.pathname === '/' || window.location.pathname === ''

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found | LiftDesk'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'This LiftDesk page could not be found. Return to sign in or open the preview workspace.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow')
  }, [])
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><LiftDeskMark size={38} /><b>Lift<span>Desk</span></b></div><p className="auth-eyebrow">404 · PAGE NOT FOUND</p><h1>We couldn’t find that page.</h1><p className="auth-intro">The address may have changed or the page may no longer exist.</p><div className="not-found-actions"><a className="auth-submit" href="/">Go to sign in</a><a className="button-secondary" href="/preview">Open the preview</a></div></section></main>
}

function RoutedApp() {
  useEffect(() => {
    const title = isPreview ? 'Preview workspace | LiftDesk' : 'Sign in | LiftDesk'
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', isPreview
      ? 'Explore the LiftDesk gym operations interface with clearly marked sample records.'
      : 'Sign in to LiftDesk to manage your gym workspace, members, attendance and follow-ups.')
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow')
  }, [])
  return isPreview ? <Suspense fallback={<div className="auth-screen"><p>Opening preview…</p></div>}><App /></Suspense> : <AuthGate />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPreview ? <RoutedApp /> : isHome ? <RoutedApp /> : <NotFound />}
  </React.StrictMode>,
)
