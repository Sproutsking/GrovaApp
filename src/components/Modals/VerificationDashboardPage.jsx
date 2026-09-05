import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";

const VerificationDashboardPage = ({ profile, dashboard, verificationItems = [], loading, onBack, onClose }) => {
  const [selectedSection, setSelectedSection] = useState(null);
  const selected = dashboard?.sections?.find(section => section.id === selectedSection);
  const verifiedCount = verificationItems.filter(item => item?.verified).length;
  const highTrustCount = verificationItems.filter(item => {
    const level = item?.metadata?.verificationLevel || item?.metadata?.verification_level;
    return item?.verified && (level === "high" || level === "critical");
  }).length;
  const sourceCount = new Set(verificationItems.map(item => item?.provider).filter(Boolean)).size;
  const platformProfiles = useMemo(() => {
    const seen = new Set();
    return verificationItems
      .filter((item) => item?.provider && !seen.has(item.provider) && seen.add(item.provider))
      .slice(0, 8)
      .map((item) => ({
        provider: item.provider,
        title: item.title || item.provider,
        avatarUrl: item.metadata?.avatarUrl || item.metadata?.avatar_url || item.raw?.avatar_url || item.raw?.profile_image_url || null,
      }));
  }, [verificationItems]);

  const mainAvatar = profile?.avatarUrl || profile?.avatar_url || null;
  const profileName = dashboard?.profileSummary?.displayName || profile?.fullName || "This profile";
  const initials = profileName.charAt(0).toUpperCase();

  const renderAvatar = (avatar, label, className = "") => avatar
    ? <img className={className} src={avatar} alt={`${label} profile`} />
    : <span className={`${className} vdp-platform-fallback`}>{label.charAt(0).toUpperCase()}</span>;

  const renderSectionPage = () => (
    <div className="vdp-section-page">
      <div className="vdp-nav">
        <button type="button" onClick={() => setSelectedSection(null)}><ArrowLeft size={15}/> Back to evidence map</button>
        <button type="button" onClick={onClose} aria-label="Close dashboard"><X size={15}/> Close</button>
      </div>
      <div className="vdp-section-hero" style={{ "--section-accent": selected.accent || "#84cc16" }}>
        <div className="vdp-kicker">Evidence module</div>
        <h1 className="vdp-title">{selected.title}</h1>
        <p className="vdp-sub">{selected.subtitle}</p>
        <div className="vdp-section-meta"><ShieldCheck size={16} color="#84cc16"/> {selected.items.length} evidence records · {selected.items.filter(item => item.verified).length} verified</div>
      </div>
      <section className="vdp-records">
        <div className="vdp-heading"><div><h2>Verified records</h2><p>{selected.summary}</p></div></div>
        {selected.items.length === 0 ? <div className="vdp-empty">No verified evidence found for this section yet.</div> : <div className="vdp-evidence">{selected.items.map(item => <article className="vdp-evidence-item" key={item.id || item.title}><div className="vdp-evidence-title"><span>{item.title}</span><span style={{color:item.verified ? "#84cc16" : "#9ca3af"}}>{item.verified ? "Verified" : "Tracked"}</span></div><div className="vdp-evidence-meta">{item.provider} · {item.evidence_type}</div>{item.summary && <div className="vdp-evidence-summary">{item.summary}</div>}</article>)}</div>}
      </section>
    </div>
  );

  return ReactDOM.createPortal(
    <div className="vdp-root">
      <style>{`
        .vdp-root{position:fixed;inset:0;z-index:100001;overflow-y:auto;background:#07080b;color:#f8fafc;font-family:inherit}
        .vdp-bg{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 15% 0%,rgba(132,204,22,.13),transparent 34%),radial-gradient(circle at 85% 15%,rgba(96,165,250,.1),transparent 30%),linear-gradient(135deg,#08090b,#10131b 55%,#08090b)}
        .vdp-shell{position:relative;max-width:1120px;margin:0 auto;padding:22px 24px 60px}
        .vdp-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:26px}
        .vdp-nav button{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}
        .vdp-kicker{color:#84cc16;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .vdp-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:28px;align-items:center;padding:28px;border:1px solid rgba(132,204,22,.2);border-radius:22px;background:linear-gradient(135deg,rgba(132,204,22,.1),rgba(255,255,255,.035) 48%,rgba(96,165,250,.08));box-shadow:0 24px 80px rgba(0,0,0,.28)}
        .vdp-title{font-size:clamp(28px,4vw,48px);line-height:1.02;margin:8px 0 8px;font-weight:950;letter-spacing:-.03em;text-align:left}
        .vdp-sub{margin:0;color:#aeb8c7;font-size:14px;line-height:1.6;max-width:620px;text-align:left}
        .vdp-avatar-frame{width:130px;height:130px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(132,204,22,.28);box-shadow:0 0 0 9px rgba(132,204,22,.08),0 0 30px rgba(132,204,22,.12);justify-self:start}
        .vdp-avatar{width:112px;height:112px;border-radius:50%;object-fit:cover;border:3px solid rgba(132,204,22,.55);image-rendering:auto;display:block}
        .vdp-avatar-fallback{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:#17220c;color:#84cc16;font-size:42px;font-weight:950;border:3px solid rgba(132,204,22,.55)}
        .vdp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
        .vdp-stat{padding:14px 16px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(0,0,0,.2)}
        .vdp-stat strong{display:block;font-size:24px;color:#84cc16}.vdp-stat span{font-size:10px;color:#9aa5b5;text-transform:uppercase;letter-spacing:.08em;font-weight:800}
        .vdp-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:30px 0 12px}.vdp-heading h2{margin:0;font-size:17px}.vdp-heading p{margin:0;color:#8994a4;font-size:12px}
        .vdp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.vdp-card{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));padding:18px;text-align:left;cursor:pointer;color:#fff;min-height:132px;transition:transform .2s,border-color .2s,background .2s,box-shadow .2s}.vdp-card::after{content:"";position:absolute;right:-26px;bottom:-36px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(132,204,22,.2),transparent 68%);pointer-events:none}.vdp-card:hover{transform:translateY(-4px);border-color:rgba(132,204,22,.58);background:linear-gradient(145deg,rgba(132,204,22,.13),rgba(255,255,255,.04));box-shadow:0 14px 40px rgba(0,0,0,.3),0 0 0 1px rgba(132,204,22,.08)}.vdp-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.vdp-card h3{font-size:15px;margin:0}.vdp-card p{font-size:11px;color:#9ca8b8;line-height:1.5;margin:18px 0 0}.vdp-count{font-size:11px;color:#84cc16;font-weight:900;border:1px solid rgba(132,204,22,.28);background:rgba(132,204,22,.1);padding:4px 7px;border-radius:8px}
        .vdp-section-page{animation:vdpIn .3s ease both}.vdp-section-hero{padding:30px;border:1px solid rgba(132,204,22,.24);border-radius:22px;background:linear-gradient(135deg,rgba(132,204,22,.14),rgba(96,165,250,.07) 55%,rgba(255,255,255,.035));box-shadow:0 24px 80px rgba(0,0,0,.28)}.vdp-section-meta{display:flex;align-items:center;gap:8px;margin-top:20px;color:#aeb8c7;font-size:12px;font-weight:700}.vdp-records{max-width:860px;margin:0 auto}.vdp-empty{padding:26px;border:1px dashed rgba(255,255,255,.16);border-radius:16px;color:#8f9aaa;background:rgba(255,255,255,.03);font-size:13px}@keyframes vdpIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .vdp-detail{margin-top:16px;padding:20px;border:1px solid rgba(132,204,22,.25);border-radius:18px;background:rgba(0,0,0,.24)}.vdp-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.vdp-detail h3{margin:0 0 5px;font-size:18px}.vdp-detail-head p{margin:0;color:#9ca8b8;font-size:12px}.vdp-detail-close{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:9px;padding:8px;cursor:pointer}.vdp-evidence{display:grid;gap:10px;margin-top:18px}.vdp-evidence-item{padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.vdp-evidence-title{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:800}.vdp-evidence-meta{color:#8f9aaa;font-size:11px;margin-top:5px}.vdp-evidence-summary{color:#cbd5e1;font-size:12px;line-height:1.5;margin-top:9px}
        @media(max-width:700px){.vdp-shell{padding:16px 14px 44px}.vdp-hero{grid-template-columns:1fr;padding:20px}.vdp-section-hero{padding:22px 18px}.vdp-avatar-frame{width:102px;height:102px}.vdp-avatar,.vdp-avatar-fallback{width:84px;height:84px}.vdp-avatar-fallback{font-size:32px}.vdp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vdp-card{padding:14px;min-height:118px}.vdp-stats{gap:6px}.vdp-stat{padding:12px 8px}.vdp-stat strong{font-size:20px}}
      `}</style>
      <style>{`
        .vdp-bg{background:radial-gradient(circle at 12% 8%,rgba(132,204,22,.18),transparent 30%),radial-gradient(circle at 88% 14%,rgba(96,165,250,.14),transparent 30%),radial-gradient(circle at 54% 92%,rgba(167,139,250,.1),transparent 34%),linear-gradient(135deg,#070a0b,#111722 52%,#08090d);background-size:140% 140%;animation:vdpBgDrift 18s ease-in-out infinite alternate}
        .vdp-hero{grid-template-columns:minmax(260px,.9fr) minmax(0,1.65fr);gap:0;padding:0;overflow:hidden}
        .vdp-visual-column{position:relative;min-height:292px;display:flex;align-items:center;justify-content:center;padding:24px;border-right:1px solid rgba(255,255,255,.16);background:radial-gradient(circle at 30% 50%,rgba(132,204,22,.14),transparent 58%),linear-gradient(145deg,rgba(0,0,0,.18),rgba(96,165,250,.06))}
        .vdp-platform-orbit{position:relative;width:100%;height:230px;display:flex;align-items:center}.vdp-main-avatar{position:relative;z-index:3;width:132px;height:132px;border-radius:50%;display:grid;place-items:center;padding:6px;border:1px solid rgba(132,204,22,.55);background:rgba(8,14,10,.9);box-shadow:0 0 0 9px rgba(132,204,22,.08),0 0 34px rgba(132,204,22,.25)}
        .vdp-avatar{width:100%;height:100%;border-radius:50%;object-fit:cover;border:3px solid rgba(132,204,22,.65);display:block}.vdp-platform-fallback{display:grid;place-items:center;background:linear-gradient(145deg,#203b16,#111b24);color:#b8f276;font-size:42px;font-weight:950}
        .vdp-platform-pyramid{position:absolute;left:104px;right:-4px;top:18px;height:194px}.vdp-platform-chip{position:absolute;display:flex;align-items:center;gap:5px;padding:4px 7px 4px 4px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(10,15,18,.9);box-shadow:0 8px 20px rgba(0,0,0,.3);font-size:8px;color:#b7c4d0;text-transform:capitalize}.vdp-platform-avatar{width:27px;height:27px;border-radius:50%;object-fit:cover;border:1px solid rgba(132,204,22,.45);font-size:11px}.vdp-platform-chip-0{left:0;top:80px}.vdp-platform-chip-1{left:42px;top:40px}.vdp-platform-chip-2{left:42px;top:120px}.vdp-platform-chip-3{left:84px;top:0}.vdp-platform-chip-4{left:84px;top:80px}.vdp-platform-chip-5{left:84px;top:160px}.vdp-platform-chip-6{left:126px;top:40px}.vdp-platform-chip-7{left:126px;top:120px}
        .vdp-hero-data{display:flex;flex-direction:column;justify-content:center;padding:34px 36px}.vdp-card{--card-accent:#84cc16;background:linear-gradient(145deg,color-mix(in srgb,var(--card-accent) 10%,rgba(255,255,255,.045)),rgba(255,255,255,.025))}.vdp-card::after{background:radial-gradient(circle,color-mix(in srgb,var(--card-accent) 35%,transparent),transparent 68%)}.vdp-card:hover{border-color:var(--card-accent);background:linear-gradient(145deg,color-mix(in srgb,var(--card-accent) 18%,rgba(255,255,255,.05)),rgba(255,255,255,.04));box-shadow:0 14px 40px rgba(0,0,0,.3),0 0 0 1px color-mix(in srgb,var(--card-accent) 25%,transparent)}
        .vdp-section-page{min-height:calc(100dvh - 44px);padding-bottom:40px}.vdp-section-hero{--section-accent:#84cc16;border-color:color-mix(in srgb,var(--section-accent) 45%,transparent);background:radial-gradient(circle at 86% 18%,color-mix(in srgb,var(--section-accent) 22%,transparent),transparent 36%),linear-gradient(135deg,color-mix(in srgb,var(--section-accent) 16%,rgba(255,255,255,.035)),rgba(96,165,250,.07) 55%,rgba(255,255,255,.035));box-shadow:0 24px 80px rgba(0,0,0,.32),inset 0 0 60px color-mix(in srgb,var(--section-accent) 8%,transparent)}
        @keyframes vdpBgDrift{from{background-position:0% 0%}to{background-position:100% 100%}}
        @media(max-width:700px){.vdp-hero{grid-template-columns:1fr}.vdp-visual-column{min-height:250px;border-right:0;border-bottom:1px solid rgba(255,255,255,.16);padding:18px}.vdp-platform-orbit{height:210px;justify-content:center;align-items:flex-start}.vdp-main-avatar{width:112px;height:112px}.vdp-platform-pyramid{left:50%;right:auto;top:102px;transform:translateX(-50%);width:210px;height:100px}.vdp-platform-chip{transform:scale(.9);transform-origin:top left}.vdp-platform-chip-0{left:0;top:38px}.vdp-platform-chip-1{left:42px;top:0}.vdp-platform-chip-2{left:42px;top:76px}.vdp-platform-chip-3{left:84px;top:-38px}.vdp-platform-chip-4{left:84px;top:38px}.vdp-platform-chip-5{left:84px;top:114px}.vdp-platform-chip-6{left:126px;top:0}.vdp-platform-chip-7{left:126px;top:76px}.vdp-hero-data{padding:24px 20px}}
      `}</style>
      <div className="vdp-bg" />
      <main className="vdp-shell">
        {!selected && <div className="vdp-nav">
          <button type="button" onClick={onBack}><ArrowLeft size={15}/> Back to profile</button>
          <button type="button" onClick={onClose} aria-label="Close dashboard"><X size={15}/> Close</button>
        </div>}
        {selected ? renderSectionPage() : <>
        <section className="vdp-hero">
          <div className="vdp-visual-column">
            <div className="vdp-platform-orbit" aria-label="Connected platform profiles">
              <div className="vdp-main-avatar">{renderAvatar(mainAvatar, profileName, "vdp-avatar")}</div>
              <div className="vdp-platform-pyramid">
                {platformProfiles.map((platform, index) => <div className={`vdp-platform-chip vdp-platform-chip-${index}`} key={platform.provider} title={platform.title}>{renderAvatar(platform.avatarUrl, platform.title, "vdp-platform-avatar")}<span>{platform.provider}</span></div>)}
              </div>
            </div>
          </div>
          <div className="vdp-hero-data">
            <div className="vdp-kicker">Xeevia proof layer</div>
            <h1 className="vdp-title">Verification Dashboard</h1>
            <p className="vdp-sub">A structured view of {profileName}'s identity, connected signals, and verified evidence.</p>
            <div className="vdp-stats">
              <div className="vdp-stat"><strong>{verifiedCount}</strong><span>Verified signals</span></div>
              <div className="vdp-stat"><strong>{highTrustCount}</strong><span>High trust</span></div>
              <div className="vdp-stat"><strong>{sourceCount}</strong><span>Sources</span></div>
            </div>
          </div>
        </section>
        <div className="vdp-heading"><div><h2>Evidence map</h2><p>{loading ? "Loading verified evidence..." : "Select a section to inspect its proof records."}</p></div><ShieldCheck size={20} color="#84cc16" /></div>
        <section className="vdp-grid">
          {(dashboard?.sections || []).map(section => (
            <button className="vdp-card" style={{ "--card-accent": section.accent || "#84cc16" }} type="button" key={section.id} onClick={() => setSelectedSection(section.id)}>
              <div className="vdp-card-top"><h3>{section.title}</h3><span className="vdp-count">{section.items.length}</span></div>
              <p>{section.subtitle}</p>
            </button>
          ))}
        </section>
        {selected && <section className="vdp-detail">
          <div className="vdp-detail-head"><div><h3>{selected.title}</h3><p>{selected.summary}</p></div><button className="vdp-detail-close" type="button" onClick={() => setSelectedSection(null)} aria-label="Close section"><X size={15}/></button></div>
          {selected.items.length === 0 ? <p className="vdp-evidence-meta">No verified evidence found for this section yet.</p> : <div className="vdp-evidence">{selected.items.map(item => <article className="vdp-evidence-item" key={item.id || item.title}><div className="vdp-evidence-title"><span>{item.title}</span><span style={{color:item.verified ? "#84cc16" : "#9ca3af"}}>{item.verified ? "Verified" : "Tracked"}</span></div><div className="vdp-evidence-meta">{item.provider} · {item.evidence_type}</div>{item.summary && <div className="vdp-evidence-summary">{item.summary}</div>}</article>)}</div>}
        </section>}
        </>}
      </main>
    </div>,
    document.body
  );
};

export default VerificationDashboardPage;
