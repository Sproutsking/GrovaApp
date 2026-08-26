-- Keep auth signup independent from payment/PaywallGate state.
-- This trigger must never require payment fields or activation flags.

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
  suffix integer := 0;
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
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ), '[^a-zA-Z0-9_]+', '_', 'g'));
  base_username := trim(both '_' from base_username);
  if char_length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := left(base_username, 24);
  candidate_username := base_username;

  loop
    begin
      insert into public.profiles (id, email, full_name, username)
      values (new.id, candidate_email, candidate_full_name, candidate_username)
      on conflict (id) do update
        set email = excluded.email,
            full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
            updated_at = now();
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      candidate_username := left(base_username, 30 - char_length(suffix::text) - 1)
        || '_' || suffix::text;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    drop trigger on_auth_user_created on auth.users;
  end if;

  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
end
$$;
