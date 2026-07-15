-- Migration 007: Add get_session_profile RPC and enforce profiles RLS
-- This migration creates the account enforcement RPC used by AuthContext
-- and ensures authenticated users can access and manage only their own profile.

BEGIN;

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow users to select own profile'
  ) THEN
    CREATE POLICY "Allow users to select own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow users to insert own profile'
  ) THEN
    CREATE POLICY "Allow users to insert own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow users to update own profile'
  ) THEN
    CREATE POLICY "Allow users to update own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_session_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_row public.profiles%ROWTYPE;
BEGIN
  SELECT *
    INTO profile_row
    FROM public.profiles
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROFILE_NOT_FOUND');
  END IF;

  IF profile_row.account_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'error', 'ACCOUNT_SUSPENDED',
      'reason', 'Your account has been suspended.'
    );
  END IF;

  IF profile_row.account_status = 'deleted' OR profile_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'ACCOUNT_DELETED');
  END IF;

  RETURN row_to_json(profile_row)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_profile(uuid) TO anon;

COMMIT;
