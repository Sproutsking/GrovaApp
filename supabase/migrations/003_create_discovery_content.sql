-- Supabase migration: discovery_content table
-- Live curated discovery feed backed by real data
-- Run in Supabase SQL editor or migration pipeline

CREATE TABLE IF NOT EXISTS discovery_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content metadata
  title text NOT NULL,
  category text NOT NULL, -- Must match DISCOVERY_CATEGORIES
  mood text, -- calm, intense, motivational, night, curious, cinematic, eerie, wonder
  caption text,
  
  -- Media URLs
  video_url text NOT NULL, -- Primary video source (verified working)
  thumbnail_url text, -- Poster image
  duration int DEFAULT 20, -- Video duration in seconds
  
  -- Engagement
  engagement_score int DEFAULT 70,
  view_count int DEFAULT 0,
  tags jsonb DEFAULT '[]'::jsonb,
  
  -- Source attribution
  source text DEFAULT 'Xeevia', -- Pexels, Unsplash, YouTube, etc.
  source_id text, -- External platform ID if applicable
  photographer text, -- Creator/photographer name
  
  -- Lifecycle
  active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Indexes
  CONSTRAINT category_valid CHECK (category IN (
    'Horror & Strange', 'Bioluminescence', 'Deep Sea', 'Aurora',
    'Volcano', 'Predator', 'Cyclone', 'Wildlife', 'Birds', 'Caves',
    'Space & Earth', 'Fungi', 'Night Nature', 'Storms', 'Abandoned',
    'Macro Wildlife', 'Mountains', 'Aerial Earth', 'Ocean', 'Jungle',
    'Extreme Nature', 'Survival', 'Desert', 'Waterfalls', 'Snow',
    'Rain', 'Relaxation'
  ))
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_discovery_active_category ON discovery_content(active, category);
CREATE INDEX IF NOT EXISTS idx_discovery_engagement ON discovery_content(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_created ON discovery_content(created_at DESC);

-- RLS policies
ALTER TABLE discovery_content ENABLE ROW LEVEL SECURITY;

-- Public can read active content
DROP POLICY IF EXISTS "Anyone can view active discovery content" ON discovery_content;
CREATE POLICY "Anyone can view active discovery content"
  ON discovery_content
  FOR SELECT
  USING (active = true);

-- Only admins can insert/update/delete
DROP POLICY IF EXISTS "Only admins can manage discovery content" ON discovery_content;
CREATE POLICY "Only admins can manage discovery content"
  ON discovery_content
  FOR ALL
  USING (
    auth.role() = 'service_role' 
    OR (auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true))
  );

-- Seed with a few starter items (optional, for testing)
INSERT INTO discovery_content (title, category, mood, caption, video_url, thumbnail_url, engagement_score, source)
VALUES
  (
    'Aurora Borealis, Iceland',
    'Aurora',
    'wonder',
    'The aurora makes the sky dance with green and blue light.',
    'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    'https://images.unsplash.com/photo-1531326613126-e6dee9b57c0a?w=600&h=900&fit=crop&auto=format&q=80',
    97,
    'Curated'
  ),
  (
    'Deep Ocean Waves',
    'Ocean',
    'calm',
    'The endless rhythm of waves at rest.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=600&h=900&fit=crop&auto=format&q=80',
    85,
    'Curated'
  ),
  (
    'Aurora Storm — Solar Maximum',
    'Aurora',
    'wonder',
    'Rare cosmic event paints the northern sky in unprecedented colors.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://images.unsplash.com/photo-1504681869696-d977e3a8a9d5?w=600&h=900&fit=crop&auto=format&q=80',
    95,
    'Curated'
  )
ON CONFLICT DO NOTHING;
