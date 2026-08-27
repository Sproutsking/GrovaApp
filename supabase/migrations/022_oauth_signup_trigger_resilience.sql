-- Do not let profile initialization failures abort OAuth user creation.
-- A profile can be repaired by the authenticated client after the session is
-- established, but auth.users must be allowed to finish inserting first.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate_username text;
  candidate_full_name text;
  candidate_email text;
  provider_avatar_url text;
  provider_name text;
  provider_metadata jsonb;
begin
  candidate_email := coalesce(new.email, new.id::text || '@users.xeevia.local');
  candidate_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Xeevia User'
  )), '');
  candidate_full_name := left(coalesce(candidate_full_name, 'Xeevia User'), 120);

  base_username := lower(regexp_replace(coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ), '[^a-zA-Z0-9_]+', '_', 'g'));
  base_username := trim(both '_' from base_username);
  if char_length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := left(base_username, 24);

  provider_avatar_url := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    new.raw_user_meta_data->>'profile_image_url',
    ''
  )), '');
  provider_name := nullif(trim(coalesce(
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'provider',
    'oauth'
  )), '');
  provider_metadata := case
    when provider_avatar_url is null then '{}'::jsonb
    else jsonb_build_object(
      'url', provider_avatar_url,
      'publicUrl', provider_avatar_url,
      'provider', coalesce(provider_name, 'oauth'),
      'source', 'oauth'
    )
  end;

  begin
    candidate_username := base_username;
    insert into public.profiles (id, email, full_name, username, avatar_metadata)
    values (new.id, candidate_email, candidate_full_name, candidate_username, provider_metadata)
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
          avatar_metadata = case
            when public.profiles.avatar_metadata is null
              or public.profiles.avatar_metadata = '{}'::jsonb
              then excluded.avatar_metadata
            else public.profiles.avatar_metadata
          end,
          updated_at = now();
  exception when unique_violation then
    begin
      candidate_username := left(base_username, 20) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
      insert into public.profiles (id, email, full_name, username, avatar_metadata)
      values (new.id, candidate_email, candidate_full_name, candidate_username, provider_metadata)
      on conflict (id) do update
        set email = excluded.email,
            full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
            avatar_metadata = case
              when public.profiles.avatar_metadata is null
                or public.profiles.avatar_metadata = '{}'::jsonb
                then excluded.avatar_metadata
              else public.profiles.avatar_metadata
            end,
            updated_at = now();
    exception when others then
      raise warning 'handle_new_user profile initialization skipped for %: %', new.id, sqlerrm;
    end;
  when others then
    raise warning 'handle_new_user profile initialization skipped for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;