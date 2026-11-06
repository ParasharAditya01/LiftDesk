import { requireSupabase } from './supabase'

/** Remove this browser's push endpoint before signing out, so another account
 * on the same device cannot keep receiving this user's gym notifications. */
export async function disableCurrentPushNotifications() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    const { error } = await requireSupabase()
      .from('gym_chat_push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
    if (error) console.warn('The browser push subscription could not be removed from the gym settings.')
  } catch {
    // Keep sign-out usable when offline; unsubscribe locally so this browser
    // stops receiving pushes. Stale endpoints are pruned after provider 404/410.
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      await subscription?.unsubscribe()
    } catch { /* best-effort cleanup */ }
  }
}

export async function signOutWithPushCleanup() {
  await disableCurrentPushNotifications()
  return requireSupabase().auth.signOut()
}
