-- Identity schema bundle (apply this in the Identity Supabase project's SQL editor)
-- Includes all tables from the identity boundary in exports/old_project/boundary_map.json
-- This bundle is for the IDENTITY project only.

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

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS account_activated boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  platform_user_id text NOT NULL,
  auth_status text DEFAULT 'active',
  permissions jsonb DEFAULT '[]'::jsonb,
  last_sync_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, provider, platform_user_id)
);

CREATE TABLE IF NOT EXISTS public.tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.connections(id) ON DELETE CASCADE,
  token_type text,
  encrypted_token bytea,
  expires_at timestamp with time zone,
  revoked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  change_set jsonb,
  target_connection_id uuid,
  status text DEFAULT 'pending',
  attempts integer DEFAULT 0,
  last_error text,
  scheduled_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
  platform text,
  action text,
  result jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ambassador_profiles (
  id uuid PRIMARY KEY,
  user_id uuid,
  invite_code_id uuid,
  invite_code text,
  status varchar(255),
  current_level bigint,
  commission_pct bigint,
  level_override boolean,
  total_referrals bigint,
  prev_month_referrals bigint,
  this_month_referrals bigint,
  lifetime_earned bigint,
  payout_info jsonb,
  suspend_reason text,
  joined_at timestamp with time zone,
  level_updated_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY,
  user_id uuid,
  title text,
  category text,
  mode varchar(255),
  quality_preset varchar(255),
  is_private boolean,
  is_recording boolean,
  livekit_room varchar(255),
  livekit_token text,
  cf_stream_uid text,
  cf_playback_url text,
  status varchar(255),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  peak_viewers bigint,
  total_likes bigint,
  last_heartbeat timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.profile_access_summary (
  id uuid PRIMARY KEY,
  email varchar(255),
  full_name text,
  username varchar(255),
  access_status text,
  profile_tier_label varchar(255),
  payment_status varchar(255),
  subscription_tier varchar(255),
  account_activated boolean,
  engagement_points float8,
  invite_code_used varchar(255),
  payment_date timestamp with time zone,
  created_at timestamp with time zone,
  total_ep_earned float8,
  has_active_boost boolean
);

CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  viewed_date date,
  CONSTRAINT profile_views_pkey PRIMARY KEY (id),
  CONSTRAINT profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.profiles_backup (
  id uuid,
  email varchar(255),
  full_name varchar(255),
  username varchar(255),
  avatar_url text,
  avatar_id text,
  avatar_metadata jsonb,
  bio text,
  verified boolean,
  is_pro boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted_at text,
  deletion_requested_at text,
  last_seen timestamp with time zone,
  security_level bigint,
  failed_login_attempts bigint,
  account_locked_until text,
  require_2fa boolean,
  password_changed_at timestamp with time zone,
  is_private boolean,
  show_email boolean,
  show_phone boolean,
  phone text,
  phone_verified boolean,
  preferences jsonb,
  pro_expires_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.push_notifications (
  id uuid PRIMARY KEY,
  title text,
  body text,
  target_type varchar(255),
  target_ids jsonb,
  type varchar(255),
  sent_by uuid,
  sent_by_name text,
  reach bigint,
  sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY,
  recipient_user_id uuid,
  actor_user_id uuid,
  type varchar(255),
  entity_id uuid,
  message varchar(255),
  is_read boolean,
  created_at timestamp with time zone,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS public.notification_badge_state (
  user_id uuid NOT NULL,
  badge_cleared_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_badge_state_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_badge_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.notification_dedup (
  dedup_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT notification_dedup_pkey PRIMARY KEY (dedup_key)
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

CREATE TABLE IF NOT EXISTS public.blocked_ips (
  ip text NOT NULL,
  reason text,
  blocked_by uuid,
  blocked_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT blocked_ips_pkey PRIMARY KEY (ip),
  CONSTRAINT blocked_ips_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  action_type text NOT NULL,
  action_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
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
