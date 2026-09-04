import React, { useState, useEffect } from "react";
import { PartyPopper, Sparkles, Sun, Waves, Gem, Circle } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

export const WELCOME_CARD_THEMES = [
  { id: "lime-classic",  label: "Lime classic", icon: PartyPopper, bg: "linear-gradient(145deg, rgba(29,45,25,.96), rgba(9,15,11,.98))", border: "rgba(156,255,0,.2)", accent: "#9cff00" },
  { id: "ocean-brief",   label: "Ocean brief",  icon: Waves,        bg: "linear-gradient(145deg, rgba(17,28,40,.97), rgba(8,13,18,.99))", border: "rgba(96,165,250,.22)", accent: "#67e8f9" },
  { id: "sunset-warm",   label: "Sunset warm",  icon: Sun,          bg: "linear-gradient(145deg, rgba(45,28,18,.97), rgba(18,10,7,.99))", border: "rgba(251,146,60,.24)", accent: "#fb923c" },
  { id: "glass-quiet",   label: "Glass quiet",  icon: Circle,       bg: "linear-gradient(145deg, rgba(30,30,34,.9), rgba(14,14,17,.96))", border: "rgba(255,255,255,.14)", accent: "#e5e7eb" },
  { id: "cosmic-bold",   label: "Cosmic bold",  icon: Sparkles,     bg: "linear-gradient(150deg, #1e0a3c 0%, #3b0764 60%, #1a0630 100%)", border: "rgba(236,72,153,.28)", accent: "#ec4899" },
  { id: "diamond-mono",  label: "Diamond mono", icon: Gem,          bg: "linear-gradient(145deg, rgba(20,22,28,.97), rgba(9,10,13,.99))", border: "rgba(167,139,250,.24)", accent: "#a78bfa" },
];

export function getWelcomeTheme(id) {
  return WELCOME_CARD_THEMES.find((t) => t.id === id) || WELCOME_CARD_THEMES[0];
}

export default function WelcomeChannelCard({ community }) {
  const [welcome, setWelcome] = useState({
    title: "Find your people. Make something memorable.",
    description: "Introduce yourself, explore the channels, and join the conversation.",
    themeId: "lime-classic",
  });

  useEffect(() => {
    if (!community?.id) return;
    const fetchWelcome = async () => {
      const { data } = await supabase.from("communities").select("settings").eq("id", community.id).single();
      const wc = data?.settings?.welcome_card;
      if (wc) {
        setWelcome((current) => ({
          title: wc.title || current.title,
          description: wc.description || current.description,
          themeId: wc.themeId || current.themeId,
        }));
      }
    };
    fetchWelcome();
  }, [community?.id]);

  const theme = getWelcomeTheme(welcome.themeId);
  const Icon = theme.icon;

  return (
    <section className="welcome-card" style={{ background: theme.bg, borderColor: theme.border }}>
      <div className="welcome-mark" style={{ color: theme.accent, background: `${theme.accent}1f`, borderColor: `${theme.accent}48` }}>
        <Icon size={22} />
      </div>
      <div>
        <span style={{ color: theme.accent }}>Welcome to {community?.name || "the community"}</span>
        <h1>{welcome.title}</h1>
        <p>{welcome.description}</p>
      </div>
      <style>{`
        .welcome-card { display: flex; gap: 15px; align-items: flex-start; max-width: 720px; margin: 26px auto; padding: 22px; border-radius: 18px; border: 1px solid; box-shadow: 0 18px 52px rgba(0, 0, 0, 0.28); }
        .welcome-mark { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid; flex-shrink: 0; }
        .welcome-card span { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .welcome-card h1 { margin: 5px 0 5px; color: #f2faef; font-size: 22px; }
        .welcome-card p { margin: 0; color: #91a891; font-size: 12px; line-height: 1.5; }
        @media (max-width: 600px) { .welcome-card { margin: 14px; padding: 16px; } .welcome-card h1 { font-size: 18px; } }
      `}</style>
    </section>
  );
}