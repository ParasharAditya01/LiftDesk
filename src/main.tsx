import React from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import App from './App'
import './styles.css'

// /preview is a sample-data walkthrough so the product can be explored
// before Supabase credentials and real gym records are configured.
const isPreview = window.location.pathname.replace(/\/$/, '') === '/preview'
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPreview ? <App /> : <AuthGate />}
  </React.StrictMode>,
)
