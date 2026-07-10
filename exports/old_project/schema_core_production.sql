-- ============================================================================
-- CORE PROJECT SCHEMA (hhqohlzzpzgkfdeanudw)
-- Content, Posts, Comments, Communities, Messaging, Social Graph
-- ============================================================================

-- REFERENCED BY CORE - needs minimal profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  avatar_id text,
  avatar_metadata jsonb DEFAULT '{}'::jsonb,
  bio text,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- POSTS & CONTENT
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text,
  image_ids text[] DEFAULT '{}'::text[],
  image_metadata jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT 'General'::text,
  likes integer DEFAULT 0 CHECK (likes >= 0),
  comments_count integer DEFAULT 0 CHECK (comments_count >= 0),
  shares integer DEFAULT 0 CHECK (shares >= 0),
  views integer DEFAULT 0 CHECK (views >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  video_ids text[] DEFAULT '{}'::text[],
  video_metadata jsonb DEFAULT '[]'::jsonb,
  is_text_card boolean DEFAULT false,
  text_card_metadata jsonb,
  card_caption text,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.posts_backup (
  id uuid,
  user_id uuid,
  content text,
  images text[],
  image_ids text[],
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

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- STORIES
CREATE TABLE IF NOT EXISTS public.stories (
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

CREATE TABLE IF NOT EXISTS public.story_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT story_likes_pkey PRIMARY KEY (id),
  CONSTRAINT story_likes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id),
  CONSTRAINT story_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- REELS
CREATE TABLE IF NOT EXISTS public.reels (
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

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reel_likes_pkey PRIMARY KEY (id),
  CONSTRAINT reel_likes_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id),
  CONSTRAINT reel_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
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

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- MESSAGING
CREATE TABLE IF NOT EXISTS public.conversations (
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

CREATE TABLE IF NOT EXISTS public.messages (
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

CREATE TABLE IF NOT EXISTS public.message_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_reads_pkey PRIMARY KEY (id),
  CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.deleted_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  deleted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deleted_messages_pkey PRIMARY KEY (id),
  CONSTRAINT deleted_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT deleted_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
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
  CONSTRAINT group_messages_pkey PRIMARY KEY (id),
  CONSTRAINT group_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT group_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.group_messages(id)
);

-- COMMUNITIES
CREATE TABLE IF NOT EXISTS public.communities (
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
  CONSTRAINT communities_pkey PRIMARY KEY (id),
  CONSTRAINT communities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.community_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  color text DEFAULT '#95A5A6'::text,
  position integer DEFAULT 0,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_roles_pkey PRIMARY KEY (id),
  CONSTRAINT community_roles_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id)
);

CREATE TABLE IF NOT EXISTS public.community_members (
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

CREATE TABLE IF NOT EXISTS public.community_channels (
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
  CONSTRAINT community_channels_pkey PRIMARY KEY (id),
  CONSTRAINT community_channels_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id)
);

CREATE TABLE IF NOT EXISTS public.community_messages (
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

CREATE TABLE IF NOT EXISTS public.community_invites (
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

CREATE TABLE IF NOT EXISTS public.saved_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text])),
  content_id uuid NOT NULL,
  folder text DEFAULT 'Favorites'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_content_pkey PRIMARY KEY (id),
  CONSTRAINT saved_content_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- DRAFTS
CREATE TABLE IF NOT EXISTS public.drafts (
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

-- NEWS
CREATE TABLE IF NOT EXISTS public.news_posts (
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

CREATE TABLE IF NOT EXISTS public.news_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  news_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT news_feed_pkey PRIMARY KEY (id),
  CONSTRAINT news_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT news_feed_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_posts(id)
);

CREATE TABLE IF NOT EXISTS public.news_fetch_log (
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

-- DISCOVERY & CATEGORIZED CONTENT
CREATE TABLE IF NOT EXISTS public.discovery_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text])),
  content_id uuid NOT NULL,
  category text NOT NULL,
  trending_score numeric DEFAULT 0,
  featured_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discovery_content_pkey PRIMARY KEY (id)
);

-- AUDIO/MUSIC
CREATE TABLE IF NOT EXISTS public.sounds (
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

-- SUPPORT
CREATE TABLE IF NOT EXISTS public.support_tickets (
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

CREATE TABLE IF NOT EXISTS public.support_messages (
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

-- STATUS UPDATES & LIVE STREAMING
CREATE TABLE IF NOT EXISTS public.status_updates (
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

CREATE TABLE IF NOT EXISTS public.status_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT status_likes_pkey PRIMARY KEY (id),
  CONSTRAINT status_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT status_likes_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status_updates(id)
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
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

CREATE TABLE IF NOT EXISTS public.card_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text,
  image_ids text[] DEFAULT '{}'::text[],
  image_metadata jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT 'General'::text,
  likes integer DEFAULT 0 CHECK (likes >= 0),
  comments_count integer DEFAULT 0 CHECK (comments_count >= 0),
  shares integer DEFAULT 0 CHECK (shares >= 0),
  views integer DEFAULT 0 CHECK (views >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT card_posts_pkey PRIMARY KEY (id),
  CONSTRAINT card_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
