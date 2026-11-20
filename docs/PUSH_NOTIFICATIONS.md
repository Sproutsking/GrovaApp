# Push Notifications

## Configuration

The browser receives only the Firebase web configuration and the public VAPID key from the authenticated `get-push-config` Edge Function. These values must identify the same Firebase project as `FIREBASE_PROJECT_ID`:

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MESSAGING_VAPID_KEY`

Keep `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` exclusively in Supabase Edge Function secrets. Never add service-account credentials to frontend build variables or return them from an Edge Function.

## Rollout

Apply `135_fix_push_registration.sql` before deploying the client that registers FCM tokens. Then deploy `get-push-config` and `send-push-fcm`, and publish a fresh frontend build. The deployment script includes both functions.

Users enable notifications from the in-app prompt or Settings. The prompt does not request browser permission until the user chooses **Enable**. Push requires a supported browser, HTTPS, a working service worker, and the user's notification permission.

## Safe verification

An authenticated administrator can invoke `send-push-fcm` with `{ "health": true }` to validate service-account signing and Google's OAuth token exchange. This probe sends no notification. A successful response verifies OAuth credentials, not end-to-end delivery to a device.

Actual push requests require the caller's JWT to match the actor and a recent matching application event (follow, like, comment, share, unlock, direct message, call, or completed payment). The sender limits recipients and validates notification links; Firebase service-account credentials remain server-side.
