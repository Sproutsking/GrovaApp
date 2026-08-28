// src/components/Boost/BoostThemePicker.jsx
// ============================================================================
// BoostThemePicker — lets boosted users pick their profile design theme.
// Silver: polished chrome options.
// Gold:   warm metallic options.
// Diamond: prismatic options.
//
// Props:
//   tier       — 'silver' | 'gold' | 'diamond'
//   activeId   — currently selected theme id
//   userId     — for saving via RPC
//   onPicked   — (themeId) => void  (called after successful save)
// ============================================================================

import React, { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import { THEMES_BY_TIER, SHARED_KEYFRAMES, BOOST_NAME_FONTS, BOOST_NAME_COLORS } from "../../services/boost/boostThemes";
import boostService from "../../services/boost/boostService";

const BoostThemePicker = ({ tier, activeId, activeFontId, activeColorId, userId, onPicked }) => {
  const [fontId, setFontId] = useState(activeFontId ?? BOOST_NAME_FONTS[tier]?.[0]?.id);
  const [colorId, setColorId] = useState(activeColorId ?? BOOST_NAME_COLORS[tier]?.[0]?.id);
  const [selected, setSelected] = useState(activeId ?? null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const themes = THEMES_BY_TIER[tier] ?? [];
  const fonts = BOOST_NAME_FONTS[tier] ?? [];
  const colors = BOOST_NAME_COLORS[tier] ?? [];

  const saveNameDesign = async (nextFontId = fontId, nextColorId = colorId) => {
    setFontId(nextFontId); setColorId(nextColorId); setSaving(true);
    try {
      const result = await boostService.updateBoostNameDesign(userId, nextFontId, nextColorId);
      if (!result?.success) throw new Error(result?.error || "Design could not be saved");
      setSaved(true);
      onPicked?.({ fontId: nextFontId, colorId: nextColorId });
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSaved(false);
      setFontId(activeFontId ?? BOOST_NAME_FONTS[tier]?.[0]?.id);
      setColorId(activeColorId ?? BOOST_NAME_COLORS[tier]?.[0]?.id);
      console.warn("[BoostThemePicker] name design save failed:", error?.message);
    } finally { setSaving(false); }
  };

  if (!tier || themes.length === 0) return null;

  const handlePick = async (themeId) => {
    if (themeId === selected) return;
    setSelected(themeId);
    setSaved(false);

    if (!userId) return;
    setSaving(true);
    try {
      await supabase.rpc("update_boost_theme", {
        p_user_id: userId,
        p_theme_id: themeId,
      });
      setSaved(true);
      onPicked?.(themeId);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const tierMeta = {
    silver:  { color:"#c0c0c0", label:"Silver Design" },
    gold:    { color:"#fbbf24", label:"Gold Design" },
    diamond: { color:"#a78bfa", label:"Diamond Design" },
  }[tier] ?? { color:"#fff", label:"Design" };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAMES }} />

      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#525252", textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:10, display:"flex", alignItems:"center", gap:6,
        }}>
          <Sparkles size={11} color={tierMeta.color} />
          {tierMeta.label}
          {saving && <span style={{ color:tierMeta.color, fontSize:10 }}>Saving…</span>}
          {saved  && <span style={{ color:"#22c55e",     fontSize:10 }}>✓ Saved</span>}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {themes.map(theme => {
            const isActive = selected === theme.id || (!selected && themes[0]?.id === theme.id);
            return (
              <button
                key={theme.id}
                onClick={() => handlePick(theme.id)}
                disabled={saving}
                style={{
                  display:"flex", alignItems:"center", gap:14,
                  padding:"14px 16px", borderRadius:16, border:"none",
                  background: isActive
                    ? `${tierMeta.color}12`
                    : "rgba(255,255,255,0.03)",
                  outline: isActive
                    ? `2px solid ${tierMeta.color}45`
                    : "1px solid rgba(255,255,255,0.07)",
                  outlineOffset: 0,
                  cursor: saving ? "default" : "pointer",
                  transition:"all 0.22s",
                  textAlign:"left",
                  position:"relative", overflow:"hidden",
                }}
              >
                {/* Preview swatch */}
                <div style={{
                  width:54, height:54, borderRadius:14, flexShrink:0,
                  background: theme.preview,
                  border: isActive ? `2px solid ${tierMeta.color}60` : "1px solid rgba(255,255,255,0.1)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:24,
                  boxShadow: isActive ? `0 0 16px ${tierMeta.color}40` : "none",
                  transition:"box-shadow 0.3s, border-color 0.3s",
                }}>
                  {theme.emoji}
                </div>

                {/* Text */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontSize:14, fontWeight:900,
                    color: isActive ? tierMeta.color : "rgba(255,255,255,0.85)",
                    marginBottom:3, transition:"color 0.2s",
                  }}>
                    {theme.name}
                  </div>
                  <div style={{ fontSize:11, color:"#525252", fontWeight:500 }}>
                    {theme.tagline}
                  </div>
                </div>

                {/* Selected check */}
                {isActive && (
                  <div style={{
                    width:22, height:22, borderRadius:"50%", flexShrink:0,
                    background:`${tierMeta.color}20`, border:`1.5px solid ${tierMeta.color}55`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:`0 0 10px ${tierMeta.color}50`,
                  }}>
                    <Check size={11} color={tierMeta.color} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:10, color:tierMeta.color, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Name font · {fonts.length} unlocked</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:6 }}>
            {fonts.map((font) => <button key={font.id} disabled={saving} onClick={() => saveNameDesign(font.id, colorId)} style={{ padding:"10px 8px", borderRadius:10, border:fontId===font.id ? `1px solid ${tierMeta.color}` : "1px solid rgba(255,255,255,.08)", background:fontId===font.id ? `${tierMeta.color}18` : "rgba(255,255,255,.03)", color:"#fff", fontFamily:font.family, fontSize:14, cursor:"pointer" }}>{font.label}</button>)}
          </div>
          <div style={{ fontSize:10, color:tierMeta.color, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", margin:"14px 0 8px" }}>Name color · {colors.length} unlocked</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {colors.map((color) => <button key={color.id} aria-label={color.label} title={color.label} disabled={saving} onClick={() => saveNameDesign(fontId, color.id)} style={{ width:28, height:28, borderRadius:"50%", border:colorId===color.id ? "2px solid #fff" : "1px solid rgba(255,255,255,.25)", background:color.color, boxShadow:`0 0 12px ${color.shadow}`, cursor:"pointer" }} />)}
          </div>
        </div>
      </div>
    </>
  );
};

export default BoostThemePicker;