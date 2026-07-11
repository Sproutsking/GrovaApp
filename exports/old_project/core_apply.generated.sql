-- Core schema bundle (apply this in the Core Supabase project SQL editor)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- From schema_core_v2.sql
-- CORE Project Schema
-- Tables: 52 total (32 with data)

CREATE TABLE IF NOT EXISTS public.card_posts (
  id UUID,
  user_id UUID,
  caption VARCHAR(255),
  category VARCHAR(255),
  likes BIGINT,
  comments_count BIGINT,
  shares BIGINT,
  views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable,
  card_text TEXT -- nullable,
  card_gradient VARCHAR(255),
  card_text_color VARCHAR(255),
  card_edge_style VARCHAR(255),
  card_align VARCHAR(255),
  card_template TEXT -- nullable,
  full_name VARCHAR(255),
  username VARCHAR(255),
  avatar_id VARCHAR(255),
  verified BOOLEAN
);

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

CREATE TABLE IF NOT EXISTS public.culture_categories (
  id UUID,
  name TIMESTAMP WITH TIME ZONE,
  emoji VARCHAR(255),
  slug VARCHAR(255),
  description VARCHAR(255),
  icon_url TEXT -- nullable,
  region VARCHAR(255),
  order_index BIGINT,
  is_active BOOLEAN,
  engagement_score BIGINT,
  total_posts BIGINT,
  total_views BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.deleted_messages (
  id UUID,
  message_id UUID,
  user_id UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID,
  group_id VARCHAR(255),
  user_id UUID,
  content VARCHAR(255),
  reply_to_id TEXT -- nullable,
  reactions JSONB,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  deleted_at TEXT -- nullable
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

CREATE TABLE IF NOT EXISTS public.news_fetch_log (
  id UUID,
  source_name TIMESTAMP WITH TIME ZONE,
  articles_found BIGINT,
  articles_inserted BIGINT,
  error_message TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE,
  source_url TEXT -- nullable,
  duration_ms TEXT -- nullable
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

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID,
  ticket_id UUID,
  user_id UUID,
  content TIMESTAMP WITH TIME ZONE,
  is_staff BOOLEAN,
  is_internal BOOLEAN,
  staff_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  xa_id BIGINT
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID,
  user_id UUID,
  subject TIMESTAMP WITH TIME ZONE,
  description TIMESTAMP WITH TIME ZONE,
  category VARCHAR(255),
  status VARCHAR(255),
  priority VARCHAR(255),
  assigned_to TEXT -- nullable,
  assigned_to_name TEXT -- nullable,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolve_note TEXT -- nullable,
  closed_at TEXT -- nullable,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- From schema_core_production.sql
CREATE TABLE IF NOT EXISTS public.active_calls (
  id text NOT NULL,
  caller_id uuid,
  callee_ids text[] NOT NULL DEFAULT '{}'::text[],
  call_type text DEFAULT 'audio'::text,
  group_name text,
  status text DEFAULT 'ringing'::text,
  created_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT active_calls_pkey PRIMARY KEY (id),
  CONSTRAINT active_calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.profiles(id)
);

-- CALLS & REAL-TIME
CREATE TABLE IF NOT EXISTS public.call_logs (
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

-- SOCIAL GRAPH & CONTENT DISCOVERY
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.story_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT story_likes_pkey PRIMARY KEY (id),
  CONSTRAINT story_likes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id),
  CONSTRAINT story_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Generated from schema_definitions.json for ambassador_earnings
CREATE TABLE IF NOT EXISTS ambassador_earnings (
  id uuid DEFAULT gen_random_uuid(),
  ambassador_id uuid,
  amount numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  ref_referral_id uuid,
  payout_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (ambassador_id) REFERENCES ambassador_profiles(id),
  FOREIGN KEY (ref_referral_id) REFERENCES ambassador_referrals(id)
);

-- Generated from schema_definitions.json for ambassador_payouts
CREATE TABLE IF NOT EXISTS ambassador_payouts (
  id uuid DEFAULT gen_random_uuid(),
  ambassador_id uuid,
  amount numeric NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  payout_info jsonb NOT NULL,
  reject_reason text,
  requested_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (ambassador_id) REFERENCES ambassador_profiles(id)
);

-- Generated from schema_definitions.json for ambassador_referrals
CREATE TABLE IF NOT EXISTS ambassador_referrals (
  id uuid DEFAULT gen_random_uuid(),
  ambassador_id uuid,
  referred_user_id uuid,
  payment_id uuid,
  revenue_amount numeric DEFAULT 0 NOT NULL,
  commission_amount numeric DEFAULT 0 NOT NULL,
  commission_pct numeric DEFAULT 8 NOT NULL,
  status text DEFAULT 'confirmed' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (ambassador_id) REFERENCES ambassador_profiles(id),
  FOREIGN KEY (referred_user_id) REFERENCES profiles(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- Generated from schema_definitions.json for comment_reports
CREATE TABLE IF NOT EXISTS comment_reports (
  id uuid DEFAULT gen_random_uuid(),
  comment_id uuid,
  reporter_id uuid,
  reason text DEFAULT 'spam',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (comment_id) REFERENCES comments(id),
  FOREIGN KEY (reporter_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for culture_content
CREATE TABLE IF NOT EXISTS culture_content (
  id uuid DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid,
  category_id uuid,
  user_id uuid,
  engagement_boost numeric DEFAULT 1.0,
  featured boolean DEFAULT false,
  featured_at timestamptz,
  featured_by uuid,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES culture_categories(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (featured_by) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for culture_creator_profiles
CREATE TABLE IF NOT EXISTS culture_creator_profiles (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  primary_category_id uuid,
  expertise_categories text,
  bio_culture text,
  verified_cultural_expert boolean DEFAULT false,
  monthly_posts int DEFAULT 0,
  total_cultural_views int DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  follower_milestone_250 boolean DEFAULT false,
  follower_milestone_1000 boolean DEFAULT false,
  follower_milestone_10000 boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (primary_category_id) REFERENCES culture_categories(id)
);

-- Generated from schema_definitions.json for culture_engagement
CREATE TABLE IF NOT EXISTS culture_engagement (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  content_id uuid,
  category_id uuid,
  action text NOT NULL,
  weight numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (category_id) REFERENCES culture_categories(id)
);

-- Generated from schema_definitions.json for culture_popular_this_week
CREATE TABLE IF NOT EXISTS culture_popular_this_week (
  id uuid,
  content_type text,
  content_id uuid,
  category_name text,
  emoji text,
  engagement_count bigint,
  likes bigint,
  views bigint,
  shares bigint,
  featured boolean,
  created_at timestamptz,
  PRIMARY KEY (id)
);

-- Generated from schema_definitions.json for culture_trending
CREATE TABLE IF NOT EXISTS culture_trending (
  id uuid DEFAULT gen_random_uuid(),
  category_id uuid,
  content_type text NOT NULL,
  content_id uuid,
  rank int,
  score numeric NOT NULL,
  period text DEFAULT 'week',
  calculated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES culture_categories(id)
);

-- Generated from schema_definitions.json for daily_task_completions
CREATE TABLE IF NOT EXISTS daily_task_completions (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  task_id text NOT NULL,
  completed_at date DEFAULT 'CURRENT_DATE' NOT NULL,
  count int DEFAULT 1 NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for distribution_queue
CREATE TABLE IF NOT EXISTS distribution_queue (
  id uuid DEFAULT gen_random_uuid(),
  post_id uuid,
  user_id uuid,
  selected_platforms text,
  scheduled_for timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_details jsonb,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for group_chats
CREATE TABLE IF NOT EXISTS group_chats (
  id text NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '👥',
  created_by uuid,
  member_ids text NOT NULL,
  members jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  icon_url text,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for hidden_conversations
CREATE TABLE IF NOT EXISTS hidden_conversations (
  id uuid DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_id uuid,
  hidden_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for invite_code_usage
CREATE TABLE IF NOT EXISTS invite_code_usage (
  id uuid DEFAULT gen_random_uuid(),
  invite_code_id uuid,
  code text NOT NULL,
  used_by uuid,
  used_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  PRIMARY KEY (id),
  FOREIGN KEY (invite_code_id) REFERENCES invite_codes(id),
  FOREIGN KEY (used_by) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for invite_codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid DEFAULT gen_random_uuid(),
  code text NOT NULL,
  type text DEFAULT 'standard' NOT NULL,
  max_uses int DEFAULT 100,
  uses_count int DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  status text DEFAULT 'active',
  metadata jsonb,
  community_id uuid,
  community_name text,
  price_override numeric,
  entry_price numeric DEFAULT 1.0,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES profiles(id),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

-- Generated from schema_definitions.json for message_reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid DEFAULT gen_random_uuid(),
  message_id uuid,
  user_id uuid,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for news_bookmarks
CREATE TABLE IF NOT EXISTS news_bookmarks (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  news_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (news_id) REFERENCES news_posts(id)
);

-- Generated from schema_definitions.json for news_comments
CREATE TABLE IF NOT EXISTS news_comments (
  id uuid DEFAULT gen_random_uuid(),
  news_id uuid,
  user_id uuid,
  parent_id uuid,
  content text NOT NULL,
  likes int DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  PRIMARY KEY (id),
  FOREIGN KEY (news_id) REFERENCES news_posts(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (parent_id) REFERENCES news_comments(id)
);

-- Generated from schema_definitions.json for news_reactions
CREATE TABLE IF NOT EXISTS news_reactions (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  news_id uuid,
  reaction text DEFAULT 'like' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (news_id) REFERENCES news_posts(id)
);

-- Generated from schema_definitions.json for news_views
CREATE TABLE IF NOT EXISTS news_views (
  id uuid DEFAULT gen_random_uuid(),
  news_id uuid,
  user_id uuid,
  viewed_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (news_id) REFERENCES news_posts(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for platform_distribution_preferences
CREATE TABLE IF NOT EXISTS platform_distribution_preferences (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  platform_preferences jsonb,
  global_default_enabled boolean DEFAULT true,
  auto_retry boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for post_distribution
CREATE TABLE IF NOT EXISTS post_distribution (
  id uuid DEFAULT gen_random_uuid(),
  post_id uuid,
  user_id uuid,
  platform text NOT NULL,
  external_post_id text,
  status text DEFAULT 'pending',
  published_at timestamptz,
  error_message text,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for reels_backup
CREATE TABLE IF NOT EXISTS reels_backup (
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
  duration int,
  likes int,
  comments_count int,
  shares int,
  views int,
  created_at timestamptz,
  deleted_at timestamptz
);

-- Generated from schema_definitions.json for reward_level_history
CREATE TABLE IF NOT EXISTS reward_level_history (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  old_level text DEFAULT 'none' NOT NULL,
  new_level text NOT NULL,
  reason text,
  criteria_met jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for scholarship_applications
CREATE TABLE IF NOT EXISTS scholarship_applications (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  tier text NOT NULL,
  tier_name text NOT NULL,
  pct int NOT NULL,
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
  status text DEFAULT 'pending' NOT NULL,
  reviewer_id uuid,
  reviewer_note text,
  reviewed_at timestamptz,
  disbursed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (reviewer_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for stories_backup
CREATE TABLE IF NOT EXISTS stories_backup (
  id uuid,
  user_id uuid,
  title text,
  preview text,
  full_content text,
  cover_image text,
  cover_image_id text,
  cover_image_metadata jsonb,
  category text,
  unlock_cost int,
  max_accesses int,
  current_accesses int,
  likes int,
  comments_count int,
  views int,
  created_at timestamptz,
  deleted_at timestamptz
);

-- Generated from schema_definitions.json for stream_tier_limits
CREATE TABLE IF NOT EXISTS stream_tier_limits (
  tier text NOT NULL,
  minutes_per_month int DEFAULT 60 NOT NULL,
  can_record boolean DEFAULT false NOT NULL,
  max_quality text DEFAULT 'medium' NOT NULL,
  PRIMARY KEY (tier)
);

-- Generated from schema_definitions.json for stream_usage_logs
CREATE TABLE IF NOT EXISTS stream_usage_logs (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id uuid,
  minutes_used int NOT NULL,
  was_recording boolean DEFAULT false NOT NULL,
  peak_viewers int DEFAULT 0 NOT NULL,
  ep_earned numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (session_id) REFERENCES live_sessions(id)
);

-- Generated from schema_definitions.json for stream_viewers
CREATE TABLE IF NOT EXISTS stream_viewers (
  id uuid DEFAULT gen_random_uuid(),
  session_id uuid,
  user_id uuid,
  joined_at timestamptz DEFAULT now() NOT NULL,
  last_seen timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (session_id) REFERENCES live_sessions(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for support_cases
CREATE TABLE IF NOT EXISTS support_cases (
  id uuid DEFAULT extensions.uuid_generate_v4(),
  title text NOT NULL,
  description text,
  user_id uuid,
  user_email text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  category text,
  assigned_to_id uuid,
  assigned_to_name text,
  assigned_by_id uuid,
  assigned_by_name text,
  assigned_at timestamptz,
  solved_by_id uuid,
  solved_by_name text,
  solved_at timestamptz,
  notes jsonb,
  resolution_note text,
  escalated_to_id uuid,
  escalated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (assigned_to_id) REFERENCES profiles(id),
  FOREIGN KEY (assigned_by_id) REFERENCES profiles(id),
  FOREIGN KEY (solved_by_id) REFERENCES profiles(id),
  FOREIGN KEY (escalated_to_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for unlocked_stories
CREATE TABLE IF NOT EXISTS unlocked_stories (
  id uuid DEFAULT gen_random_uuid(),
  story_id uuid,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for upload_rate_limits
CREATE TABLE IF NOT EXISTS upload_rate_limits (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  upload_type text NOT NULL,
  upload_count int DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for user_culture_alignment
CREATE TABLE IF NOT EXISTS user_culture_alignment (
  user_id uuid,
  category_id uuid,
  name text,
  total_engagements bigint,
  likes bigint,
  saves bigint,
  PRIMARY KEY (category_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for user_culture_preferences
CREATE TABLE IF NOT EXISTS user_culture_preferences (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  categories text NOT NULL,
  region_focus text DEFAULT 'africa',
  discover_trending boolean DEFAULT true,
  personalization_score numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for waitlist_entries
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  invite_code_id uuid,
  email text,
  status text DEFAULT 'pending' NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid,
  notes text,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (invite_code_id) REFERENCES invite_codes(id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id)
);

-- Generated from schema_definitions.json for xrc_records
CREATE TABLE IF NOT EXISTS xrc_records (
  record_id uuid DEFAULT gen_random_uuid(),
  stream_type text NOT NULL,
  previous_hash text NOT NULL,
  record_hash text NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL,
  timestamp bigint NOT NULL,
  signature text,
  version smallint DEFAULT 2 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (record_id)
);

-- Generated from schema_definitions.json for xrc_root_chain
CREATE TABLE IF NOT EXISTS xrc_root_chain (
  stream_type text NOT NULL,
  current_head_hash text NOT NULL,
  last_record_id uuid,
  record_count bigint DEFAULT 0 NOT NULL,
  last_updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (stream_type),
  FOREIGN KEY (last_record_id) REFERENCES xrc_records(record_id)
);

-- Generated from schema_definitions.json for xrc_stream_heads
CREATE TABLE IF NOT EXISTS xrc_stream_heads (
  stream_type text,
  current_head_hash text,
  last_record_id uuid,
  record_count bigint,
  last_updated_at timestamptz,
  actor_id uuid,
  last_payload jsonb,
  last_timestamp bigint,
  PRIMARY KEY (stream_type),
  FOREIGN KEY (last_record_id) REFERENCES xrc_records(record_id)
);

