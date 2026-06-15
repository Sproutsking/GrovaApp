-- Supabase migration: identity core tables
-- Run in Supabase SQL editor or migration pipeline

-- Profiles: canonical source of truth
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text,
  username text UNIQUE,
  bio text,
  profile_picture_url text,
  email text,
  social_links jsonb DEFAULT '{}'::jsonb,
  sync_preferences jsonb DEFAULT '{}'::jsonb,
  identity_version_timestamp timestamptz DEFAULT now(),
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Connections: per-provider connected accounts
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  platform_user_id text NOT NULL,
  auth_status text DEFAULT 'active', -- active / expired / revoked
  permissions jsonb DEFAULT '[]'::jsonb,
  last_sync_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, platform_user_id)
);

-- Tokens: encrypted token storage (ciphertext stored)
CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  token_type text,
  encrypted_token bytea,
  expires_at timestamptz,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Sync jobs: queue of pending syncs
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  change_set jsonb,
  target_connection_id uuid,
  status text DEFAULT 'pending', -- pending,running,success,failed,manual_required
  attempts int DEFAULT 0,
  last_error text,
  scheduled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Sync logs and deep links
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid REFERENCES sync_jobs(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections(id) ON DELETE SET NULL,
  platform text,
  action text,
  result jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deep_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  platform text,
  instructions jsonb,
  link_url text,
  created_at timestamptz DEFAULT now()
);
