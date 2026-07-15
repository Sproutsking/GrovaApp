-- Supabase migration: evidence graph tables
-- Creates normalized evidence items and edges for connector-sourced data.

CREATE TABLE IF NOT EXISTS evidence_items (
  id text PRIMARY KEY,
  provider text NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections(id) ON DELETE SET NULL,
  evidence_type text NOT NULL,
  entity_type text NOT NULL,
  external_id text,
  title text,
  summary text,
  description text,
  url text,
  source text NOT NULL DEFAULT 'connector',
  verified boolean DEFAULT false,
  confidence text DEFAULT 'medium',
  metadata jsonb DEFAULT '{}'::jsonb,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_profile_id ON evidence_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_connection_id ON evidence_items(connection_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_provider ON evidence_items(provider);
CREATE INDEX IF NOT EXISTS idx_evidence_items_evidence_type ON evidence_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_items_external_id ON evidence_items(external_id);

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read evidence items by profile" ON evidence_items;
CREATE POLICY "Public can read evidence items by profile"
  ON evidence_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role may modify evidence items" ON evidence_items;
CREATE POLICY "Service role may modify evidence items"
  ON evidence_items
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS evidence_edges (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  target_id text NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'related_to',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_edges_source_id ON evidence_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_edges_target_id ON evidence_edges(target_id);

ALTER TABLE evidence_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read evidence edges" ON evidence_edges;
CREATE POLICY "Public can read evidence edges"
  ON evidence_edges
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role may modify evidence edges" ON evidence_edges;
CREATE POLICY "Service role may modify evidence edges"
  ON evidence_edges
  FOR ALL
  USING (auth.role() = 'service_role');
