-- Restore profile fields used by Account, public profiles, and notifications.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.profile_views') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_views'
      AND policyname = 'profile_views_insert_as_viewer'
  ) THEN
    EXECUTE 'CREATE POLICY profile_views_insert_as_viewer
      ON public.profile_views
      FOR INSERT
      TO authenticated
      WITH CHECK (viewer_id = auth.uid() AND profile_id <> auth.uid())';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';