create or replace function public.community_user_can_open_verification_panel(
  p_community_id uuid,
  p_user_id uuid,
  p_channel_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id = auth.uid()
    and exists (
      select 1
      from public.community_members m
      join public.community_channels ch
        on ch.community_id = m.community_id
       and ch.id = p_channel_id
       and ch.deleted_at is null
      join public.community_tool_settings settings
        on settings.community_id = m.community_id
       and settings.tool_type = 'verification'
       and settings.enabled = true
      where m.community_id = p_community_id
        and m.user_id = p_user_id
        and (
          settings.channel_id = p_channel_id
          or coalesce(settings.config -> 'channel_ids', '[]'::jsonb)
            @> jsonb_build_array(p_channel_id::text)
          or (
            coalesce((settings.config -> 'rulesGate' ->> 'enabled')::boolean, false)
            and coalesce(
              settings.config -> 'rulesGate' ->> 'rulesChannelId',
              settings.config ->> 'rulesChannelId',
              settings.config -> 'rules' ->> 'rulesChannelId'
            ) = p_channel_id::text
          )
          or (
            coalesce((settings.config -> 'rulesGate' ->> 'enabled')::boolean, false)
            and settings.config -> 'rulesGate' ->> 'flow' = 'rules_then_verify'
            and coalesce(
              settings.config -> 'rulesGate' ->> 'verificationChannelId',
              settings.config ->> 'verificationChannelId',
              settings.config -> 'rules' ->> 'verificationChannelId'
            ) = p_channel_id::text
            and exists (
              select 1
              from public.community_verification_completions completion
              where completion.community_id = p_community_id
                and completion.user_id = p_user_id
                and completion.method = 'rules'
                and completion.status in ('rules_accepted', 'completed')
            )
          )
        )
    )
$$;

alter function public.community_user_can_open_verification_panel(uuid, uuid, uuid) owner to postgres;
revoke all on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) from public;
grant execute on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) to authenticated;

drop policy if exists "Members can view published community tool panels"
  on public.community_tool_panel_posts;

create policy "Members can view published community tool panels"
  on public.community_tool_panel_posts
  for select
  to authenticated
  using (
    public.community_user_can_access_channel(
      community_id,
      auth.uid(),
      channel_id,
      'view'
    )
    or (
      tool_type in ('verification', 'rules')
      and public.community_user_can_open_verification_panel(
        community_id,
        auth.uid(),
        channel_id
      )
    )
  );