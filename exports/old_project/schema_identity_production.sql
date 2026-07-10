-- ============================================================================
-- IDENTITY PROJECT SCHEMA (pevhyriszemvnrwvfshm)
-- Auth, Sessions, MFA, Recovery, Security, Device Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  username text NOT NULL UNIQUE CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  avatar_id text,
  avatar_metadata jsonb DEFAULT '{}'::jsonb,
  bio text,
  verified boolean DEFAULT false,
  is_pro boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  deletion_requested_at timestamp with time zone,
  last_seen timestamp with time zone DEFAULT now(),
  security_level integer DEFAULT 1 CHECK (security_level >= 1 AND security_level <= 5),
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamp with time zone,
  require_2fa boolean DEFAULT false,
  password_changed_at timestamp with time zone DEFAULT now(),
  is_private boolean DEFAULT false,
  show_email boolean DEFAULT false,
  show_phone boolean DEFAULT false,
  phone text,
  phone_verified boolean DEFAULT false,
  preferences jsonb DEFAULT jsonb_build_object('notify_likes', false, 'notify_comments', false, 'notify_shares', false, 'notify_unlocks', false, 'notify_followers', false, 'notify_profile_visits', false),
  pro_expires_at timestamp with time zone,
  account_status text DEFAULT 'active'::text CHECK (account_status = ANY (ARRAY['active'::text, 'deactivated'::text, 'suspended'::text])),
  deactivated_reason text,
  layer2_security_deadline timestamp with time zone,
  facial_verification_enabled boolean DEFAULT false,
  fingerprint_enabled boolean DEFAULT false,
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'free'::text])),
  payment_date timestamp with time zone,
  next_payment_date timestamp with time zone,
  invite_code_used text,
  account_activated boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  stripe_customer_id text UNIQUE,
  paystack_customer_id text UNIQUE,
  subscription_tier text DEFAULT 'free'::text CHECK (subscription_tier = ANY (ARRAY['free'::text, 'whitelist'::text, 'standard'::text, 'vip'::text, 'silver'::text, 'gold'::text, 'diamond'::text])),
  subscription_expires timestamp with time zone,
  engagement_points numeric NOT NULL DEFAULT 0 CHECK (engagement_points >= 0::numeric),
  date_of_birth date,
  home_address text,
  boost_selections jsonb DEFAULT '{}'::jsonb,
  reward_level text DEFAULT 'none'::text CHECK (reward_level = ANY (ARRAY['none'::text, 'silver'::text, 'gold'::text, 'diamond'::text])),
  reward_level_since timestamp with time zone,
  level_activity_score numeric DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  refresh_token text UNIQUE,
  device_fingerprint_id uuid,
  ip_address text,
  user_agent text,
  location_data jsonb,
  is_active boolean DEFAULT true,
  last_activity timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.user_recovery_phrases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  phrase_encoded text NOT NULL,
  phrase_hash text NOT NULL,
  phrase_hint text,
  word_count integer DEFAULT 12,
  created_at timestamp with time zone DEFAULT now(),
  revealed_at timestamp with time zone,
  CONSTRAINT user_recovery_phrases_pkey PRIMARY KEY (id),
  CONSTRAINT user_recovery_phrases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  secret text NOT NULL,
  enabled boolean DEFAULT false,
  backup_codes text[],
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone,
  CONSTRAINT two_factor_auth_pkey PRIMARY KEY (id),
  CONSTRAINT two_factor_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  device_name text,
  browser text,
  os text,
  is_trusted boolean DEFAULT false,
  first_seen timestamp with time zone DEFAULT now(),
  last_seen timestamp with time zone DEFAULT now(),
  location_country text,
  location_city text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT device_fingerprints_pkey PRIMARY KEY (id),
  CONSTRAINT device_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fingerprint_id uuid,
  device_name text NOT NULL,
  trusted_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  revoked boolean DEFAULT false,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trusted_devices_pkey PRIMARY KEY (id),
  CONSTRAINT trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT trusted_devices_device_fingerprint_id_fkey FOREIGN KEY (device_fingerprint_id) REFERENCES public.device_fingerprints(id)
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['login_success'::text, 'login_failed'::text, 'logout'::text, '2fa_enabled'::text, '2fa_disabled'::text, '2fa_verified'::text, '2fa_failed'::text, 'password_changed'::text, 'email_changed'::text, 'suspicious_activity'::text, 'account_locked'::text, 'account_unlocked'::text, 'device_trusted'::text, 'device_untrusted'::text, 'withdrawal_pin_set'::text, 'withdrawal_pin_failed'::text, 'account_deletion_requested'::text, 'account_deletion_cancelled'::text, '2fa_setup_started'::text])),
  severity text DEFAULT 'info'::text CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])),
  ip_address text,
  user_agent text,
  device_fingerprint text,
  location_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT security_events_pkey PRIMARY KEY (id),
  CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  code_type text NOT NULL CHECK (code_type = ANY (ARRAY['email_verify'::text, 'phone_verify'::text, 'login'::text, 'password_reset'::text, 'reauth'::text])),
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notification_badge_state (
  user_id uuid NOT NULL,
  badge_cleared_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_badge_state_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_badge_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.notification_dedup (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  last_notified_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_dedup_pkey PRIMARY KEY (id),
  CONSTRAINT notification_dedup_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  notify_posts boolean DEFAULT false,
  notify_stories boolean DEFAULT false,
  notify_reels boolean DEFAULT false,
  notify_comments boolean DEFAULT false,
  notify_likes boolean DEFAULT false,
  notify_shares boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notification_preferences_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
