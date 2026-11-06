# LiftDesk web push notifications

LiftDesk can send an operating-system notification for a new gym chat message to each participant who opted in on that browser. The sender is excluded. The notification preview contains no message text; clicking it opens LiftDesk and the chat window. Browser permission is requested only after the user presses **Enable**.

Push delivery needs a one-time Supabase migration, an Edge Function deployment, VAPID keys, and a Cloudflare Pages build variable. The app keeps chat working if push is unavailable.

## 1. Generate VAPID keys

Run this on a trusted computer. Keep the private key out of source control and do not paste it into chat:

```sh
npx --yes web-push@3.6.7 generate-vapid-keys --json
```

The command prints a public and a private key. Use the same pair in the next two sections. If you ever rotate the pair, browsers must subscribe again with the new public key.

## 2. Apply the database migration

Apply `supabase/migrations/20261107000000_gym_chat_push_notifications.sql` to the GymPulse Supabase project. It adds a private subscription table with user and active-gym RLS policies, plus an idempotency timestamp on chat messages. It does not alter existing subscriptions or messages.

## 3. Set Supabase Edge Function secrets

In Supabase Dashboard, open **Edge Functions → Secrets** and add:

| Name | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | The generated public key |
| `VAPID_PRIVATE_KEY` | The generated private key |
| `VAPID_SUBJECT` | A valid `mailto:` contact URI, such as `mailto:you@example.com` |

The private key belongs only in Supabase's server-side secrets. Never put it in a `VITE_` variable or commit it.

Deploy `supabase/functions/send-gym-chat-push/index.ts` as the `send-gym-chat-push` Edge Function. It accepts signed-in user JWTs, verifies the caller owns a newly created gym chat message, and uses the server-side admin client only to dispatch to that message's gym subscriptions. It excludes the sender and removes expired endpoints returned as 404/410 by a push service.

## 4. Set the Cloudflare Pages public key

In Cloudflare Dashboard, open the `liftdesk` Pages project and add the build-time environment variable:

```text
VITE_WEB_PUSH_PUBLIC_KEY=<the same generated public key>
```

Rebuild the Pages site after saving it. This key is public and is needed by browsers to create subscriptions. The matching private key stays in Supabase.

## 5. Opt in and verify

1. Open the deployed site in a browser that supports Web Push over HTTPS.
2. Sign in to a gym account and open the floating **Chat** window.
3. Click **Enable** in **Chat notifications** and allow notifications in the browser prompt.
4. Repeat on a second browser/device signed in as a different participant in the same gym.
5. Send a chat message from the first account. The second device should show a generic LiftDesk notification; clicking it should open the app with the chat window open.
6. Select **Turn off** to remove that browser's subscription. Sign-out also removes the current browser's subscription where it can reach Supabase.

The Push API needs an active service worker and user permission. iPhone/iPad users may need to add LiftDesk to the Home Screen before enabling notifications, depending on iOS and browser support. Push services can accept a message without guaranteeing the device displays it; this is best-effort delivery.

## Security and privacy

- The app never asks permission on page load.
- Subscription endpoints and encryption keys are readable only by their authenticated owner through RLS; sending uses a server-side Supabase client.
- Notifications do not include chat text, sender names, membership information, or other private records.
- The Edge Function only sends for a recent message belonging to the authenticated caller and atomically claims each message to prevent repeated dispatch.
- Browser notification permission is device/browser-specific. Each participant must opt in on each device.

## Manual setup still required

The repository does not contain VAPID private keys. Apply the migration, set the two public/private VAPID locations, deploy the Edge Function, and rebuild Cloudflare Pages before end-to-end push delivery can work. Applying the migration or deploying Supabase/Cloudflare production services is not performed by this code change.
