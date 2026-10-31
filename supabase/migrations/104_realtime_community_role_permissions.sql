alter table public.community_roles
  add column if not exists permission_revision bigint not null default 0;

create or replace function public.bump_community_role_permission_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) - 'updated_at') is not distinct from (to_jsonb(new) - 'updated_at') then
      return null;
    end if;
    if old.role_id is distinct from new.role_id then
      update public.community_roles
      set permission_revision = permission_revision + 1
      where id = old.role_id;
    end if;
    update public.community_roles
    set permission_revision = permission_revision + 1
    where id = new.role_id;
  elsif tg_op = 'DELETE' then
    update public.community_roles
    set permission_revision = permission_revision + 1
    where id = old.role_id;
  else
    update public.community_roles
    set permission_revision = permission_revision + 1
    where id = new.role_id;
  end if;

  return null;
end;
$$;

alter function public.bump_community_role_permission_revision() owner to postgres;
revoke all on function public.bump_community_role_permission_revision() from public;

create or replace function public.bump_community_role_revision_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.community_roles
  set permission_revision = permission_revision + 1
  where id = old.id;
  return old;
end;
$$;

alter function public.bump_community_role_revision_before_delete() owner to postgres;
revoke all on function public.bump_community_role_revision_before_delete() from public;

drop trigger if exists community_roles_bump_revision_before_delete on public.community_roles;
create trigger community_roles_bump_revision_before_delete
  before delete on public.community_roles
  for each row execute function public.bump_community_role_revision_before_delete();

drop trigger if exists community_access_rules_bump_role_revision on public.community_access_rules;
create trigger community_access_rules_bump_role_revision
  after insert or update or delete on public.community_access_rules
  for each row execute function public.bump_community_role_permission_revision();

drop trigger if exists channel_permission_overrides_bump_role_revision on public.channel_permission_overrides;
create trigger channel_permission_overrides_bump_role_revision
  after insert or update or delete on public.channel_permission_overrides
  for each row execute function public.bump_community_role_permission_revision();

drop trigger if exists category_permission_overrides_bump_role_revision on public.category_permission_overrides;
create trigger category_permission_overrides_bump_role_revision
  after insert or update or delete on public.category_permission_overrides
  for each row execute function public.bump_community_role_permission_revision();

drop trigger if exists community_member_roles_bump_role_revision on public.community_member_roles;
create trigger community_member_roles_bump_role_revision
  after delete on public.community_member_roles
  for each row execute function public.bump_community_role_permission_revision();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'community_roles'
    ) then
    alter publication supabase_realtime add table public.community_roles;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'community_member_roles'
    ) then
    alter publication supabase_realtime add table public.community_member_roles;
  end if;
end;
$$;
