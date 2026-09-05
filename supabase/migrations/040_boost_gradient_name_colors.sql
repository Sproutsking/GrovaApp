-- Add animated gradient name colors to the tier-gated boost design catalog.
create or replace function public.update_boost_name_design(
  p_user_id uuid,
  p_font_id text,
  p_color_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  boost_row public.profile_boosts%rowtype;
  allowed_fonts text[];
  allowed_colors text[];
  next_selections jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select * into boost_row
  from public.profile_boosts
  where user_id = p_user_id and status = 'active' and expires_at > now()
  order by created_at desc limit 1 for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'No active boost');
  end if;

  if boost_row.boost_tier = 'silver' then
    allowed_fonts := array['silver-classic', 'silver-editorial'];
    allowed_colors := array['silver-pearl', 'silver-steel', 'silver-ice', 'silver-mercury-gradient'];
  elsif boost_row.boost_tier = 'gold' then
    allowed_fonts := array['gold-classic', 'gold-editorial', 'gold-display', 'gold-mono', 'gold-soft'];
    allowed_colors := array['gold-sun', 'gold-amber', 'gold-flame', 'gold-rose', 'gold-mint', 'gold-sky', 'gold-solar-gradient', 'gold-royal-gradient'];
  elsif boost_row.boost_tier = 'diamond' then
    allowed_fonts := array['diamond-classic', 'diamond-editorial', 'diamond-display', 'diamond-mono', 'diamond-soft', 'diamond-serif', 'diamond-tech', 'diamond-hand', 'diamond-luxe', 'diamond-future'];
    allowed_colors := array['diamond-prism', 'diamond-cosmos', 'diamond-glacier', 'diamond-emerald', 'diamond-rose', 'diamond-inferno', 'diamond-aurora', 'diamond-lime', 'diamond-void', 'diamond-royal', 'diamond-aurora-gradient', 'diamond-prism-gradient', 'diamond-nebula-gradient', 'diamond-glacier-gradient', 'diamond-void-gradient'];
  else
    return jsonb_build_object('success', false, 'error', 'Unsupported boost tier');
  end if;

  if not (p_font_id = any(allowed_fonts)) or not (p_color_id = any(allowed_colors)) then
    return jsonb_build_object('success', false, 'error', 'Design is not available for this boost tier');
  end if;

  next_selections := coalesce(boost_row.theme_selections, '{}'::jsonb)
    || jsonb_build_object('fontId', p_font_id, 'colorId', p_color_id);

  update public.profile_boosts
  set theme_selections = next_selections, updated_at = now()
  where id = boost_row.id;

  update public.profiles
  set subscription_tier = boost_row.boost_tier,
      boost_selections = coalesce(boost_selections, '{}'::jsonb)
        || jsonb_build_object('themeId', boost_row.active_theme_id, 'fontId', p_font_id, 'colorId', p_color_id),
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'fontId', p_font_id, 'colorId', p_color_id);
end;
$$;

revoke all on function public.update_boost_name_design(uuid, text, text) from public;
grant execute on function public.update_boost_name_design(uuid, text, text) to authenticated;
