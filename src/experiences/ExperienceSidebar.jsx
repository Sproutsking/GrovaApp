import React, { useState } from "react";
import { Compass, Gamepad2, Globe2, Layers3, Store, Users, WalletCards } from "lucide-react";
import ServicesModal from "../components/Shared/ServicesModal";

const ICONS = { home: Compass, community: Users, market: Store, wallet: WalletCards, account: Layers3 };

export default function ExperienceSidebar({ experience, activeTab, setActiveTab, currentUser, xrcService }) {
  const [showServices, setShowServices] = useState(false);
  const Icon = experience.id === "gaming" ? Gamepad2 : Globe2;
  const subTabs = experience.id === "gaming"
    ? [{ id: "home", label: "Lobby" }, { id: "community", label: "Game Rooms" }, { id: "market", label: "Trading" }, { id: "wallet", label: "Wallet" }, { id: "account", label: "Account" }]
    : [{ id: "home", label: "Signal" }, { id: "community", label: "Communities" }, { id: "market", label: "Projects" }, { id: "wallet", label: "Wallet" }, { id: "account", label: "Account" }];

  return (
    <aside className={`experience-sidebar experience-sidebar-${experience.id}`} style={{ "--experience-accent": experience.accent }}>
      <div className="experience-sidebar-inner">
        <div className="experience-sidebar-brand">
          <div className="experience-sidebar-mark"><Icon size={18} /></div>
          <div><strong>{experience.name}</strong><span>XEEVIA / EXPERIENCE</span></div>
        </div>
        <div className="experience-sidebar-rule" />
        <nav aria-label={`${experience.name} navigation`}>
          {subTabs.map(({ id, label }) => {
            const NavIcon = ICONS[id];
            const active = activeTab === id;
            return <button key={id} type="button" className={active ? "active" : ""} onClick={() => setActiveTab(id)}><NavIcon size={16} /><span>{label}</span>{active && <i />}</button>;
          })}
        </nav>
        <button type="button" className="experience-sidebar-services" onClick={() => setShowServices(true)}><Layers3 size={16} /><span>More tools</span></button>
        <div className="experience-sidebar-footer"><span className="experience-sidebar-pulse" />{experience.id === "gaming" ? "ROBLOX READY" : "BUILDER MODE"}</div>
      </div>
      {showServices && <ServicesModal onClose={() => setShowServices(false)} setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }} currentUser={currentUser} xrcService={xrcService} />}
      <style>{`.experience-sidebar{position:fixed;inset:0 auto 0 0;width:224px;z-index:11;padding:14px;background:#07101a;color:#dceaff}.experience-sidebar-web3{background:#110e09;color:#fff4df}.experience-sidebar-inner{height:100%;display:flex;flex-direction:column;padding:18px 12px;border:1px solid color-mix(in srgb,var(--experience-accent) 22%,transparent);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--experience-accent) 9%,transparent),rgba(255,255,255,.018) 35%,rgba(0,0,0,.18));box-shadow:0 18px 44px rgba(0,0,0,.25)}.experience-sidebar-brand{display:flex;align-items:center;gap:10px;padding:6px 8px 15px}.experience-sidebar-mark{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid color-mix(in srgb,var(--experience-accent) 48%,transparent);border-radius:9px;color:var(--experience-accent);background:color-mix(in srgb,var(--experience-accent) 12%,transparent)}.experience-sidebar-brand strong{display:block;font-size:13px;letter-spacing:.11em;text-transform:uppercase}.experience-sidebar-brand span{display:block;margin-top:3px;color:var(--experience-accent);font-size:8px;font-weight:800;letter-spacing:.1em}.experience-sidebar-rule{height:1px;margin:0 8px 15px;background:color-mix(in srgb,var(--experience-accent) 18%,transparent)}.experience-sidebar nav{display:flex;flex-direction:column;gap:4px}.experience-sidebar nav button,.experience-sidebar-services{position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:11px 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#8192a2;font:700 11px inherit;text-align:left;cursor:pointer;transition:all .17s ease}.experience-sidebar nav button:hover,.experience-sidebar-services:hover{color:var(--experience-accent);background:color-mix(in srgb,var(--experience-accent) 8%,transparent)}.experience-sidebar nav button.active{color:var(--experience-accent);border-color:color-mix(in srgb,var(--experience-accent) 28%,transparent);background:color-mix(in srgb,var(--experience-accent) 12%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--experience-accent) 10%,transparent)}.experience-sidebar nav button i{position:absolute;left:-13px;width:3px;height:22px;border-radius:0 3px 3px 0;background:var(--experience-accent);box-shadow:0 0 9px var(--experience-accent)}.experience-sidebar-services{margin-top:auto;border-top:1px solid color-mix(in srgb,var(--experience-accent) 14%,transparent);border-radius:0;padding-top:16px}.experience-sidebar-footer{display:flex;align-items:center;gap:7px;margin:18px 8px 3px;color:#718392;font-size:8px;font-weight:900;letter-spacing:.12em}.experience-sidebar-pulse{width:6px;height:6px;border-radius:50%;background:var(--experience-accent);box-shadow:0 0 10px var(--experience-accent)}@media(max-width:768px){.experience-sidebar{display:none}}`}</style>
    </aside>
  );
}
