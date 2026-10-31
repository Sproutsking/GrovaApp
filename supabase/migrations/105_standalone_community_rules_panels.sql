create or replace function public.publish_community_rules_panel(
  p_community_id uuid,
  p_channel_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.community_tool_settings;
  rules_items jsonb;
  panel_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before publishing community rules';
  end if;
  if not public.community_user_can_manage_channel_permissions(p_community_id, auth.uid()) then
    raise exception 'You need community management access to publish community rules';
  end if;
  if not exists (
    select 1
    from public.community_channels
    where id = p_channel_id
      and community_id = p_community_id
      and deleted_at is null
      and type <> 'voice'
  ) then
    raise exception 'Choose an active text channel in this community';
  end if;

  select * into settings_row
  from public.community_tool_settings
  where community_id = p_community_id
    and tool_type = 'verification';
  if not found or not coalesce(settings_row.enabled, false) then
    raise exception 'Save the community rules before publishing';
  end if;
  if not coalesce((settings_row.config ->> 'rulesPanelEnabled')::boolean, false)
    or settings_row.config ->> 'rulesPanelChannelId' is distinct from p_channel_id::text then
    raise exception 'Save this channel as the community rules destination before publishing';
  end if;

  rules_items := coalesce(settings_row.config -> 'rulesPanel' -> 'items', '[]'::jsonb);
  if jsonb_typeof(rules_items) <> 'array' then
    raise exception 'Add at least one community rule before publishing';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(rules_items) as item(value)
    where nullif(trim(item.value ->> 'title'), '') is not null
  ) then
    raise exception 'Add at least one community rule before publishing';
  end if;

  insert into public.community_tool_panel_posts (
    community_id, channel_id, tool_type, published_by
  ) values (
    p_community_id, p_channel_id, 'rules', auth.uid()
  )
  on conflict (channel_id, tool_type) do update
    set published_by = excluded.published_by,
        updated_at = now()
  returning id into panel_id;

  return panel_id;
end;
$$;

alter function public.publish_community_rules_panel(uuid, uuid) owner to postgres;
revoke all on function public.publish_community_rules_panel(uuid, uuid) from public;
grant execute on function public.publish_community_rules_panel(uuid, uuid) to authenticated;
