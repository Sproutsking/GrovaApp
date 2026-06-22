-- ════════════════════════════════════════════════════════════════════════════
-- CULTURE FEATURE SQL SCHEMA
-- Support for Africa-first + World culture discovery system
-- ════════════════════════════════════════════════════════════════════════════

-- [1] Culture Categories Table
-- Stores all culture categories with metadata for discovery
CREATE TABLE IF NOT EXISTS public.culture_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  emoji text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon_url text,
  region text NOT NULL CHECK (region = ANY(ARRAY['africa','world','trending'])),
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  engagement_score numeric DEFAULT 0,
  total_posts integer DEFAULT 0,
  total_views integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT culture_categories_pkey PRIMARY KEY (id)
);

-- [2] Culture Content Mapping
-- Maps posts, reels, stories to culture categories
CREATE TABLE IF NOT EXISTS public.culture_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type = ANY(ARRAY['post','reel','story'])),
  content_id uuid NOT NULL,
  category_id uuid NOT NULL,
  user_id uuid NOT NULL,
  engagement_boost numeric DEFAULT 1.0,
  featured boolean DEFAULT false,
  featured_at timestamp with time zone,
  featured_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT culture_content_pkey PRIMARY KEY (id),
  CONSTRAINT culture_content_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.culture_categories(id),
  CONSTRAINT culture_content_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT culture_content_featured_by_fkey FOREIGN KEY (featured_by) REFERENCES public.profiles(id),
  CONSTRAINT culture_content_unique UNIQUE (content_type, content_id, category_id)
);

-- [3] Culture Content Engagement
-- Track interactions on culture content
CREATE TABLE IF NOT EXISTS public.culture_engagement (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid NOT NULL,
  category_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY(ARRAY['view','like','share','save','comment'])),
  weight numeric DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT culture_engagement_pkey PRIMARY KEY (id),
  CONSTRAINT culture_engagement_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT culture_engagement_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.culture_categories(id)
);

-- [4] User Culture Preferences
-- Track which culture categories a user is interested in
CREATE TABLE IF NOT EXISTS public.user_culture_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
    categories uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  region_focus text DEFAULT 'africa' CHECK (region_focus = ANY(ARRAY['africa','world','both'])),
  discover_trending boolean DEFAULT true,
  personalization_score numeric DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT user_culture_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_culture_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- [5] Culture Trending/Popular Content
-- Cached view of trending content in each category
CREATE TABLE IF NOT EXISTS public.culture_trending (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  rank integer,
  score numeric NOT NULL,
  period text DEFAULT 'week' CHECK (period = ANY(ARRAY['today','week','month','all-time'])),
  calculated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT culture_trending_pkey PRIMARY KEY (id),
  CONSTRAINT culture_trending_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.culture_categories(id)
);

-- [6] Creator Culture Profiles
-- Enhanced profiles for culture creators
CREATE TABLE IF NOT EXISTS public.culture_creator_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  primary_category_id uuid,
    expertise_categories uuid[] DEFAULT ARRAY[]::uuid[],
  bio_culture text,
  verified_cultural_expert boolean DEFAULT false,
  monthly_posts integer DEFAULT 0,
  total_cultural_views integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  follower_milestone_250 boolean DEFAULT false,
  follower_milestone_1000 boolean DEFAULT false,
  follower_milestone_10000 boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT culture_creator_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT culture_creator_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT culture_creator_profiles_primary_category_id_fkey FOREIGN KEY (primary_category_id) REFERENCES public.culture_categories(id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_culture_content_category_id ON public.culture_content(category_id);
CREATE INDEX IF NOT EXISTS idx_culture_content_user_id ON public.culture_content(user_id);
CREATE INDEX IF NOT EXISTS idx_culture_content_featured ON public.culture_content(featured, featured_at DESC);
CREATE INDEX IF NOT EXISTS idx_culture_engagement_user_id ON public.culture_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_culture_engagement_category_id ON public.culture_engagement(category_id);
CREATE INDEX IF NOT EXISTS idx_culture_engagement_action ON public.culture_engagement(action);
CREATE INDEX IF NOT EXISTS idx_culture_trending_category_period ON public.culture_trending(category_id, period, score DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA - AFRICA & WORLD CULTURE CATEGORIES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.culture_categories (name, emoji, slug, description, region, order_index)
VALUES
  ('Afro Music', '🎵', 'afro-music', 'African music, rhythms, and sound traditions', 'africa', 1),
  ('African Art', '🎨', 'african-art', 'Contemporary and traditional African visual arts', 'africa', 2),
  ('West Africa', '🌍', 'west-africa', 'Cultures and content from West African nations', 'africa', 3),
  ('East Africa', '🦁', 'east-africa', 'Cultures and traditions from East Africa', 'africa', 4),
  ('South Africa', '🇿🇦', 'south-africa', 'South African culture and heritage', 'africa', 5),
  ('North Africa', '🏜️', 'north-africa', 'Maghreb and North African cultures', 'africa', 6),
  ('African Cuisine', '🍲', 'african-food', 'African cooking, recipes, and food traditions', 'africa', 7),
  ('African Fashion', '👗', 'african-fashion', 'African clothing, textiles, and style', 'africa', 8),
  ('Festivals', '🎉', 'african-festivals', 'African celebrations, events, and festivals', 'africa', 9),
  ('History & Heritage', '📚', 'african-history', 'African history, heritage, and stories', 'africa', 10),
  ('Languages', '💬', 'african-languages', 'African languages, dialects, and linguistics', 'africa', 11),
  ('Spirituality', '✨', 'african-spirituality', 'African spirituality, beliefs, and practices', 'africa', 12),
  ('Asian Culture', '🏮', 'asian-culture', 'Asian traditions, arts, and heritage', 'world', 13),
  ('European Culture', '🏰', 'european-culture', 'European traditions and cultural heritage', 'world', 14),
  ('Americas Culture', '🗽', 'americas-culture', 'North and South American cultures', 'world', 15),
  ('Middle East', '🕌', 'middle-east', 'Middle Eastern traditions and heritage', 'world', 16),
  ('Indigenous', '🌿', 'indigenous', 'Indigenous peoples and cultures worldwide', 'world', 17),
  ('World Music', '🎸', 'world-music', 'Global music traditions and sounds', 'world', 18),
  ('Global Food', '🍜', 'global-food', 'World cuisine and food traditions', 'world', 19),
  ('Trending', '🔥', 'trending', 'Currently trending cultural content', 'trending', 0)
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- ENABLE ROW-LEVEL SECURITY (Optional but recommended)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.culture_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_culture_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_trending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY culture_categories_public ON public.culture_categories
  FOR SELECT USING (true);

CREATE POLICY culture_content_public ON public.culture_content
  FOR SELECT USING (true);

CREATE POLICY culture_engagement_insert ON public.culture_engagement
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY culture_engagement_public ON public.culture_engagement
  FOR SELECT USING (true);

CREATE POLICY user_culture_preferences_own ON public.user_culture_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY culture_creator_profiles_public ON public.culture_creator_profiles
  FOR SELECT USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- USEFUL VIEWS FOR DISCOVERY
-- ════════════════════════════════════════════════════════════════════════════

-- View: Popular culture content this week
CREATE OR REPLACE VIEW public.culture_popular_this_week AS
SELECT
  cc.id,
  cc.content_type,
  cc.content_id,
  c.name as category_name,
  c.emoji,
  COUNT(DISTINCT ce.user_id) as engagement_count,
  COUNT(CASE WHEN ce.action = 'like' THEN 1 END) as likes,
  COUNT(CASE WHEN ce.action = 'view' THEN 1 END) as views,
  COUNT(CASE WHEN ce.action = 'share' THEN 1 END) as shares,
  cc.featured,
  cc.created_at
FROM public.culture_content cc
LEFT JOIN public.culture_engagement ce ON cc.content_id = ce.content_id
LEFT JOIN public.culture_categories c ON cc.category_id = c.id
WHERE cc.created_at >= NOW() - INTERVAL '7 days'
GROUP BY cc.id, cc.content_type, cc.content_id, c.name, c.emoji, cc.featured, cc.created_at
ORDER BY engagement_count DESC;

-- View: User culture interest alignment
CREATE OR REPLACE VIEW public.user_culture_alignment AS
SELECT
  ucp.user_id,
  c.id as category_id,
  c.name,
  COUNT(DISTINCT ce.id) as total_engagements,
  COUNT(CASE WHEN ce.action = 'like' THEN 1 END) as likes,
  COUNT(CASE WHEN ce.action = 'save' THEN 1 END) as saves
FROM public.user_culture_preferences ucp
CROSS JOIN public.culture_categories c
LEFT JOIN public.culture_engagement ce ON ce.user_id = ucp.user_id AND ce.category_id = c.id
GROUP BY ucp.user_id, c.id, c.name;
