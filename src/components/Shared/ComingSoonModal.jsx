import React from "react";
import { Bell, Clock3, Sparkles, X } from "lucide-react";

export default function ComingSoonModal({ title = "Ambassador Program", onClose }) {
  return (
    <div className="coming-soon-overlay" onClick={onClose}>
      <section className="coming-soon-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="coming-soon-title">
        <button type="button" className="coming-soon-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="coming-soon-orbit" aria-hidden="true"><Sparkles size={24} /></div>
        <span className="coming-soon-kicker"><Clock3 size={12} /> In development</span>
        <h2 id="coming-soon-title">{title}</h2>
        <p>We are building this experience with the care it deserves. The next chapter is being prepared for launch.</p>
        <div className="coming-soon-signal"><Bell size={14} /><span>Coming soon to Xeevia</span></div>
        <button type="button" className="coming-soon-action" onClick={onClose}>Got it</button>
        <style>{`.coming-soon-overlay{position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,5,8,.72);backdrop-filter:blur(10px);animation:comingSoonFade .18s ease}.coming-soon-card{position:relative;width:min(390px,100%);overflow:hidden;padding:30px 26px 24px;border:1px solid rgba(245,158,11,.34);border-radius:22px;background:radial-gradient(circle at 50% 0%,rgba(245,158,11,.16),transparent 44%),linear-gradient(145deg,#17130b,#0d1118 68%,#0a0d12);box-shadow:0 28px 90px rgba(0,0,0,.7),0 0 42px rgba(245,158,11,.12);text-align:center;color:#f8fafc}.coming-soon-card:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(to bottom,black,transparent 70%)}.coming-soon-close{position:absolute;right:12px;top:12px;width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(255,255,255,.06);color:#aab3bf;cursor:pointer}.coming-soon-orbit{position:relative;width:66px;height:66px;display:grid;place-items:center;margin:0 auto 15px;border:1px solid rgba(245,158,11,.5);border-radius:50%;color:#fbbf24;background:rgba(245,158,11,.1);box-shadow:0 0 0 8px rgba(245,158,11,.05),0 0 28px rgba(245,158,11,.2);animation:comingSoonPulse 2.8s ease-in-out infinite}.coming-soon-kicker{position:relative;display:inline-flex;align-items:center;gap:5px;color:#fbbf24;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.coming-soon-card h2{position:relative;margin:9px 0 8px;font-size:24px}.coming-soon-card p{position:relative;margin:0 auto;color:#aab3bf;font-size:12px;line-height:1.6;max-width:300px}.coming-soon-signal{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;margin:20px 0 16px;padding:10px;border:1px solid rgba(245,158,11,.18);border-radius:10px;background:rgba(245,158,11,.06);color:#f8d58a;font-size:11px;font-weight:800}.coming-soon-action{position:relative;width:100%;padding:11px 14px;border:1px solid rgba(245,158,11,.34);border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#1b1102;font:800 12px inherit;cursor:pointer}@keyframes comingSoonFade{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}@keyframes comingSoonPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 8px rgba(245,158,11,.05),0 0 28px rgba(245,158,11,.2)}50%{transform:scale(1.05);box-shadow:0 0 0 13px rgba(245,158,11,.03),0 0 42px rgba(245,158,11,.28)}}`}</style>
      </section>
    </div>
  );
}
