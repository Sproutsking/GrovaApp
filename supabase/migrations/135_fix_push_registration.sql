-- FCM subscriptions do not use the legacy Web Push endpoint/key columns.
ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.register_fcm_push_subscription(
  p_fcm_token text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_subscription_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_fcm_token IS NULL
     OR length(btrim(p_fcm_token)) < 20
     OR length(p_fcm_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid FCM token' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id,
    fcm_token,
    provider,
    user_agent,
    is_active,
    endpoint,
    p256dh,
    auth,
    updated_at
  )
  VALUES (
    v_user_id,
    btrim(p_fcm_token),
    'fcm',
    left(nullif(btrim(p_user_agent), ''), 500),
    true,
    NULL,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (fcm_token) WHERE fcm_token IS NOT NULL
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    provider = 'fcm',
    user_agent = EXCLUDED.user_agent,
    is_active = true,
    endpoint = NULL,
    p256dh = NULL,
    auth = NULL,
    updated_at = now()
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_fcm_push_subscription(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_push_subscription(text, text) TO authenticated;
