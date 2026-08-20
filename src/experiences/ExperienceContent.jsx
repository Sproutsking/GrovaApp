import React, { useEffect, useState } from "react";
import { ArrowUpRight, Compass, Gamepad2, Globe2, Layers3, Store, Users } from "lucide-react";
import postService from "../services/home/postService";

const CONTENT = {
  gaming: {
    eyebrow: "ROBLOX / PLAYER CULTURE",
    title: "Play together. Build your identity.",
    body: "A focused home for players, communities, creators, and the worlds they make.",
    accent: "#60a5fa",
    Icon: Gamepad2,
    cards: ["Trending games", "Player circles", "Avatar looks"],
  },
  web3: {
    eyebrow: "BUILDERS / PROTOCOLS / COMMUNITIES",
    title: "Where builders find signal.",
    body: "A social workspace for projects, protocols, research, and the people moving them forward.",
    accent: "#f59e0b",
    Icon: Globe2,
    cards: ["Projects", "Protocol rooms", "Builder opportunities"],
  },
};

export function ExperienceHome({ experience, userId, currentUser, homeSection, setHomeSection, onNavigate }) {
  const content = CONTENT[experience.id];
  const Icon = content.Icon;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    postService.getPosts({}, 0, 12).then((data) => {
      if (active) setPosts(data || []);
    }).catch(() => {
      if (active) setPosts([]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [experience.id]);

  return (
    <div className={`experience-content experience-content-${experience.id}`} style={{ "--experience-accent": content.accent }}>
      <section className="experience-content-hero">
        <div>
          <span className="experience-content-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.body}</p>
          <div className="experience-content-actions">
            {content.cards.map((card, index) => (
              <button key={card} type="button" onClick={() => onNavigate(index === 1 ? "community" : "market")}>
                {card}<ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </div>
        <div className="experience-content-symbol" aria-hidden="true"><Icon size={42} /></div>
      </section>
      <div className="experience-content-heading">
        <div><strong>Live {experience.name} feed</strong><span>Real Xeevia activity, framed for this environment.</span></div>
        <button type="button" onClick={() => onNavigate("search")}><Compass size={15} /> Explore</button>
      </div>
      <div className="experience-content-feed">
        {loading ? <div className="experience-feed-status">Loading the {experience.name} feed...</div> : posts.length === 0 ? <div className="experience-feed-status">No {experience.name} activity yet. Be the first to create something here.</div> : <div className="experience-post-grid">{posts.map((post) => <article className="experience-post-card" key={post.id}><div className="experience-post-meta"><span className="experience-post-avatar">{(post.profiles?.full_name || post.profiles?.username || "U").charAt(0).toUpperCase()}</span><div><strong>{post.profiles?.full_name || post.profiles?.username || "Xeevia member"}</strong><small>@{post.profiles?.username || "member"} · {post.category || "Community"}</small></div></div><p>{post.content || post.card_caption || "Shared media from the community."}</p><div className="experience-post-footer"><span>{post.likes || 0} likes</span><span>{post.comments_count || 0} comments</span><button type="button" onClick={() => onNavigate("community")}>Discuss <ArrowUpRight size={13} /></button></div></article>)}</div>}
      </div>
      <style>{`
        .experience-content{width:min(100%,1060px);margin:0 auto;padding:18px 0 48px}.experience-content-hero{display:flex;align-items:center;justify-content:space-between;gap:26px;padding:clamp(22px,4vw,48px);border:1px solid color-mix(in srgb,var(--experience-accent) 30%,transparent);border-radius:16px;background:linear-gradient(115deg,color-mix(in srgb,var(--experience-accent) 13%,transparent),rgba(255,255,255,.025) 62%,transparent);box-shadow:0 20px 55px rgba(0,0,0,.2);animation:experienceContentIn .45s ease both}.experience-content-eyebrow{color:var(--experience-accent);font-size:10px;font-weight:900;letter-spacing:.14em}.experience-content h1{max-width:650px;margin:12px 0 10px;font-family:'Syne',sans-serif;font-size:clamp(28px,4.5vw,54px);line-height:1.04;letter-spacing:-.03em}.experience-content p{max-width:520px;margin:0;color:#9eafbd;font-size:14px;line-height:1.65}.experience-content-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.experience-content-actions button,.experience-content-heading button,.experience-post-footer button{display:inline-flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid color-mix(in srgb,var(--experience-accent) 32%,transparent);border-radius:8px;background:color-mix(in srgb,var(--experience-accent) 9%,transparent);color:#eaf4ff;font:700 11px inherit;cursor:pointer}.experience-content-actions button:hover,.experience-content-heading button:hover,.experience-post-footer button:hover{color:var(--experience-accent);border-color:var(--experience-accent)}.experience-content-symbol{display:flex;align-items:center;justify-content:center;width:116px;height:116px;flex-shrink:0;border:1px solid color-mix(in srgb,var(--experience-accent) 50%,transparent);border-radius:50%;color:var(--experience-accent);box-shadow:0 0 0 16px color-mix(in srgb,var(--experience-accent) 5%,transparent),0 0 44px color-mix(in srgb,var(--experience-accent) 20%,transparent);animation:experienceContentFloat 4s ease-in-out infinite}.experience-content-heading{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:30px 0 12px}.experience-content-heading strong,.experience-content-heading span{display:block}.experience-content-heading strong{font-size:16px}.experience-content-heading span{margin-top:4px;color:#7d8e9d;font-size:11px}.experience-content-heading button{padding:7px 10px}.experience-content-feed{overflow:hidden;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(0,0,0,.1)}.experience-feed-status{padding:38px 22px;color:#82919d;font-size:13px}.experience-post-grid{display:grid;gap:1px;background:rgba(255,255,255,.07)}.experience-post-card{padding:18px;background:rgba(7,16,26,.72)}.experience-content-web3 .experience-post-card{background:rgba(17,14,9,.78)}.experience-post-meta{display:flex;align-items:center;gap:9px}.experience-post-avatar{display:flex;align-items:center;justify-content:center;width:31px;height:31px;border-radius:9px;background:color-mix(in srgb,var(--experience-accent) 20%,transparent);color:var(--experience-accent);font-size:12px;font-weight:900}.experience-post-meta strong,.experience-post-meta small{display:block}.experience-post-meta strong{font-size:12px}.experience-post-meta small{margin-top:2px;color:#788b9b;font-size:10px}.experience-post-card>p{max-width:none;margin:14px 0;color:#dce7ef;font-size:13px;line-height:1.55}.experience-post-footer{display:flex;align-items:center;gap:12px;color:#718494;font-size:10px}.experience-post-footer button{margin-left:auto;padding:6px 8px}@keyframes experienceContentIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes experienceContentFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-7px) rotate(4deg)}}@media(max-width:640px){.experience-content-hero{align-items:flex-start}.experience-content-symbol{width:72px;height:72px}.experience-content-symbol svg{width:28px}.experience-content-heading{align-items:flex-start}.experience-content-heading button{flex-shrink:0}}
      `}</style>
    </div>
  );
}

export function ExperienceMarket({ experience, onNavigate }) {
  const isGaming = experience.id === "gaming";
  const sections = isGaming
    ? [["Trading", "Express what you have and what you want."], ["Avatar fashion", "Showcase looks and discover creators."], ["Player discovery", "Find the right people for your next session."]]
    : [["Projects", "Discover useful work and the people building it."], ["Opportunities", "Surface real contributions, services, and bounties."], ["Digital assets", "Explore supported assets through the global wallet."]];

  return (
    <div className={`experience-market-content experience-market-${experience.id}`} style={{ "--experience-accent": experience.accent }}>
      <div className="experience-market-title"><div><span>{isGaming ? "PLAYER MARKET" : "BUILDER MARKET"}</span><h1>{isGaming ? "Make your next move." : "Find useful work."}</h1></div><Store size={30} /></div>
      <div className="experience-market-grid">
        {sections.map(([title, body]) => <article key={title}><div className="experience-market-icon"><Layers3 size={17} /></div><h3>{title}</h3><p>{body}</p><button type="button" onClick={() => onNavigate(isGaming ? "community" : "search")}>Open workspace <ArrowUpRight size={14} /></button></article>)}
      </div>
      <div className="experience-market-note"><Users size={16} /> Matching and verification will appear here as the relevant platform integrations are connected.</div>
      <style>{`.experience-market-content{width:min(100%,1060px);margin:0 auto;padding:28px 0 60px}.experience-market-title{display:flex;align-items:center;justify-content:space-between;padding:30px 0 24px;color:var(--experience-accent)}.experience-market-title span{font-size:10px;font-weight:900;letter-spacing:.16em}.experience-market-title h1{margin:10px 0 0;color:#f4f8ff;font-family:'Syne',sans-serif;font-size:clamp(28px,5vw,54px);line-height:1.02}.experience-market-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.experience-market-grid article{padding:20px;border:1px solid color-mix(in srgb,var(--experience-accent) 22%,transparent);border-radius:14px;background:rgba(255,255,255,.035);transition:transform .2s,border-color .2s}.experience-market-grid article:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--experience-accent) 60%,transparent)}.experience-market-icon{display:flex;align-items:center;justify-content:center;width:34px;height:34px;margin-bottom:18px;border-radius:9px;background:color-mix(in srgb,var(--experience-accent) 12%,transparent);color:var(--experience-accent)}.experience-market-grid h3{margin:0 0 7px;font-size:15px}.experience-market-grid p{min-height:48px;margin:0 0 18px;color:#92a0ad;font-size:12px;line-height:1.55}.experience-market-grid button{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--experience-accent) 32%,transparent);border-radius:8px;background:transparent;color:#eaf4ff;font:700 11px inherit;cursor:pointer}.experience-market-note{display:flex;align-items:center;gap:9px;margin-top:18px;padding:13px 15px;border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#82919d;font-size:11px}.experience-market-note svg{color:var(--experience-accent)}@media(max-width:700px){.experience-market-grid{grid-template-columns:1fr}.experience-market-grid p{min-height:auto}}
      `}</style>
    </div>
  );
}
