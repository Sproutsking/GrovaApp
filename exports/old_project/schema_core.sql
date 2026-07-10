-- Schema for core project

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

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID,
  comment_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID,
  post_id UUID,
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

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id UUID,
  reel_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.status_likes (
  id UUID,
  status_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID,
  message_id UUID,
  user_id UUID,
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID,
  user1_id UUID,
  user2_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID,
  community_id UUID,
  user_id UUID,
  role_id UUID,
  joined_at TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
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

CREATE TABLE IF NOT EXISTS public.saved_content (
  id UUID,
  user_id UUID,
  content_type VARCHAR(255),
  content_id UUID,
  folder VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE
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

