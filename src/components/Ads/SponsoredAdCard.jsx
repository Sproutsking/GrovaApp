import React, { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Flag, MoreHorizontal, ShieldCheck } from "lucide-react";
import adCampaignService from "../../services/ads/adCampaignService";

export default function SponsoredAdCard({ ad, onHidden }) {
  const cardRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const node = cardRef.current;
    if (!node || !("IntersectionObserver" in window)) return undefined;
    let timer;
    let recorded = false;
    let visible = false;
    const clearTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    };
    const tryRecord = () => {
      clearTimer();
      if (recorded || !visible || document.visibilityState !== "visible") return;
      timer = window.setTimeout(async () => {
        try {
          await adCampaignService.recordEvent(ad.campaign_id, ad.creator_id, "impression");
          recorded = true;
        } catch (error) {
          console.error("[Ads] Could not record viewable impression:", error);
        }
      }, 1000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5);
      tryRecord();
    }, { threshold: [0, 0.5, 1] });
    const onVisibilityChange = () => tryRecord();
    observer.observe(node);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimer();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ad.campaign_id, ad.creator_id]);

  const handleClick = useCallback(() => {
    window.open(ad.destination_url, "_blank", "noopener,noreferrer");
    adCampaignService.recordEvent(ad.campaign_id, ad.creator_id, "click").catch((error) => {
      console.error("[Ads] Could not record campaign click:", error);
    });
  }, [ad.campaign_id, ad.creator_id, ad.destination_url]);

  const control = async (action) => {
    const reason = action === "reported" ? window.prompt("What is wrong with this campaign?") : null;
    if (action === "reported" && !reason?.trim()) return;
    try {
      await adCampaignService.setViewerControl(ad.campaign_id, action, reason);
      setMenuOpen(false);
      if (action === "hidden") onHidden(ad.campaign_id);
      else setMessage("Report sent. Thank you for helping keep campaigns accountable.");
    } catch (error) {
      console.error("[Ads] Could not save viewer feedback:", error);
      setMessage(error?.message || "Your feedback could not be saved.");
    }
  };

  return (
    <article ref={cardRef} className="sac-card" aria-label="Sponsored campaign">
      <header className="sac-header">
        <div className="sac-sponsor"><span className="sac-label">Sponsored</span><strong>{ad.creator_name || "Creator"}</strong><small>Paid for by {ad.advertiser_name || "Xeevia advertiser"}</small></div>
        <div className="sac-menu-wrap">
          <button type="button" className="sac-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Campaign options"><MoreHorizontal size={19} /></button>
          {menuOpen && <div className="sac-menu">
            <button type="button" onClick={() => control("hidden")}><ShieldCheck size={14} /> Hide this campaign</button>
            <button type="button" onClick={() => control("reported")}><Flag size={14} /> Report campaign</button>
          </div>}
        </div>
      </header>
      <div className="sac-video-wrap"><video src={ad.creative_url} controls playsInline preload="metadata" aria-label={ad.campaign_name} /></div>
      <div className="sac-body">
        <div className="sac-caption"><strong>{ad.campaign_name}</strong><span>{ad.objective?.replaceAll("_", " ")}</span></div>
        <button type="button" className="sac-cta" onClick={handleClick}>Learn more <ExternalLink size={14} /></button>
        {message && <small className="sac-message" role="status">{message}</small>}
      </div>
      <style>{`
        .sac-card{position:relative;overflow:visible;border:1px solid #c1e69024;border-radius:16px;background:#0d1711;color:#eef4eb;margin-bottom:8px}.sac-header{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 15px 10px}.sac-sponsor{display:grid;gap:4px}.sac-label{width:max-content;border:1px solid #b5e88355;border-radius:4px;padding:2px 5px;color:#c5ed9b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.sac-sponsor strong{font-size:12px}.sac-sponsor small{color:#87968a;font-size:10px}.sac-menu-wrap{position:relative}.sac-menu-button{width:30px;height:30px;border:0;border-radius:8px;background:#ffffff0b;color:#b8c5ba;cursor:pointer}.sac-menu{position:absolute;right:0;top:34px;z-index:4;display:grid;min-width:180px;padding:5px;border:1px solid #ffffff20;border-radius:10px;background:#111b14;box-shadow:0 12px 30px #000a}.sac-menu button{display:flex;align-items:center;gap:8px;padding:9px;border:0;border-radius:7px;background:transparent;color:#dce5dc;font-size:11px;text-align:left;cursor:pointer}.sac-menu button:hover{background:#ffffff0c}.sac-video-wrap{background:#000}.sac-video-wrap video{display:block;width:100%;max-height:520px;aspect-ratio:16/9;object-fit:contain}.sac-body{padding:12px 15px 15px}.sac-caption{display:flex;justify-content:space-between;gap:10px;align-items:center}.sac-caption strong{font-size:13px}.sac-caption span{color:#91a096;font-size:10px;text-transform:capitalize}.sac-cta{margin-top:12px;min-height:36px;width:100%;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:9px;background:#b9ef76;color:#10200b;font-size:11px;font-weight:800;cursor:pointer}.sac-message{display:block;margin-top:8px;color:#bedf9a;font-size:10px}
        .sac-card{overflow:hidden;border-color:rgba(193,230,144,.2);background:linear-gradient(145deg,rgba(18,30,22,.96),rgba(7,13,10,.98));box-shadow:0 20px 50px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.05)}
        .sac-card:before{position:absolute;inset:0 0 auto;height:1px;content:"";z-index:1;background:linear-gradient(90deg,transparent,rgba(201,255,165,.6),rgba(94,203,166,.4),transparent);pointer-events:none}
        .sac-header{background:radial-gradient(ellipse at 0 0,rgba(146,218,87,.09),transparent 58%)}
        .sac-label{border-radius:999px;background:rgba(173,239,113,.08);padding:4px 8px;letter-spacing:.1em}
        .sac-menu-button{transition:background .18s ease,color .18s ease}.sac-menu-button:hover{background:#ffffff17;color:#fff}
        .sac-menu{backdrop-filter:blur(16px);background:rgba(12,21,15,.96)}
        .sac-video-wrap{background:radial-gradient(ellipse at 50% 40%,#17251b,#030504 72%)}
        .sac-video-wrap video{max-height:580px}
        .sac-caption strong{letter-spacing:-.02em}
        .sac-cta{transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.sac-cta:hover{transform:translateY(-1px);background:#caf692;box-shadow:0 8px 20px rgba(185,239,118,.16)}
        @media(prefers-reduced-motion:reduce){.sac-menu-button,.sac-cta{transition:none}}
      `}</style>
    </article>
  );
}
