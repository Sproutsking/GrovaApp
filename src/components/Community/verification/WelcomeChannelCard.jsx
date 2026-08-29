import React, { useState, useEffect } from "react";
import { PartyPopper } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

export default function WelcomeChannelCard({ community }) {
  const [welcome, setWelcome] = useState({
    title: "Find your people. Make something memorable.",
    description: "Introduce yourself, explore the channels, and join the conversation."
  });

  useEffect(() => {
    if (!community?.id) return;
    // Load custom welcome message from community settings
    const fetchWelcome = async () => {
      const { data } = await supabase
        .from("communities")
        .select("settings")
        .eq("id", community.id)
        .single();
      
      if (data?.settings?.welcome_title || data?.settings?.welcome_description) {
        setWelcome({
          title: data.settings.welcome_title || welcome.title,
          description: data.settings.welcome_description || welcome.description
        });
      }
    };
    
    fetchWelcome();
  }, [community?.id]);

  return (
    <section className="welcome-card">
      <div className="welcome-mark">
        <PartyPopper size={22} />
      </div>
      <div>
        <span>Welcome to {community?.name || "the community"}</span>
        <h1>{welcome.title}</h1>
        <p>{welcome.description}</p>
      </div>
      <style>
        {`
          .welcome-card {
            display: flex;
            gap: 15px;
            align-items: flex-start;
            max-width: 720px;
            margin: 26px auto;
            padding: 22px;
            border-radius: 18px;
            border: 1px solid rgba(156, 255, 0, 0.2);
            background: linear-gradient(145deg, rgba(29, 45, 25, 0.96), rgba(9, 15, 11, 0.98));
            box-shadow: 0 18px 52px rgba(0, 0, 0, 0.28);
          }

          .welcome-mark {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9cff00;
            background: rgba(156, 255, 0, 0.12);
            border: 1px solid rgba(156, 255, 0, 0.28);
            flex-shrink: 0;
          }

          .welcome-card span {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #9cff00;
          }

          .welcome-card h1 {
            margin: 5px 0 5px;
            color: #f2faef;
            font-size: 22px;
          }

          .welcome-card p {
            margin: 0;
            color: #91a891;
            font-size: 12px;
            line-height: 1.5;
          }

          @media (max-width: 600px) {
            .welcome-card {
              margin: 14px;
              padding: 16px;
            }
            .welcome-card h1 {
              font-size: 18px;
            }
          }
        `}
      </style>
    </section>
  );
}
