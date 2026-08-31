-- Add FCM token support to push_subscriptions table
-- Allows storing Firebase Cloud Messaging tokens alongside legacy endpoints

ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS fcm_token TEXT UNIQUE;

ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'legacy' CHECK (provider IN ('legacy', 'onesignal', 'fcm'));

-- Create index on provider for faster queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_provider 
  ON public.push_subscriptions(user_id, provider, is_active);

-- Add comment for clarity
COMMENT ON COLUMN public.push_subscriptions.fcm_token IS 'Firebase Cloud Messaging token for native mobile push';
COMMENT ON COLUMN public.push_subscriptions.provider IS 'Push provider: legacy (VAPID), onesignal, or fcm';
