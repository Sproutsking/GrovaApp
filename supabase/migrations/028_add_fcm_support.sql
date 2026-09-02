-- Add FCM token support to push_subscriptions table
-- Allows storing Firebase Cloud Messaging tokens alongside legacy endpoints

ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'legacy' CHECK (provider IN ('legacy', 'onesignal', 'fcm'));

-- Ensure there is only one active FCM token per user, while allowing nulls.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_fcm_unique
  ON public.push_subscriptions(user_id, fcm_token)
  WHERE fcm_token IS NOT NULL;

-- Ensure there is only one legacy endpoint per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint_unique
  ON public.push_subscriptions(user_id, endpoint)
  WHERE endpoint IS NOT NULL;

-- Create index on provider for faster queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_provider
  ON public.push_subscriptions(user_id, provider, is_active);

-- Optional: keep a unique token index if you prefer global uniqueness for FCM tokens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token_unique
  ON public.push_subscriptions(fcm_token)
  WHERE fcm_token IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.push_subscriptions.fcm_token IS 'Firebase Cloud Messaging token for native mobile push';
COMMENT ON COLUMN public.push_subscriptions.provider IS 'Push provider: legacy (VAPID), onesignal, or fcm';
