-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
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
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  xev_tokens numeric DEFAULT 0 CHECK (xev_tokens >= 0::numeric),
  engagement_points numeric DEFAULT 0 CHECK (engagement_points >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  daily_withdrawal_limit numeric DEFAULT 1000,
  withdrawal_pin_hash text,
  pin_attempts integer DEFAULT 0,
  pin_locked_until timestamp with time zone,
  paywave_balance numeric NOT NULL DEFAULT 0,
  pin_length integer DEFAULT 4,
  recovery_phrase_encrypted text,
  recovery_phrase_hash text,
  recovery_phrase_word_count integer DEFAULT 12,
  recovery_phrase_generated_at timestamp with time zone,
  recovery_phrase_acknowledged_at timestamp with time zone,
  usdt_balance numeric NOT NULL DEFAULT 0 CHECK (usdt_balance >= 0::numeric),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ep_dashboard (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_ep_earned numeric DEFAULT 0 CHECK (total_ep_earned >= 0::numeric),
  daily_ep numeric DEFAULT 0 CHECK (daily_ep >= 0::numeric),
  weekly_ep numeric DEFAULT 0 CHECK (weekly_ep >= 0::numeric),
  monthly_ep numeric DEFAULT 0 CHECK (monthly_ep >= 0::numeric),
  annual_ep numeric DEFAULT 0 CHECK (annual_ep >= 0::numeric),
  last_reset_daily timestamp with time zone DEFAULT now(),
  last_reset_weekly timestamp with time zone DEFAULT now(),
  last_reset_monthly timestamp with time zone DEFAULT now(),
  last_reset_annual timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ep_dashboard_pkey PRIMARY KEY (id),
  CONSTRAINT ep_dashboard_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.two_factor_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  secret text NOT NULL,
  enabled boolean DEFAULT false,
  backup_codes ARRAY,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone,
  CONSTRAINT two_factor_auth_pkey PRIMARY KEY (id),
  CONSTRAINT two_factor_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.device_fingerprints (
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
CREATE TABLE public.trusted_devices (
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
CREATE TABLE public.security_events (
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
CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['login_attempt'::text, 'signup_attempt'::text, 'password_reset'::text, 'post_create'::text, 'comment_create'::text, 'like'::text, 'unlock'::text, 'share'::text, 'withdrawal'::text, 'transfer'::text, '2fa_attempt'::text])),
  action_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_sessions (
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
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_sessions_device_fingerprint_id_fkey FOREIGN KEY (device_fingerprint_id) REFERENCES public.device_fingerprints(id)
);
CREATE TABLE public.audit_logs (
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
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text,
  image_ids ARRAY DEFAULT '{}'::text[],
  image_metadata jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT 'General'::text,
  likes integer DEFAULT 0 CHECK (likes >= 0),
  comments_count integer DEFAULT 0 CHECK (comments_count >= 0),
  shares integer DEFAULT 0 CHECK (shares >= 0),
  views integer DEFAULT 0 CHECK (views >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  video_ids ARRAY DEFAULT '{}'::text[],
  video_metadata jsonb DEFAULT '[]'::jsonb,
  is_text_card boolean DEFAULT false,
  text_card_metadata jsonb,
  card_caption text,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.stories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  preview text NOT NULL CHECK (char_length(preview) >= 10 AND char_length(preview) <= 500),
  full_content text NOT NULL,
  cover_image_id text,
  cover_image_metadata jsonb DEFAULT '{}'::jsonb,
  category text DEFAULT 'Folklore'::text,
  unlock_cost integer DEFAULT 0 CHECK (unlock_cost >= 0),
  max_accesses integer DEFAULT 1000 CHECK (max_accesses > 0),
  current_accesses integer DEFAULT 0,
  likes integer DEFAULT 0 CHECK (likes >= 0),
  comments_count integer DEFAULT 0 CHECK (comments_count >= 0),
  views integer DEFAULT 0 CHECK (views >= 0),
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT stories_pkey PRIMARY KEY (id),
  CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.reels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id text,
  video_metadata jsonb DEFAULT '{}'::jsonb,
  thumbnail_id text,
  caption text,
  music text,
  category text DEFAULT 'Entertainment'::text,
  duration integer CHECK (duration IS NULL OR duration > 0),
  likes integer DEFAULT 0 CHECK (likes >= 0),
  comments_count integer DEFAULT 0 CHECK (comments_count >= 0),
  shares integer DEFAULT 0 CHECK (shares >= 0),
  views integer DEFAULT 0 CHECK (views >= 0),
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT reels_pkey PRIMARY KEY (id),
  CONSTRAINT reels_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid,
  reel_id uuid,
  story_id uuid,
  parent_id uuid,
  text text NOT NULL CHECK (char_length(TRIM(BOTH FROM text)) > 0),
  likes integer DEFAULT 0 CHECK (likes >= 0),
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT comments_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id),
  CONSTRAINT comments_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id),
  CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id)
);
CREATE TABLE public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.story_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT story_likes_pkey PRIMARY KEY (id),
  CONSTRAINT story_likes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id),
  CONSTRAINT story_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.reel_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reel_likes_pkey PRIMARY KEY (id),
  CONSTRAINT reel_likes_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id),
  CONSTRAINT reel_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.unlocked_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unlocked_stories_pkey PRIMARY KEY (id),
  CONSTRAINT unlocked_stories_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id),
  CONSTRAINT unlocked_stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.saved_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text])),
  content_id uuid NOT NULL,
  folder text DEFAULT 'Favorites'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_content_pkey PRIMARY KEY (id),
  CONSTRAINT saved_content_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text])),
  content_id uuid NOT NULL,
  user_id uuid NOT NULL,
  share_type text DEFAULT 'profile'::text CHECK (share_type = ANY (ARRAY['profile'::text, 'external'::text, 'direct'::text, 'story'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shares_pkey PRIMARY KEY (id),
  CONSTRAINT shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid,
  to_user_id uuid,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  type text NOT NULL CHECK (type = ANY (ARRAY['unlock_story'::text, 'tip'::text, 'reward'::text, 'purchase'::text, 'withdrawal'::text, 'transfer'::text, 'deposit'::text, 'refund'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  requires_pin boolean DEFAULT false,
  pin_verified boolean DEFAULT false,
  ip_address text,
  device_fingerprint text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wallet_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type = ANY (ARRAY['credit'::text, 'debit'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  balance_before numeric NOT NULL CHECK (balance_before >= 0::numeric),
  balance_after numeric NOT NULL CHECK (balance_after >= 0::numeric),
  reason text NOT NULL,
  transaction_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_history_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_history_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT wallet_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT wallet_history_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.platform_revenue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  user_id uuid,
  source text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_revenue_pkey PRIMARY KEY (id),
  CONSTRAINT platform_revenue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.posts_backup (
  id uuid,
  user_id uuid,
  content text,
  images ARRAY,
  image_ids ARRAY,
  image_metadata jsonb,
  category text,
  likes integer,
  comments_count integer,
  shares integer,
  views integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone
);
CREATE TABLE public.reels_backup (
  id uuid,
  user_id uuid,
  video_url text,
  video_id text,
  video_metadata jsonb,
  thumbnail_url text,
  thumbnail_id text,
  caption text,
  music text,
  category text,
  duration integer,
  likes integer,
  comments_count integer,
  shares integer,
  views integer,
  created_at timestamp with time zone,
  deleted_at timestamp with time zone
);
CREATE TABLE public.stories_backup (
  id uuid,
  user_id uuid,
  title text,
  preview text,
  full_content text,
  cover_image text,
  cover_image_id text,
  cover_image_metadata jsonb,
  category text,
  unlock_cost integer,
  max_accesses integer,
  current_accesses integer,
  likes integer,
  comments_count integer,
  views integer,
  created_at timestamp with time zone,
  deleted_at timestamp with time zone
);
CREATE TABLE public.profiles_backup (
  id uuid,
  email text,
  full_name text,
  username text,
  avatar_url text,
  avatar_id text,
  avatar_metadata jsonb,
  bio text,
  verified boolean,
  is_pro boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  deletion_requested_at timestamp with time zone,
  last_seen timestamp with time zone,
  security_level integer,
  failed_login_attempts integer,
  account_locked_until timestamp with time zone,
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
CREATE TABLE public.upload_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  upload_type text NOT NULL CHECK (upload_type = ANY (ARRAY['image'::text, 'video'::text])),
  upload_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT upload_rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT upload_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.sounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  first_used_by uuid,
  first_used_at timestamp without time zone DEFAULT now(),
  total_uses integer DEFAULT 1,
  category text,
  is_trending boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sounds_pkey PRIMARY KEY (id),
  CONSTRAINT sounds_first_used_by_fkey FOREIGN KEY (first_used_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.communities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 100),
  description text,
  owner_id uuid NOT NULL,
  avatar_id text,
  avatar_metadata jsonb DEFAULT '{}'::jsonb,
  banner_gradient text DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'::text,
  icon text DEFAULT '🌟'::text,
  is_verified boolean DEFAULT false,
  is_premium boolean DEFAULT false,
  is_private boolean DEFAULT false,
  member_count integer DEFAULT 0 CHECK (member_count >= 0),
  online_count integer DEFAULT 0 CHECK (online_count >= 0),
  settings jsonb DEFAULT '{"two_factor_auth": false, "verification_level": "medium", "default_notifications": "mentions", "explicit_content_filter": "all"}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  icon_border text NOT NULL DEFAULT 'default'::text,
  background_theme text NOT NULL DEFAULT 'security'::text,
  CONSTRAINT communities_pkey PRIMARY KEY (id),
  CONSTRAINT communities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.community_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  color text DEFAULT '#95A5A6'::text,
  position integer DEFAULT 0,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  icon text NOT NULL DEFAULT '♟'::text,
  CONSTRAINT community_roles_pkey PRIMARY KEY (id),
  CONSTRAINT community_roles_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id)
);
CREATE TABLE public.community_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  is_online boolean DEFAULT false,
  last_seen timestamp with time zone DEFAULT now(),
  CONSTRAINT community_members_pkey PRIMARY KEY (id),
  CONSTRAINT community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id),
  CONSTRAINT community_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT community_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.community_roles(id)
);
CREATE TABLE public.community_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  icon text DEFAULT '💬'::text,
  description text,
  type text DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'voice'::text, 'announcement'::text])),
  is_private boolean DEFAULT false,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  is_default boolean NOT NULL DEFAULT false,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  integrations jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'Channels'::text,
  tool_type text CHECK (tool_type IS NULL OR (tool_type = ANY (ARRAY['verification'::text, 'social_updates'::text, 'tickets'::text]))),
  CONSTRAINT community_channels_pkey PRIMARY KEY (id),
  CONSTRAINT community_channels_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id)
);
CREATE TABLE public.community_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) > 0),
  reply_to_id uuid,
  attachments jsonb DEFAULT '[]'::jsonb,
  reactions jsonb DEFAULT '{}'::jsonb,
  edited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT community_messages_pkey PRIMARY KEY (id),
  CONSTRAINT community_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.community_channels(id),
  CONSTRAINT community_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT community_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.community_messages(id)
);
CREATE TABLE public.community_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  max_uses integer,
  uses integer DEFAULT 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_invites_pkey PRIMARY KEY (id),
  CONSTRAINT community_invites_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id),
  CONSTRAINT community_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text])),
  title text,
  last_edited timestamp with time zone DEFAULT now(),
  post_content text,
  post_images_data jsonb DEFAULT '[]'::jsonb,
  post_category text,
  reel_video_data jsonb,
  reel_thumbnail_data jsonb,
  reel_caption text,
  reel_music text,
  reel_category text,
  story_title text,
  story_preview text,
  story_content text,
  story_cover_data jsonb,
  story_category text,
  story_unlock_cost integer,
  story_max_accesses integer,
  story_title_color text,
  story_text_color text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT drafts_pkey PRIMARY KEY (id),
  CONSTRAINT drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notification_preferences (
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
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.profiles(id),
  CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) > 0),
  media_url text,
  media_type text CHECK (media_type IS NULL OR (media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'file'::text]))),
  read boolean DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  delivered boolean DEFAULT false,
  reply_to_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.deleted_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  deleted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deleted_messages_pkey PRIMARY KEY (id),
  CONSTRAINT deleted_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT deleted_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.hidden_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  hidden_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hidden_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT hidden_conversations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT hidden_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 10),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.message_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_reads_pkey PRIMARY KEY (id),
  CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  code_type text NOT NULL CHECK (code_type = ANY (ARRAY['email_verify'::text, 'phone_verify'::text, 'login'::text, 'password_reset'::text, 'reauth'::text])),
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  fcm_token text UNIQUE,
  provider text DEFAULT 'legacy'::text CHECK (provider = ANY (ARRAY['legacy'::text, 'onesignal'::text, 'fcm'::text])),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  actor_user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'profile_view'::text, 'unlock'::text, 'share'::text, 'new_post'::text, 'new_story'::text, 'new_reel'::text, 'story_unlocked_by_you'::text, 'milestone_followers'::text, 'payment_confirmed'::text, 'comment_reply'::text, 'mention'::text])),
  entity_id uuid,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profile_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  viewed_date date DEFAULT date((viewed_at AT TIME ZONE 'UTC'::text)),
  CONSTRAINT profile_views_pkey PRIMARY KEY (id),
  CONSTRAINT profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.admin_team (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['ceo_owner'::text, 'a_admin'::text, 'b_admin'::text, 'super_admin'::text, 'admin'::text, 'support'::text])),
  permissions ARRAY NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  xa_id integer,
  is_online boolean DEFAULT false,
  CONSTRAINT admin_team_pkey PRIMARY KEY (id),
  CONSTRAINT admin_team_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT admin_team_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.invite_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'standard'::text CHECK (type = ANY (ARRAY['standard'::text, 'vip'::text, 'admin'::text, 'whitelist'::text])),
  max_uses integer DEFAULT 100,
  uses_count integer DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'expired'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  community_id uuid,
  community_name text,
  price_override numeric,
  entry_price numeric DEFAULT 1.00,
  CONSTRAINT invite_codes_pkey PRIMARY KEY (id),
  CONSTRAINT invite_codes_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id),
  CONSTRAINT invite_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.invite_code_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_code_id uuid,
  code text NOT NULL,
  used_by uuid,
  used_at timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text,
  CONSTRAINT invite_code_usage_pkey PRIMARY KEY (id),
  CONSTRAINT invite_code_usage_invite_code_id_fkey FOREIGN KEY (invite_code_id) REFERENCES public.invite_codes(id),
  CONSTRAINT invite_code_usage_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (id),
  CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.payment_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type = ANY (ARRAY['one_time'::text, 'subscription'::text])),
  tier text NOT NULL DEFAULT 'standard'::text CHECK (tier = ANY (ARRAY['whitelist'::text, 'standard'::text, 'pro'::text, 'vip'::text])),
  amount_usd numeric NOT NULL CHECK (amount_usd > 0::numeric),
  currency text NOT NULL DEFAULT 'USD'::text,
  stripe_price_id text UNIQUE,
  paystack_plan_code text UNIQUE,
  interval text CHECK ("interval" = ANY (ARRAY['month'::text, 'year'::text, NULL::text])),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  provider_session text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL DEFAULT 'created'::text CHECK (status = ANY (ARRAY['created'::text, 'redirected'::text, 'completed'::text, 'expired'::text, 'failed'::text])),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:30:00'::interval),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_pkey PRIMARY KEY (id),
  CONSTRAINT payment_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT payment_intents_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  provider_payment_id text UNIQUE,
  provider_customer_id text,
  provider_session_id text UNIQUE,
  subscription_id text UNIQUE,
  subscription_status text CHECK (subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'trialing'::text, NULL::text])),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD'::text,
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer DEFAULT (amount_cents - fee_cents),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'disputed'::text, 'expired'::text])),
  failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  webhook_received_at timestamp with time zone,
  chain_id integer,
  contract_address text,
  wallet_address text,
  block_number bigint,
  block_confirmations integer DEFAULT 0,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  refunded_at timestamp with time zone,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT payments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id)
);
CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['stripe'::text, 'paystack'::text, 'web3'::text])),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  verified boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  payment_id uuid,
  idempotency_key text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  payment_id uuid,
  provider text NOT NULL,
  provider_sub_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'trialing'::text])),
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamp with time zone,
  trial_end timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.payment_products(id),
  CONSTRAINT subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);
CREATE TABLE public.ep_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['purchase_grant'::text, 'invite_grant'::text, 'bonus_grant'::text, 'spend'::text, 'refund'::text, 'expiry'::text])),
  reason text NOT NULL,
  ref_payment_id uuid,
  ref_product_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT ep_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT ep_transactions_ref_payment_id_fkey FOREIGN KEY (ref_payment_id) REFERENCES public.payments(id),
  CONSTRAINT ep_transactions_ref_product_id_fkey FOREIGN KEY (ref_product_id) REFERENCES public.payment_products(id)
);
CREATE TABLE public.notification_badge_state (
  user_id uuid NOT NULL,
  badge_cleared_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_badge_state_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_badge_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.support_cases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  user_id uuid,
  user_email text,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text])),
  status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'pending_user'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])),
  category text CHECK (category = ANY (ARRAY['account'::text, 'payment'::text, 'content'::text, 'technical'::text, 'other'::text])),
  assigned_to_id uuid,
  assigned_to_name text,
  assigned_by_id uuid,
  assigned_by_name text,
  assigned_at timestamp with time zone,
  solved_by_id uuid,
  solved_by_name text,
  solved_at timestamp with time zone,
  notes jsonb DEFAULT '[]'::jsonb,
  resolution_note text,
  escalated_to_id uuid,
  escalated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_cases_pkey PRIMARY KEY (id),
  CONSTRAINT support_cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT support_cases_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.profiles(id),
  CONSTRAINT support_cases_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public.profiles(id),
  CONSTRAINT support_cases_solved_by_id_fkey FOREIGN KEY (solved_by_id) REFERENCES public.profiles(id),
  CONSTRAINT support_cases_escalated_to_id_fkey FOREIGN KEY (escalated_to_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.platform_freeze (
  region text NOT NULL,
  is_frozen boolean DEFAULT false,
  frozen_by uuid,
  frozen_reason text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_freeze_pkey PRIMARY KEY (region),
  CONSTRAINT platform_freeze_frozen_by_fkey FOREIGN KEY (frozen_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.blocked_ips (
  ip text NOT NULL,
  reason text,
  blocked_by uuid,
  blocked_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT blocked_ips_pkey PRIMARY KEY (ip),
  CONSTRAINT blocked_ips_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.push_notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  body text NOT NULL,
  target_type text DEFAULT 'all'::text CHECK (target_type = ANY (ARRAY['all'::text, 'vip'::text, 'pro'::text, 'region'::text, 'specific'::text])),
  target_ids ARRAY DEFAULT '{}'::text[],
  type text DEFAULT 'info'::text,
  sent_by uuid,
  sent_by_name text,
  reach integer DEFAULT 0,
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT push_notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid,
  admin_name text,
  admin_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text,
  category text DEFAULT 'other'::text,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting'::text, 'resolved'::text, 'closed'::text, 'deleted'::text])),
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  assigned_to uuid,
  assigned_to_name text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolve_note text,
  closed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_staff boolean DEFAULT false,
  is_internal boolean DEFAULT false,
  staff_name text,
  created_at timestamp with time zone DEFAULT now(),
  xa_id integer,
  CONSTRAINT support_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id),
  CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.staking_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  duration_days integer NOT NULL CHECK (duration_days = ANY (ARRAY[30, 90, 180, 365])),
  rate_pct numeric NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'matured'::text, 'withdrawn'::text, 'cancelled'::text])),
  est_return numeric NOT NULL DEFAULT 0,
  matures_at timestamp with time zone NOT NULL,
  withdrawn_at timestamp with time zone,
  actual_return numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staking_positions_pkey PRIMARY KEY (id),
  CONSTRAINT staking_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.savings_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_type text NOT NULL CHECK (plan_type = ANY (ARRAY['goal'::text, 'lock'::text, 'flex'::text])),
  plan_name text NOT NULL,
  goal_name text,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  balance numeric NOT NULL DEFAULT 0,
  rate_pct numeric NOT NULL,
  lock_days integer DEFAULT 0,
  matures_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  interest_earned numeric NOT NULL DEFAULT 0,
  last_interest_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT savings_plans_pkey PRIMARY KEY (id),
  CONSTRAINT savings_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_type text NOT NULL CHECK (card_type = ANY (ARRAY['virtual'::text, 'external'::text])),
  card_name text NOT NULL,
  last_four text NOT NULL CHECK (char_length(last_four) = 4),
  brand text NOT NULL CHECK (brand = ANY (ARRAY['Visa'::text, 'Mastercard'::text, 'Verve'::text])),
  expiry text NOT NULL,
  bank_name text,
  balance numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_cards_pkey PRIMARY KEY (id),
  CONSTRAINT user_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.scholarship_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier = ANY (ARRAY['quarter'::text, 'half'::text, 'full'::text])),
  tier_name text NOT NULL,
  pct integer NOT NULL CHECK (pct = ANY (ARRAY[25, 50, 100])),
  full_name text NOT NULL,
  institution text NOT NULL,
  course text NOT NULL,
  level text NOT NULL,
  cgpa text NOT NULL,
  tuition_amount numeric NOT NULL,
  scholarship_amt numeric,
  semester text,
  school_email text,
  evidence_ref text NOT NULL,
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'disbursed'::text])),
  reviewer_id uuid,
  reviewer_note text,
  reviewed_at timestamp with time zone,
  disbursed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scholarship_applications_pkey PRIMARY KEY (id),
  CONSTRAINT scholarship_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT scholarship_applications_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_recovery_phrases (
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
CREATE TABLE public.xrc_records (
  record_id uuid NOT NULL DEFAULT gen_random_uuid(),
  stream_type text NOT NULL CHECK (stream_type = ANY (ARRAY['XTRC'::text, 'XERC'::text, 'XARC'::text, 'XCRC'::text, 'XPRC'::text, 'XSRC'::text, 'XWRC'::text])),
  previous_hash text NOT NULL,
  record_hash text NOT NULL UNIQUE,
  actor_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  timestamp bigint NOT NULL,
  signature text,
  version smallint NOT NULL DEFAULT 2,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT xrc_records_pkey PRIMARY KEY (record_id)
);
CREATE TABLE public.xrc_root_chain (
  stream_type text NOT NULL CHECK (stream_type = ANY (ARRAY['XTRC'::text, 'XERC'::text, 'XARC'::text, 'XCRC'::text, 'XPRC'::text, 'XSRC'::text, 'XWRC'::text])),
  current_head_hash text NOT NULL,
  last_record_id uuid,
  record_count bigint NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT xrc_root_chain_pkey PRIMARY KEY (stream_type),
  CONSTRAINT xrc_root_chain_last_record_id_fkey FOREIGN KEY (last_record_id) REFERENCES public.xrc_records(record_id)
);
CREATE TABLE public.waitlist_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invite_code_id uuid NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  notes text,
  CONSTRAINT waitlist_entries_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT waitlist_entries_invite_code_id_fkey FOREIGN KEY (invite_code_id) REFERENCES public.invite_codes(id),
  CONSTRAINT waitlist_entries_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.comment_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid,
  reporter_id uuid,
  reason text DEFAULT 'spam'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_reports_pkey PRIMARY KEY (id),
  CONSTRAINT comment_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.gift_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tier text NOT NULL CHECK (tier = ANY (ARRAY['silver'::text, 'gold'::text, 'blue_diamond'::text, 'red_diamond'::text, 'black_diamond'::text, 'purple_diamond'::text])),
  value_ep integer NOT NULL CHECK (value_ep > 0),
  price_usd numeric NOT NULL CHECK (price_usd > 0::numeric),
  fee_ep integer NOT NULL DEFAULT 0,
  net_ep integer NOT NULL,
  sender_id uuid,
  recipient_id uuid,
  occasion text,
  message text,
  status text NOT NULL DEFAULT 'unused'::text CHECK (status = ANY (ARRAY['unused'::text, 'sent'::text, 'redeemed'::text, 'expired'::text])),
  redeemed_by uuid,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT gift_cards_pkey PRIMARY KEY (id),
  CONSTRAINT gift_cards_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id),
  CONSTRAINT gift_cards_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id),
  CONSTRAINT gift_cards_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.daily_task_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  completed_at date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  CONSTRAINT daily_task_completions_pkey PRIMARY KEY (id),
  CONSTRAINT daily_task_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profile_boosts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  boost_tier text NOT NULL CHECK (boost_tier = ANY (ARRAY['silver'::text, 'gold'::text, 'diamond'::text])),
  billing text NOT NULL CHECK (billing = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  price_usd numeric NOT NULL,
  ep_bonus_pct integer NOT NULL DEFAULT 0,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text])),
  payment_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  auto_renew boolean NOT NULL DEFAULT false,
  ep_cost integer NOT NULL DEFAULT 0,
  next_renewal_at timestamp with time zone,
  is_system_grant boolean NOT NULL DEFAULT false,
  grant_reason text,
  active_theme_id text,
  theme_selections jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT profile_boosts_pkey PRIMARY KEY (id),
  CONSTRAINT profile_boosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_boosts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);
CREATE TABLE public.reward_pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  week_end date NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  silver_pool numeric NOT NULL DEFAULT 0,
  gold_pool numeric NOT NULL DEFAULT 0,
  diamond_pool numeric NOT NULL DEFAULT 0,
  silver_users integer NOT NULL DEFAULT 0,
  gold_users integer NOT NULL DEFAULT 0,
  diamond_users integer NOT NULL DEFAULT 0,
  silver_share numeric NOT NULL DEFAULT 0,
  gold_share numeric NOT NULL DEFAULT 0,
  diamond_share numeric NOT NULL DEFAULT 0,
  distributed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reward_pools_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reward_level_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_level text NOT NULL DEFAULT 'none'::text,
  new_level text NOT NULL,
  reason text,
  criteria_met jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reward_level_history_pkey PRIMARY KEY (id),
  CONSTRAINT reward_level_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  category text NOT NULL DEFAULT 'General'::text,
  mode text NOT NULL DEFAULT 'video'::text CHECK (mode = ANY (ARRAY['video'::text, 'audio'::text])),
  quality_preset text NOT NULL DEFAULT 'high'::text,
  is_private boolean NOT NULL DEFAULT false,
  is_recording boolean NOT NULL DEFAULT false,
  livekit_room text UNIQUE,
  livekit_token text,
  cf_stream_uid text,
  cf_playback_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'live'::text, 'ended'::text, 'failed'::text])),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  peak_viewers integer NOT NULL DEFAULT 0,
  total_likes integer NOT NULL DEFAULT 0,
  last_heartbeat timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT live_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.stream_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  minutes_used integer NOT NULL CHECK (minutes_used >= 0),
  was_recording boolean NOT NULL DEFAULT false,
  peak_viewers integer NOT NULL DEFAULT 0,
  ep_earned numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stream_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT stream_usage_logs_session_fk FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT stream_usage_logs_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.stream_viewers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stream_viewers_pkey PRIMARY KEY (id),
  CONSTRAINT stream_viewers_session_fk FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT stream_viewers_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.stream_tier_limits (
  tier text NOT NULL,
  minutes_per_month integer NOT NULL DEFAULT 60,
  can_record boolean NOT NULL DEFAULT false,
  max_quality text NOT NULL DEFAULT 'medium'::text,
  CONSTRAINT stream_tier_limits_pkey PRIMARY KEY (tier)
);
CREATE TABLE public.boost_ep_prices (
  tier text NOT NULL,
  billing text NOT NULL,
  ep_cost integer NOT NULL,
  ep_bonus_pct integer NOT NULL DEFAULT 0,
  usd_equiv numeric NOT NULL DEFAULT 0,
  CONSTRAINT boost_ep_prices_pkey PRIMARY KEY (tier, billing)
);
CREATE TABLE public.status_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  text text,
  bg text,
  text_color text DEFAULT '#ffffff'::text,
  image_id text,
  duration_h integer NOT NULL DEFAULT 24,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24:00:00'::interval),
  media_type text DEFAULT 'text'::text,
  CONSTRAINT status_updates_pkey PRIMARY KEY (id),
  CONSTRAINT status_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.status_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT status_likes_pkey PRIMARY KEY (id),
  CONSTRAINT status_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT status_likes_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status_updates(id)
);
CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['audio'::text, 'video'::text, 'group'::text, 'group-video'::text])),
  status text NOT NULL CHECK (status = ANY (ARRAY['missed'::text, 'answered'::text, 'declined'::text])),
  duration_secs integer DEFAULT 0,
  quality text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_logs_pkey PRIMARY KEY (id),
  CONSTRAINT call_logs_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.profiles(id),
  CONSTRAINT call_logs_callee_id_fkey FOREIGN KEY (callee_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wallet_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chain text NOT NULL CHECK (chain = ANY (ARRAY['evm'::text, 'cardano'::text, 'solana'::text, 'tron'::text])),
  address text NOT NULL,
  public_key text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.news_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  source_name text NOT NULL,
  source_url text NOT NULL,
  article_url text NOT NULL,
  category text NOT NULL DEFAULT 'global'::text CHECK (category = ANY (ARRAY['global'::text, 'africa'::text, 'crypto'::text, 'agriculture'::text])),
  region text,
  asset_tag text,
  url_hash text NOT NULL UNIQUE,
  published_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  source_logo text,
  read_time_min integer,
  CONSTRAINT news_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.news_fetch_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  articles_found integer NOT NULL DEFAULT 0,
  articles_inserted integer NOT NULL DEFAULT 0,
  error_message text,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  source_url text,
  duration_ms integer,
  CONSTRAINT news_fetch_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.news_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  news_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT news_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT news_bookmarks_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_posts(id)
);
CREATE TABLE public.news_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  news_id uuid NOT NULL,
  reaction text NOT NULL DEFAULT 'like'::text CHECK (reaction = ANY (ARRAY['like'::text, 'fire'::text, 'sad'::text, 'wow'::text, 'angry'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT news_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT news_reactions_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_posts(id)
);
CREATE TABLE public.news_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  content text NOT NULL CHECK (char_length(TRIM(BOTH FROM content)) > 0 AND char_length(content) <= 1000),
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT news_comments_pkey PRIMARY KEY (id),
  CONSTRAINT news_comments_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_posts(id),
  CONSTRAINT news_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT news_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.news_comments(id)
);
CREATE TABLE public.news_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  user_id uuid,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_views_pkey PRIMARY KEY (id),
  CONSTRAINT news_views_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_posts(id),
  CONSTRAINT news_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.group_chats (
  id text NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '👥'::text,
  created_by uuid,
  member_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  icon_url text,
  CONSTRAINT group_chats_pkey PRIMARY KEY (id),
  CONSTRAINT group_chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.active_calls (
  id text NOT NULL,
  caller_id uuid,
  callee_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  call_type text DEFAULT 'audio'::text,
  group_name text,
  status text DEFAULT 'ringing'::text,
  created_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT active_calls_pkey PRIMARY KEY (id),
  CONSTRAINT active_calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ep_treasury (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partition text NOT NULL UNIQUE CHECK (partition = ANY (ARRAY['operations'::text, 'growth'::text, 'xev_rewards'::text, 'reserve'::text, 'unallocated'::text])),
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0::numeric),
  total_received numeric NOT NULL DEFAULT 0,
  total_disbursed numeric NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_treasury_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ep_treasury_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  protocol_fee_pct numeric NOT NULL DEFAULT 20 CHECK (protocol_fee_pct >= 0::numeric AND protocol_fee_pct <= 100::numeric),
  operations_pct numeric NOT NULL DEFAULT 30 CHECK (operations_pct >= 0::numeric),
  growth_pct numeric NOT NULL DEFAULT 30 CHECK (growth_pct >= 0::numeric),
  xev_rewards_pct numeric NOT NULL DEFAULT 30 CHECK (xev_rewards_pct >= 0::numeric),
  reserve_pct numeric NOT NULL DEFAULT 10 CHECK (reserve_pct >= 0::numeric),
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ep_treasury_config_pkey PRIMARY KEY (id),
  CONSTRAINT ep_treasury_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);