// src/components/Boost/BoostThemePicker.jsx
// ============================================================================
// BoostThemePicker — lets boosted users pick their profile design theme.
// Silver: 1 theme (shown as "active", no picker needed).
// Gold:   2 themes to choose from.
// Diamond: 5 themes to choose from.
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
import { THEMES_BY_TIER, SHARED_KEYFRAMES } from "../../services/boost/boostThemes";

const BoostThemePicker = ({ tier, activeId, userId, onPicked }) => {
  const [selected, setSelected] = useState(activeId ?? null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const themes = THEMES_BY_TIER[tier] ?? [];

  // Silver only has 1 — just show it active, no picker
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

  if (themes.length === 1) {
    // Silver — just show the single active theme as a confirmation pill
    const t = themes[0];
    return (
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"8px 14px", borderRadius:12,
        background:`${tierMeta.color}12`,
        border:`1px solid ${tierMeta.color}30`,
      }}>
        <span style={{ fontSize:16 }}>{t.emoji}</span>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:tierMeta.color }}>{t.name}</div>
          <div style={{ fontSize:10, color:"#525252" }}>{t.tagline}</div>
        </div>
        <div style={{ marginLeft:"auto", width:18, height:18, borderRadius:"50%",
          background:`${tierMeta.color}25`, border:`1px solid ${tierMeta.color}50`,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <Check size={10} color={tierMeta.color} />
        </div>
      </div>
    );
  }

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
      </div>
    </>
  );
};

export default BoostThemePicker;