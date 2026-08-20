import React, { useState } from "react";
import { Compass, Gamepad2, Globe2, Layers3, Store, Users, WalletCards } from "lucide-react";
import ServicesModal from "../components/Shared/ServicesModal";

const ICONS = { home: Compass, community: Users, market: Store, wallet: WalletCards };

export default function ExperienceBottomNav({ experience, activeTab, setActiveTab, currentUser, xrcService }) {
  const [showServices, setShowServices] = useState(false);
  const BrandIcon = experience.id === "gaming" ? Gamepad2 : Globe2;
  const tabs = experience.id === "gaming"
    ? [{ id: "home", label: "Lobby" }, { id: "community", label: "Rooms" }, { id: "market", label: "Trade" }, { id: "wallet", label: "Wallet" }]
    : [{ id: "home", label: "Signal" }, { id: "community", label: "Circles" }, { id: "market", label: "Projects" }, { id: "wallet", label: "Wallet" }];

  return <>
    <nav className={`experience-bottom-nav experience-bottom-nav-${experience.id}`} style={{ "--experience-accent": experience.accent }} aria-label={`${experience.name} mobile navigation`}>
      {tabs.map(({ id, label }) => { const Icon = ICONS[id]; const active = activeTab === id; return <button key={id} type="button" className={active ? "active" : ""} onClick={() => setActiveTab(id)}><Icon size={18} /><span>{label}</span>{active && <i />}</button>; })}
      <button type="button" onClick={() => setShowServices(true)}><BrandIcon size={18} /><span>More</span></button>
    </nav>
    {showServices && <ServicesModal onClose={() => setShowServices(false)} setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }} currentUser={currentUser} xrcService={xrcService} />}
    <style>{`.experience-bottom-nav{display:none}@media(max-width:768px){.experience-bottom-nav{position:fixed;display:flex;align-items:stretch;justify-content:space-around;left:0;right:0;bottom:0;z-index:100;padding:7px 8px calc(8px + env(safe-area-inset-bottom));background:rgba(7,16,26,.94);border-top:1px solid color-mix(in srgb,var(--experience-accent) 28%,transparent);backdrop-filter:blur(22px)}.experience-bottom-nav-web3{background:rgba(17,14,9,.95)}.experience-bottom-nav button{position:relative;display:flex;flex:1;flex-direction:column;align-items:center;gap:4px;padding:6px 3px;border:1px solid transparent;border-radius:9px;background:transparent;color:#778999;font:700 9px inherit;cursor:pointer}.experience-bottom-nav button.active{color:var(--experience-accent);border-color:color-mix(in srgb,var(--experience-accent) 35%,transparent);background:color-mix(in srgb,var(--experience-accent) 10%,transparent)}.experience-bottom-nav button i{position:absolute;top:-8px;width:18px;height:2px;border-radius:0 0 4px 4px;background:var(--experience-accent);box-shadow:0 0 9px var(--experience-accent)}}`}</style>
  </>;
}
