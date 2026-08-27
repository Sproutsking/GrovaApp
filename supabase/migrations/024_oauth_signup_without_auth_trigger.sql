-- OAuth must be allowed to create auth.users independently of the public
-- profile schema. Profile setup happens through bootstrap_oauth_profile after
-- the client has received a valid authenticated session.

create or replace function public.bootstrap_oauth_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_username text,
  p_avatar_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_username text;
  fallback_username text;
  suffix text;
  profile_row public.profiles%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized profile bootstrap';
  end if;

  safe_username := left(lower(regexp_replace(coalesce(p_username, ''), '[^a-zA-Z0-9_]+', '_', 'g')), 24);
  safe_username := trim(both '_' from safe_username);
  if char_length(safe_username) < 3 then
    safe_username := 'user_' || substr(replace(p_user_id::text, '-', ''), 1, 8);
  end if;

  begin
    insert into public.profiles (id, email, full_name, username, avatar_metadata)
    values (
      p_user_id,
      coalesce(nullif(trim(p_email), ''), p_user_id::text || '@users.xeevia.local'),
      left(coalesce(nullif(trim(p_full_name), ''), 'Xeevia User'), 120),
      safe_username,
      coalesce(p_avatar_metadata, '{}'::jsonb)
    )
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
          avatar_metadata = case
            when public.profiles.avatar_metadata is null
              or public.profiles.avatar_metadata = '{}'::jsonb
              then excluded.avatar_metadata
            else public.profiles.avatar_metadata
          end,
          updated_at = now()
    returning * into profile_row;
  exception when unique_violation then
    suffix := substr(replace(p_user_id::text, '-', ''), 1, 8);
    fallback_username := left(safe_username, 21) || '_' || suffix;
    insert into public.profiles (id, email, full_name, username, avatar_metadata)
    values (
      p_user_id,
      coalesce(nullif(trim(p_email), ''), p_user_id::text || '@users.xeevia.local'),
      left(coalesce(nullif(trim(p_full_name), ''), 'Xeevia User'), 120),
      fallback_username,
      coalesce(p_avatar_metadata, '{}'::jsonb)
    )
    on conflict (id) do update
      set updated_at = now()
    returning * into profile_row;
  end;

  return to_jsonb(profile_row);
end;
$$;

revoke all on function public.bootstrap_oauth_profile(uuid, text, text, text, jsonb) from public;
grant execute on function public.bootstrap_oauth_profile(uuid, text, text, text, jsonb) to authenticated;

-- Remove legacy auth triggers that can roll back the auth.users insert.
do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_name);
  end loop;
end
$$;