import React from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import App from './App'
import MemberCheckIn from './MemberCheckIn'
import './styles.css'

// /preview is a sample-data walkthrough so the product can be explored
// before Supabase credentials and real gym records are configured.
const isPreview = window.location.pathname.replace(/\/$/, '') === '/preview'
const checkInGymId = new URLSearchParams(window.location.search).get('checkin')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {checkInGymId ? <MemberCheckIn gymId={checkInGymId} /> : isPreview ? <App /> : <AuthGate />}
  </React.StrictMode>,
)
