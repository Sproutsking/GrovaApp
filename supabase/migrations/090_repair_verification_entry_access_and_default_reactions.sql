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
        )
    )
$$;

alter function public.community_user_can_open_verification_panel(uuid, uuid, uuid) owner to postgres;
revoke all on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) from public;
grant execute on function public.community_user_can_open_verification_panel(uuid, uuid, uuid) to authenticated;

drop policy if exists community_channels_effective_role_read on public.community_channels;
create policy community_channels_effective_role_read
  on public.community_channels for select to authenticated
  using (
    public.community_user_can_access_channel(community_id, auth.uid(), id, 'view')
    or public.community_user_can_open_verification_panel(community_id, auth.uid(), id)
  );

drop policy if exists community_channels_effective_role_access on public.community_channels;
create policy community_channels_effective_role_access
  on public.community_channels as restrictive for select to authenticated
  using (
    public.community_user_can_access_channel(community_id, auth.uid(), id, 'view')
    or public.community_user_can_open_verification_panel(community_id, auth.uid(), id)
  );

drop policy if exists community_messages_effective_role_read on public.community_messages;
create policy community_messages_effective_role_read
  on public.community_messages for select to authenticated
  using (
    public.community_user_can_access_channel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(),
      community_messages.channel_id,
      'view'
    )
    or public.community_user_can_open_verification_panel(
      (select ch.community_id from public.community_channels ch where ch.id = community_messages.channel_id),
      auth.uid(),
      community_messages.channel_id
    )
  );

drop policy if exists community_messages_effective_role_access on public.community_messages;
create policy community_messages_effective_role_access
  on public.community_messages as restrictive for select to authenticated
  using (
    exists (
      select 1
      from public.community_channels ch
      where ch.id = community_messages.channel_id
        and (
          public.community_user_can_access_channel(ch.community_id, auth.uid(), ch.id, 'view')
          or public.community_user_can_open_verification_panel(ch.community_id, auth.uid(), ch.id)
        )
    )
  );

-- Novice defaults are read-only but must retain the ability to react. The
-- trigger affects inserts only; owners can still change the permission later.
update public.community_roles
set permissions = jsonb_set(coalesce(permissions, '{}'::jsonb), '{addReactions}', 'true'::jsonb, true),
    updated_at = now()
where is_default = true
  and lower(trim(name)) in ('novis', 'novice')
  and permissions -> 'addReactions' is distinct from 'true'::jsonb;

create or replace function public.ensure_default_novice_reaction_permission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default and lower(trim(new.name)) in ('novis', 'novice') then
    new.permissions := jsonb_set(
      coalesce(new.permissions, '{}'::jsonb),
      '{addReactions}',
      'true'::jsonb,
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists community_default_novice_reactions on public.community_roles;
create trigger community_default_novice_reactions
  before insert on public.community_roles
  for each row execute function public.ensure_default_novice_reaction_permission();
