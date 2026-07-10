-- IDENTITY Project Schema
-- Tables: 18 total (13 with data)

CREATE TABLE IF NOT EXISTS public.ambassador_profiles (
  id UUID,
  user_id UUID,
  invite_code_id UUID,
  invite_code TIMESTAMP WITH TIME ZONE,
  status VARCHAR(255),
  current_level BIGINT,
  commission_pct BIGINT,
  level_override BOOLEAN,
  total_referrals BIGINT,
  prev_month_referrals BIGINT,
  this_month_referrals BIGINT,
  lifetime_earned BIGINT,
  payout_info JSONB,
  suspend_reason TEXT -- nullable,
  joined_at TIMESTAMP WITH TIME ZONE,
  level_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID,
  user_id UUID,
  title TIMESTAMP WITH TIME ZONE,
  category TIMESTAMP WITH TIME ZONE,
  mode VARCHAR(255),
  quality_preset VARCHAR(255),
  is_private BOOLEAN,
  is_recording BOOLEAN,
  livekit_room VARCHAR(255),
  livekit_token TEXT -- nullable,
  cf_stream_uid TEXT -- nullable,
  cf_playback_url TEXT -- nullable,
  status VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  peak_viewers BIGINT,
  total_likes BIGINT,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.notification_badge_state (
  user_id UUID,
  badge_cleared_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.notification_dedup (
  dedup_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID,
  recipient_user_id UUID,
  actor_user_id UUID,
  type VARCHAR(255),
  entity_id UUID,
  message VARCHAR(255),
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS public.profile_access_summary (
  id UUID,
  email VARCHAR(255),
  full_name TIMESTAMP WITH TIME ZONE,
  username VARCHAR(255),
  access_status TIMESTAMP WITH TIME ZONE,
  profile_tier_label VARCHAR(255),
  payment_status VARCHAR(255),
  subscription_tier VARCHAR(255),
  account_activated BOOLEAN,
  engagement_points FLOAT8,
  invite_code_used VARCHAR(255),
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  total_ep_earned FLOAT8,
  has_active_boost BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID,
  email VARCHAR(255),
  full_name TIMESTAMP WITH TIME ZONE,
  username VARCHAR(255),
  avatar_id VARCHAR(255),
  avatar_metadata JSONB,
  bio VARCHAR(255),
  verified BOOLEAN,
  is_pro BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable,
  deletion_requested_at TEXT -- nullable,
  last_seen TIMESTAMP WITH TIME ZONE,
  security_level BIGINT,
  failed_login_attempts BIGINT,
  account_locked_until TEXT -- nullable,
  require_2fa BOOLEAN,
  password_changed_at TIMESTAMP WITH TIME ZONE,
  is_private BOOLEAN,
  show_email BOOLEAN,
  show_phone BOOLEAN,
  phone TEXT -- nullable,
  phone_verified BOOLEAN,
  preferences JSONB,
  pro_expires_at TIMESTAMP WITH TIME ZONE,
  account_status VARCHAR(255),
  deactivated_reason TEXT -- nullable,
  layer2_security_deadline TEXT -- nullable,
  facial_verification_enabled BOOLEAN,
  fingerprint_enabled BOOLEAN,
  payment_status VARCHAR(255),
  payment_date TIMESTAMP WITH TIME ZONE,
  next_payment_date TEXT -- nullable,
  invite_code_used VARCHAR(255),
  account_activated BOOLEAN,
  is_admin BOOLEAN,
  stripe_customer_id TEXT -- nullable,
  paystack_customer_id TEXT -- nullable,
  subscription_tier VARCHAR(255),
  subscription_expires TIMESTAMP WITH TIME ZONE,
  engagement_points FLOAT8,
  date_of_birth TEXT -- nullable,
  home_address TEXT -- nullable,
  boost_selections JSONB,
  reward_level VARCHAR(255),
  reward_level_since TEXT -- nullable,
  level_activity_score BIGINT
);

CREATE TABLE IF NOT EXISTS public.profiles_backup (
  id UUID,
  email VARCHAR(255),
  full_name VARCHAR(255),
  username VARCHAR(255),
  avatar_url TEXT -- nullable,
  avatar_id TEXT -- nullable,
  avatar_metadata JSONB,
  bio TEXT -- nullable,
  verified BOOLEAN,
  is_pro BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable,
  deletion_requested_at TEXT -- nullable,
  last_seen TIMESTAMP WITH TIME ZONE,
  security_level BIGINT,
  failed_login_attempts BIGINT,
  account_locked_until TEXT -- nullable,
  require_2fa BOOLEAN,
  password_changed_at TIMESTAMP WITH TIME ZONE,
  is_private BOOLEAN,
  show_email BOOLEAN,
  show_phone BOOLEAN,
  phone TEXT -- nullable,
  phone_verified BOOLEAN,
  preferences JSONB,
  pro_expires_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID,
  title TIMESTAMP WITH TIME ZONE,
  body TIMESTAMP WITH TIME ZONE,
  target_type VARCHAR(255),
  target_ids JSONB,
  type VARCHAR(255),
  sent_by UUID,
  sent_by_name TEXT -- nullable,
  reach BIGINT,
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID,
  user_id UUID,
  event_type VARCHAR(255),
  severity VARCHAR(255),
  ip_address TEXT -- nullable,
  user_agent TEXT -- nullable,
  device_fingerprint TEXT -- nullable,
  location_data TEXT -- nullable,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID,
  user_id UUID,
  secret TIMESTAMP WITH TIME ZONE,
  enabled BOOLEAN,
  backup_codes JSONB,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.user_recovery_phrases (
  id UUID,
  user_id UUID,
  phrase_encoded VARCHAR(255),
  phrase_hash VARCHAR(255),
  phrase_hint VARCHAR(255),
  word_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  revealed_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID,
  user_id UUID,
  session_token TIMESTAMP WITH TIME ZONE,
  refresh_token TEXT -- nullable,
  device_fingerprint_id TEXT -- nullable,
  ip_address TEXT -- nullable,
  user_agent TIMESTAMP WITH TIME ZONE,
  location_data TEXT -- nullable,
  is_active BOOLEAN,
  last_activity TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  ended_at TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

