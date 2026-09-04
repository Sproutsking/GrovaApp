-- Persist tier-gated profile background color selections.
create or replace function public.update_boost_background_color(
  p_user_id uuid,
  p_background_color_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  boost_row public.profile_boosts%rowtype;
  allowed_colors text[];
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
    allowed_colors := array['silver-pearl', 'silver-steel', 'silver-ice'];
  elsif boost_row.boost_tier = 'gold' then
    allowed_colors := array['gold-sun', 'gold-amber', 'gold-flame', 'gold-rose', 'gold-mint', 'gold-sky'];
  elsif boost_row.boost_tier = 'diamond' then
    allowed_colors := array['diamond-prism', 'diamond-cosmos', 'diamond-glacier', 'diamond-emerald', 'diamond-rose', 'diamond-void'];
  else
    return jsonb_build_object('success', false, 'error', 'Unsupported boost tier');
  end if;

  if not (p_background_color_id = any(allowed_colors)) then
    return jsonb_build_object('success', false, 'error', 'Background color is not available for this boost tier');
  end if;

  next_selections := coalesce(boost_row.theme_selections, '{}'::jsonb)
    || jsonb_build_object('backgroundColorId', p_background_color_id);

  update public.profile_boosts
  set theme_selections = next_selections,
      updated_at = now()
  where id = boost_row.id;

  update public.profiles
  set subscription_tier = boost_row.boost_tier,
      boost_selections = coalesce(boost_selections, '{}'::jsonb)
        || jsonb_build_object(
          'themeId', boost_row.active_theme_id,
          'backgroundColorId', p_background_color_id
        ),
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'backgroundColorId', p_background_color_id);
end;
$$;

revoke all on function public.update_boost_background_color(uuid, text) from public;
grant execute on function public.update_boost_background_color(uuid, text) to authenticated;
