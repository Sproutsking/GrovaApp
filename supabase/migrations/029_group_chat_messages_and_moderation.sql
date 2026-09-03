-- Persistent group chat metadata, messages, and moderation helpers.

CREATE TABLE IF NOT EXISTS public.group_chats (
  id text NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  icon text NOT NULL DEFAULT '👥',
  icon_url text,
  description text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_at timestamp with time zone,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT group_chats_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_group_chats_created_by
  ON public.group_chats(created_by);

CREATE INDEX IF NOT EXISTS idx_group_chats_updated_at
  ON public.group_chats(updated_at DESC);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_chats_member_select ON public.group_chats;
CREATE POLICY group_chats_member_select ON public.group_chats
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid()::text = ANY(member_ids)
  );

DROP POLICY IF EXISTS group_chats_member_insert ON public.group_chats;
CREATE POLICY group_chats_member_insert ON public.group_chats
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS group_chats_owner_update ON public.group_chats;
CREATE POLICY group_chats_owner_update ON public.group_chats
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS group_chats_owner_delete ON public.group_chats;
CREATE POLICY group_chats_owner_delete ON public.group_chats
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id text NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  reply_to_id uuid,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT group_messages_pkey PRIMARY KEY (id),
  CONSTRAINT group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_chats(id) ON DELETE CASCADE,
  CONSTRAINT group_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT group_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.group_messages(id)
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages(group_id, created_at);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_user
  ON public.group_messages(group_id, user_id, created_at);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_messages_member_select ON public.group_messages;
CREATE POLICY group_messages_member_select ON public.group_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_chats g
    WHERE g.id = group_messages.group_id
      AND auth.uid()::text = ANY(g.member_ids)
  ));

DROP POLICY IF EXISTS group_messages_member_insert ON public.group_messages;
CREATE POLICY group_messages_member_insert ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_chats g
    WHERE g.id = group_messages.group_id
      AND auth.uid()::text = ANY(g.member_ids)
  ));

DROP POLICY IF EXISTS group_messages_owner_update ON public.group_messages;
CREATE POLICY group_messages_owner_update ON public.group_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS group_messages_owner_delete ON public.group_messages;
CREATE POLICY group_messages_owner_delete ON public.group_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.group_message_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(trim(reason)) > 0),
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.profiles(id),
  resolution text,
  CONSTRAINT group_message_reports_pkey PRIMARY KEY (id),
  CONSTRAINT group_message_reports_unique UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reports_message
  ON public.group_message_reports(message_id, created_at DESC);

ALTER TABLE public.group_message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_message_reports_member_select ON public.group_message_reports;
CREATE POLICY group_message_reports_member_select ON public.group_message_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_messages gm
      JOIN public.group_chats gc ON gc.id = gm.group_id
      WHERE gm.id = group_message_reports.message_id
        AND auth.uid()::text = ANY(gc.member_ids)
    )
  );

DROP POLICY IF EXISTS group_message_reports_member_insert ON public.group_message_reports;
CREATE POLICY group_message_reports_member_insert ON public.group_message_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.group_messages gm
      JOIN public.group_chats gc ON gc.id = gm.group_id
      WHERE gm.id = group_message_reports.message_id
        AND auth.uid()::text = ANY(gc.member_ids)
    )
  );

DROP POLICY IF EXISTS group_message_reports_owner_update ON public.group_message_reports;
CREATE POLICY group_message_reports_owner_update ON public.group_message_reports
  FOR UPDATE TO authenticated
  USING (resolved_by = auth.uid() OR reporter_id = auth.uid())
  WITH CHECK (resolved_by = auth.uid() OR reporter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.delete_group_message(p_group_id text, p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed integer;
BEGIN
  DELETE FROM public.group_messages
  WHERE id = p_message_id AND group_id = p_group_id AND user_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_group_id text,
  p_member_id uuid,
  p_delete_messages boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE group_row public.group_chats%ROWTYPE;
BEGIN
  SELECT * INTO group_row FROM public.group_chats
  WHERE id = p_group_id AND (created_by = auth.uid() OR auth.uid()::text = ANY(member_ids));
  IF group_row.id IS NULL OR group_row.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the group owner can remove members';
  END IF;

  UPDATE public.group_chats
  SET members = COALESCE((
        SELECT jsonb_agg(member)
        FROM jsonb_array_elements(members) member
        WHERE member->>'id' <> p_member_id::text
      ), '[]'::jsonb),
      member_ids = array_remove(member_ids, p_member_id::text),
      updated_at = now()
  WHERE id = p_group_id;

  IF p_delete_messages THEN
    DELETE FROM public.group_messages WHERE group_id = p_group_id AND user_id = p_member_id;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_group_details(
  p_group_id text,
  p_name text,
  p_icon text DEFAULT NULL,
  p_icon_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.group_chats
  SET name = NULLIF(trim(p_name), ''),
      icon = p_icon,
      icon_url = p_icon_url,
      updated_at = now()
  WHERE id = p_group_id AND created_by = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_group_message(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_group_message(text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_group_member(text, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_group_member(text, uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.update_group_details(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_group_details(text, text, text, text) TO authenticated;