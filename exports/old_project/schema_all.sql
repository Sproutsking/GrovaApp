-- Complete schema for all tables

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID,
  comment_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID,
  user_id UUID,
  post_id UUID,
  reel_id UUID,
  story_id TEXT -- nullable,
  parent_id UUID,
  text VARCHAR(255),
  likes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.communities (
  id UUID,
  name TIMESTAMP WITH TIME ZONE,
  description VARCHAR(255),
  owner_id UUID,
  avatar_id TEXT -- nullable,
  avatar_metadata JSONB,
  banner_gradient VARCHAR(255),
  icon VARCHAR(255),
  is_verified BOOLEAN,
  is_premium BOOLEAN,
  is_private BOOLEAN,
  member_count BIGINT,
  online_count BIGINT,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.community_channels (
  id UUID,
  community_id UUID,
  name VARCHAR(255),
  icon VARCHAR(255),
  description VARCHAR(255),
  type VARCHAR(255),
  is_private BOOLEAN,
  position BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.community_invites (
  id UUID,
  community_id UUID,
  code TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  max_uses BIGINT,
  uses BIGINT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID,
  community_id UUID,
  user_id UUID,
  role_id UUID,
  joined_at TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID,
  channel_id UUID,
  user_id UUID,
  content VARCHAR(255),
  reply_to_id TEXT -- nullable,
  attachments JSONB,
  reactions JSONB,
  edited BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.community_roles (
  id UUID,
  community_id UUID,
  name VARCHAR(255),
  color VARCHAR(255),
  position BIGINT,
  permissions JSONB,
  is_default BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID,
  user1_id UUID,
  user2_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.discovery_content (
  id UUID,
  title VARCHAR(255),
  category VARCHAR(255),
  mood VARCHAR(255),
  caption TIMESTAMP WITH TIME ZONE,
  video_url VARCHAR(255),
  thumbnail_url VARCHAR(255),
  duration BIGINT,
  engagement_score BIGINT,
  view_count BIGINT,
  tags JSONB,
  source VARCHAR(255),
  source_id TEXT -- nullable,
  photographer TEXT -- nullable,
  active BOOLEAN,
  created_by TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID,
  user_id UUID,
  content_type VARCHAR(255),
  title TIMESTAMP WITH TIME ZONE,
  last_edited TIMESTAMP WITH TIME ZONE,
  post_content TIMESTAMP WITH TIME ZONE,
  post_images_data JSONB,
  post_category VARCHAR(255),
  reel_video_data JSONB,
  reel_thumbnail_data TEXT -- nullable,
  reel_caption VARCHAR(255),
  reel_music TEXT -- nullable,
  reel_category VARCHAR(255),
  story_title TEXT -- nullable,
  story_preview TEXT -- nullable,
  story_content VARCHAR(255),
  story_cover_data TEXT -- nullable,
  story_category VARCHAR(255),
  story_unlock_cost BIGINT,
  story_max_accesses BIGINT,
  story_title_color VARCHAR(255),
  story_text_color VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_dashboard (
  id UUID,
  user_id UUID,
  total_ep_earned FLOAT8,
  daily_ep FLOAT8,
  weekly_ep FLOAT8,
  monthly_ep FLOAT8,
  annual_ep FLOAT8,
  last_reset_daily TIMESTAMP WITH TIME ZONE,
  last_reset_weekly TIMESTAMP WITH TIME ZONE,
  last_reset_monthly TIMESTAMP WITH TIME ZONE,
  last_reset_annual TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_transactions (
  id UUID,
  user_id UUID,
  amount BIGINT,
  balance_after FLOAT8,
  type VARCHAR(255),
  reason VARCHAR(255),
  ref_payment_id TEXT -- nullable,
  ref_product_id TEXT -- nullable,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_treasury (
  id UUID,
  partition VARCHAR(255),
  balance BIGINT,
  total_received BIGINT,
  total_disbursed BIGINT,
  last_updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.ep_treasury_config (
  id UUID,
  protocol_fee_pct BIGINT,
  operations_pct BIGINT,
  growth_pct BIGINT,
  xev_rewards_pct BIGINT,
  reserve_pct BIGINT,
  updated_by TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.liquidity_config (
  id UUID,
  singleton BOOLEAN,
  ep_per_usd BIGINT,
  platform_fee_pct BIGINT,
  silver_max_usd BIGINT,
  gold_max_usd BIGINT,
  diamond_max_usd BIGINT,
  warning_threshold FLOAT8,
  critical_threshold FLOAT8,
  updated_by TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID,
  message_id UUID,
  user_id UUID,
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  content TIMESTAMP WITH TIME ZONE,
  media_url TEXT -- nullable,
  media_type TEXT -- nullable,
  read BOOLEAN,
  edited_at TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  delivered BOOLEAN,
  reply_to_id UUID
);

CREATE TABLE IF NOT EXISTS public.news_feed (
  id UUID,
  title TIMESTAMP WITH TIME ZONE,
  description TEXT,
  image_url TIMESTAMP WITH TIME ZONE,
  source_name TIMESTAMP WITH TIME ZONE,
  source_url VARCHAR(255),
  article_url VARCHAR(255),
  category VARCHAR(255),
  region VARCHAR(255),
  asset_tag TIMESTAMP WITH TIME ZONE,
  url_hash VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  views_count BIGINT,
  likes_count BIGINT,
  comments_count BIGINT,
  source_logo TEXT -- nullable,
  read_time_min TEXT -- nullable,
  total_views BIGINT,
  total_likes BIGINT,
  total_comments BIGINT
);

CREATE TABLE IF NOT EXISTS public.news_posts (
  id UUID,
  title TIMESTAMP WITH TIME ZONE,
  description TEXT,
  image_url TIMESTAMP WITH TIME ZONE,
  source_name TIMESTAMP WITH TIME ZONE,
  source_url VARCHAR(255),
  article_url VARCHAR(255),
  category VARCHAR(255),
  region VARCHAR(255),
  asset_tag VARCHAR(255),
  url_hash VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  views_count BIGINT,
  likes_count BIGINT,
  comments_count BIGINT,
  source_logo TEXT -- nullable,
  read_time_min TEXT -- nullable
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

CREATE TABLE IF NOT EXISTS public.p2p_payment_methods (
  id UUID,
  user_id UUID,
  type VARCHAR(255),
  label VARCHAR(255),
  bank_name VARCHAR(255),
  account_name VARCHAR(255),
  account_number VARCHAR(255),
  wallet_address VARCHAR(255),
  network VARCHAR(255),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.p2p_rate_limits (
  user_id UUID,
  action VARCHAR(255),
  count BIGINT,
  window_start TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.p2p_reputation (
  id UUID,
  user_id UUID,
  total_trades BIGINT,
  completed_trades BIGINT,
  disputed_trades BIGINT,
  trust_score BIGINT,
  volume_xev BIGINT,
  volume_usdt BIGINT,
  avg_release_secs BIGINT,
  is_verified BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID,
  user_id UUID,
  product_id UUID,
  idempotency_key UUID,
  provider VARCHAR(255),
  provider_session VARCHAR(255),
  amount_cents BIGINT,
  currency VARCHAR(255),
  status VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payment_products (
  id UUID,
  name VARCHAR(255),
  description VARCHAR(255),
  type VARCHAR(255),
  tier VARCHAR(255),
  amount_usd FLOAT8,
  currency VARCHAR(255),
  stripe_price_id TEXT -- nullable,
  paystack_plan_code TEXT -- nullable,
  interval TEXT -- nullable,
  is_active BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID,
  user_id UUID,
  product_id UUID,
  provider VARCHAR(255),
  provider_payment_id VARCHAR(255),
  provider_customer_id TEXT -- nullable,
  provider_session_id TEXT -- nullable,
  subscription_id TEXT -- nullable,
  subscription_status TEXT -- nullable,
  current_period_start TEXT -- nullable,
  current_period_end TEXT -- nullable,
  amount_cents BIGINT,
  currency VARCHAR(255),
  fee_cents BIGINT,
  net_cents BIGINT,
  status VARCHAR(255),
  failure_reason TEXT -- nullable,
  idempotency_key UUID,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  chain_id TEXT -- nullable,
  contract_address TEXT -- nullable,
  wallet_address TEXT -- nullable,
  block_number TEXT -- nullable,
  block_confirmations BIGINT,
  ip_address TEXT -- nullable,
  user_agent TEXT -- nullable,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.paywave_fee_config (
  id UUID,
  transaction_type VARCHAR(255),
  fee_percentage FLOAT8,
  min_amount BIGINT,
  max_amount TEXT -- nullable,
  description TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.platform_freeze (
  region VARCHAR(255),
  is_frozen BOOLEAN,
  frozen_by UUID,
  frozen_reason TEXT -- nullable,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID,
  key VARCHAR(255),
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID,
  post_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID,
  user_id UUID,
  content TEXT,
  image_ids JSONB,
  image_metadata JSONB,
  category TIMESTAMP WITH TIME ZONE,
  likes BIGINT,
  comments_count BIGINT,
  shares BIGINT,
  views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  video_ids JSONB,
  video_metadata JSONB,
  is_text_card BOOLEAN,
  text_card_metadata JSONB,
  card_caption VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.posts_backup (
  id UUID,
  user_id UUID,
  content VARCHAR(255),
  images JSONB,
  image_ids JSONB,
  image_metadata JSONB,
  category TIMESTAMP WITH TIME ZONE,
  likes BIGINT,
  comments_count BIGINT,
  shares BIGINT,
  views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable
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

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id UUID,
  reel_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.reels (
  id UUID,
  user_id UUID,
  video_id VARCHAR(255),
  video_metadata JSONB,
  thumbnail_id TEXT -- nullable,
  caption TIMESTAMP WITH TIME ZONE,
  music VARCHAR(255),
  category TIMESTAMP WITH TIME ZONE,
  duration BIGINT,
  likes BIGINT,
  comments_count BIGINT,
  shares BIGINT,
  views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.saved_content (
  id UUID,
  user_id UUID,
  content_type VARCHAR(255),
  content_id UUID,
  folder VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.sounds (
  id UUID,
  name VARCHAR(255),
  first_used_by TEXT -- nullable,
  first_used_at TIMESTAMP WITH TIME ZONE,
  total_uses BIGINT,
  category TEXT -- nullable,
  is_trending BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.status_likes (
  id UUID,
  status_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.status_updates (
  id UUID,
  user_id UUID,
  text TIMESTAMP WITH TIME ZONE,
  bg VARCHAR(255),
  text_color VARCHAR(255),
  image_id VARCHAR(255),
  duration_h BIGINT,
  views BIGINT,
  likes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  media_type VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID,
  user_id UUID,
  title TIMESTAMP WITH TIME ZONE,
  preview TIMESTAMP WITH TIME ZONE,
  full_content TIMESTAMP WITH TIME ZONE,
  cover_image_id VARCHAR(255),
  cover_image_metadata JSONB,
  category VARCHAR(255),
  unlock_cost BIGINT,
  max_accesses BIGINT,
  current_accesses BIGINT,
  likes BIGINT,
  comments_count BIGINT,
  views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID,
  from_user_id UUID,
  to_user_id UUID,
  amount BIGINT,
  type VARCHAR(255),
  status VARCHAR(255),
  metadata JSONB,
  requires_pin BOOLEAN,
  pin_verified BOOLEAN,
  ip_address TEXT -- nullable,
  device_fingerprint TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TEXT -- nullable
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

CREATE TABLE IF NOT EXISTS public.wallet_addresses (
  id UUID,
  user_id UUID,
  chain VARCHAR(255),
  address TIMESTAMP WITH TIME ZONE,
  public_key TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.wallet_history (
  id UUID,
  wallet_id UUID,
  user_id UUID,
  change_type VARCHAR(255),
  amount FLOAT8,
  balance_before FLOAT8,
  balance_after FLOAT8,
  reason VARCHAR(255),
  transaction_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID,
  user_id UUID,
  xev_tokens BIGINT,
  engagement_points FLOAT8,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  daily_withdrawal_limit BIGINT,
  withdrawal_pin_hash TIMESTAMP WITH TIME ZONE,
  pin_attempts BIGINT,
  pin_locked_until TEXT -- nullable,
  paywave_balance FLOAT8,
  pin_length BIGINT,
  recovery_phrase_encrypted TIMESTAMP WITH TIME ZONE,
  recovery_phrase_hash VARCHAR(255),
  recovery_phrase_word_count BIGINT,
  recovery_phrase_generated_at TIMESTAMP WITH TIME ZONE,
  recovery_phrase_acknowledged_at TEXT -- nullable,
  usdt_balance BIGINT
);

CREATE TABLE IF NOT EXISTS public.withdrawal_queue (
  id UUID,
  user_id UUID,
  ep_amount BIGINT,
  processing_tier BIGINT,
  fee_pct FLOAT8,
  fee_amount FLOAT8,
  net_ep FLOAT8,
  priority BIGINT,
  status VARCHAR(255),
  batch_id TEXT -- nullable,
  system_state_at_submit VARCHAR(255),
  destination_type VARCHAR(255),
  destination_info JSONB,
  requested_at TIMESTAMP WITH TIME ZONE,
  estimated_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_msg TEXT -- nullable,
  admin_notes TEXT -- nullable,
  metadata JSONB
);

