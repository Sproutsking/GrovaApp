-- Persist tier-gated boost theme selection and keep profile cache in sync.
create or replace function public.update_boost_theme(
  p_user_id uuid,
  p_theme_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  boost_row public.profile_boosts%rowtype;
  allowed_themes text[];
  next_selections jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select * into boost_row
  from public.profile_boosts
  where user_id = p_user_id
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'No active boost');
  end if;

  if boost_row.boost_tier = 'silver' then
    allowed_themes := array[
      'silver-chrome',
      'silver-mercury',
      'silver-eclipse'
    ];
  elsif boost_row.boost_tier = 'gold' then
    allowed_themes := array[
      'gold-dynasty',
      'gold-solar',
      'gold-corona',
      'gold-laurel',
      'gold-molten'
    ];
  elsif boost_row.boost_tier = 'diamond' then
    allowed_themes := array[
      'diamond-cosmos',
      'diamond-glacier',
      'diamond-emerald',
      'diamond-rose',
      'diamond-void',
      'diamond-brilliant',
      'diamond-nebula',
      'diamond-shard',
      'diamond-prism',
      'diamond-quantum',
      'diamond-bloom',
      'diamond-rift'
    ];
  else
    return jsonb_build_object('success', false, 'error', 'Unsupported boost tier');
  end if;

  if not (p_theme_id = any(allowed_themes)) then
    return jsonb_build_object('success', false, 'error', 'Theme is not available for this boost tier');
  end if;

  next_selections := coalesce(boost_row.theme_selections, '{}'::jsonb)
    || jsonb_build_object('themeId', p_theme_id);

  update public.profile_boosts
  set active_theme_id = p_theme_id,
      theme_selections = next_selections,
      updated_at = now()
  where id = boost_row.id;

  update public.profiles
  set subscription_tier = boost_row.boost_tier,
      boost_selections = coalesce(boost_selections, '{}'::jsonb)
        || jsonb_build_object(
          'themeId', p_theme_id,
          'fontId', coalesce((next_selections->>'fontId'), (boost_selections->>'fontId')),
          'colorId', coalesce((next_selections->>'colorId'), (boost_selections->>'colorId')),
          'backgroundColorId', coalesce((next_selections->>'backgroundColorId'), (boost_selections->>'backgroundColorId'))
        ),
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'themeId', p_theme_id);
end;
$$;

revoke all on function public.update_boost_theme(uuid, text) from public;
grant execute on function public.update_boost_theme(uuid, text) to authenticated;
