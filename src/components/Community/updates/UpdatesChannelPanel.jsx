import React, { useCallback, useEffect, useState } from "react";
import { MessageCircle, Radio, RefreshCw, Smile } from "lucide-react";
import socialUpdatesService from "../../../services/community/socialUpdatesService";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import { getPlatformCapabilities } from "../../../services/community/platformCapabilities";

const QUICK_REACTIONS = ["❤️", "🔥", "🟢🔥", "🔵🔥", "🟣🔥", "🟡🔥", "👏", "😂"];
const PROVIDER_ACCENTS = {
  xeevia: "#9cff00",
  x: "#e7edf4",
  facebook: "#1877f2",
  instagram: "#e1306c",
  youtube: "#ff0033",
  twitch: "#a970ff",
  kick: "#53fc18",
  discord: "#5865f2",
  reddit: "#ff4500",
  telegram: "#2aabee",
  github: "#d1d5db",
  linkedin: "#0a66c2",
  snapchat: "#fffc00",
};
const getProviderLabel = (provider) => getPlatformCapabilities(provider)?.label
  || (provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Community source");

export default function UpdatesChannelPanel({ channelId, onReply, canAddReactions = true, userId, focusPostId = null }) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [reactionPost, setReactionPost] = useState(null);
  const [reactions, setReactions] = useState({});

  const load = useCallback(async () => {
    try {
      setError("");
      setPosts(await socialUpdatesService.listPosts(channelId));
    } catch (err) {
      setError(err.message || "Could not load updates");
    }
  }, [channelId]);

  useEffect(() => {
    if (channelId) load();
  }, [channelId, load]);

  useEffect(() => {
    if (!focusPostId || !posts.length) return;
    let element = null;
    let settleFrame;
    const frame = requestAnimationFrame(() => {
      settleFrame = requestAnimationFrame(() => {
        element = document.querySelector(`[data-post-id="${focusPostId}"]`);
        if (!element) return;
        element.classList.add("post-navigation-target");
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
    });
    const highlightTimeout = setTimeout(() => element?.classList.remove("post-navigation-target"), 2200);
    return () => {
      cancelAnimationFrame(frame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      clearTimeout(highlightTimeout);
      element?.classList.remove("post-navigation-target");
    };
  }, [focusPostId, posts]);

  return (
    <section className="updates-panel">
      <div className="updates-head">
        <div className="updates-icon"><Radio size={21} /></div>
        <div>
          <span>Community updates</span>
          <h1>Latest from connected sources</h1>
          <p>Official updates arrive here automatically.</p>
        </div>
        <button className="updates-refresh" onClick={load} title="Refresh" aria-label="Refresh updates">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="updates-feed">
        {posts.length === 0 ? (
          <div className="updates-empty">No updates have been published yet.</div>
        ) : (
          posts.map((post) => (
            <article
              className={`updates-post updates-provider-${String(post.provider || "").toLowerCase().replace(/[^a-z0-9_-]/g, "")}`}
              key={post.id}
              data-post-id={post.id}
              data-provider={String(post.provider || "community").toLowerCase()}
              aria-label={`Update from ${getProviderLabel(String(post.provider || "").toLowerCase())}`}
              style={{ "--updates-provider-color": PROVIDER_ACCENTS[String(post.provider || "").toLowerCase()] || "#9cff00" }}
            >
              <div className="updates-post-source">{getProviderLabel(String(post.provider || "").toLowerCase())}</div>
              <h2>{post.content || "New update"}</h2>
              {post.activity_type === "video" && post.media?.url && (
                <video aria-label="Update video" controls preload="metadata" src={post.media.url} />
              )}
              {post.media?.video_ids?.filter(Boolean).map((videoId) => (
                <video key={videoId} aria-label="Update video" controls preload="metadata" src={mediaUrlService.getVideoUrl(videoId, { quality: "auto", format: "mp4" })} />
              ))}
              {[...(post.media?.image_urls || []), ...(post.media?.url && post.activity_type !== "video" ? [post.media.url] : [])]
                .filter(Boolean)
                .map((imageUrl) => <img key={imageUrl} src={imageUrl} alt="Social media update" loading="lazy" />)}
              {post.media?.image_ids?.filter(Boolean).map((imageId) => (
                <img key={imageId} src={mediaUrlService.getImageUrl(imageId, { width: 900, quality: "auto:good", format: "auto" })} alt="Social media update" loading="lazy" />
              ))}
              {post.media?.thumbnail && !post.media?.image_ids?.length && <img src={post.media.thumbnail} alt="Social media update" loading="lazy" />}
              {post.media?.image && !post.media?.image_ids?.length && <img src={post.media.image} alt="Social media update" loading="lazy" />}
              <div className="updates-post-meta">
                <span>{post.author_name || "Official source"}</span>
                {post.published_at && <span>{` · ${new Date(post.published_at).toLocaleString()}`}</span>}
                {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer">Open source</a>}
              </div>
              <div className="updates-post-actions">
                <button type="button" className="updates-action" onClick={() => onReply?.({ id: post.id, title: post.provider || "Community update", channelName: "updates", content: post.content || "New update", user: { full_name: post.author_name || "Official source" }, externalPost: true })}>
                  <MessageCircle size={14} /> Reply in general
                </button>
                <div className="updates-reaction-wrap">
                  {reactionPost === post.id && <div className="updates-reaction-picker">{QUICK_REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => { setReactions((current) => { const postReactions = { ...(current[post.id] || {}) }; const entry = postReactions[emoji] || { count: 0, users: [] }; const reacted = entry.users.includes(userId); entry.users = reacted ? entry.users.filter((id) => id !== userId) : [...entry.users, userId]; entry.count = entry.users.length; if (!entry.count) delete postReactions[emoji]; return { ...current, [post.id]: postReactions }; }); setReactionPost(null); }}>{emoji}</button>)}</div>}
                  <button type="button" className="updates-action reaction" onClick={() => canAddReactions && setReactionPost((current) => current === post.id ? null : post.id)} disabled={!canAddReactions} aria-label="React to update" title="React to update"><Smile size={14} /> React</button>
                </div>
              </div>
              {Object.entries(reactions[post.id] || {}).length > 0 && <div className="updates-reaction-list">{Object.entries(reactions[post.id]).map(([emoji, entry]) => <span key={emoji}>{emoji} {entry.count}</span>)}</div>}
            </article>
          ))
        )}
      </div>

      {error && <div className="updates-error">{error}</div>}

      <style>{`
        .updates-panel { width: min(96%, 760px); box-sizing: border-box; margin: 14px auto; padding: 15px; border: 1px solid rgba(156,255,0,.18); border-radius: 16px; background: linear-gradient(145deg, #121612, #080b09); color: #eef6eb; box-shadow: 0 14px 36px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.035); }
        .updates-head { display: flex; align-items: flex-start; gap: 10px; }
        .updates-icon { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: #b6ed7e; background: rgba(156,255,0,.08); border: 1px solid rgba(156,255,0,.22); flex-shrink: 0; }
        .updates-head span { font-size: calc((10px) + 1px); color: #b6ed7e; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
        .updates-panel h1 { margin: 3px 0; font-size: calc((18px) + 1px); }
        .updates-panel p { margin: 0; color: #9da99c; font-size: calc((12px) + 1px); }
        .updates-refresh { margin-left: auto; border: 0; background: transparent; color: #8e9a8b; cursor: pointer; }
        .updates-feed { margin-top: 12px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; }
        .updates-empty { padding: 14px 0; color: #8a9588; font-size: calc((12px) + 1px); }
        .updates-post { margin-top: 7px; padding: 10px; border-radius: 10px; background: linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.018)); border: 1px solid color-mix(in srgb,var(--updates-provider-color,#9cff00) 32%,rgba(255,255,255,.08)); border-left: 3px solid var(--updates-provider-color,#9cff00); box-shadow: inset 0 1px 0 color-mix(in srgb,var(--updates-provider-color,#9cff00) 8%,transparent); }
        .updates-post>img,.updates-post>video { display:block; width:100%; max-height:340px; margin-top:8px; border-radius:8px; object-fit:contain; background:#050708; }
        .updates-post.post-navigation-target { border-color: var(--updates-provider-color,#9cff00); animation: updatesTargetPulse 2.2s cubic-bezier(.22,.61,.36,1); }
        @keyframes updatesTargetPulse { 0% { box-shadow: 0 0 0 0 rgba(156,255,0,0), 0 0 0 rgba(156,255,0,0); } 35% { box-shadow: 0 0 0 4px rgba(156,255,0,.24), 0 0 30px rgba(156,255,0,.3); } 100% { box-shadow: 0 0 0 2px rgba(156,255,0,.1), 0 0 18px rgba(156,255,0,.16); } }
        .updates-post-source { display:flex;align-items:center;gap:6px;color:var(--updates-provider-color,#9cff00);font-size:calc((9px) + 1px);text-transform:uppercase;font-weight:800;letter-spacing:.06em }
        .updates-post-source:before { width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--updates-provider-color,#9cff00);box-shadow:0 0 10px color-mix(in srgb,var(--updates-provider-color,#9cff00) 48%,transparent);content:""; }
        .updates-post h2 { margin: 5px 0; font-size: calc((14px) + 1px); }
        .updates-post-meta { display: flex; gap: 8px; color: #899487; font-size: calc((10px) + 1px); }
        .updates-post-meta a { color: var(--updates-provider-color,#b6ed7e); margin-left: auto; }
        .updates-post-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 9px; padding-top: 7px; border-top: 1px solid rgba(255,255,255,.07); }
        .updates-action { display: inline-flex; align-items: center; gap: 6px; color: #bac5b7; background: transparent; border: 0; padding: 5px 7px; border-radius: 7px; font: 700 10px inherit; cursor: pointer; }
        .updates-action:hover:not(:disabled) { color: #9cff00; background: rgba(156,255,0,.08); }
        .updates-action:disabled { opacity: .45; cursor: not-allowed; }
        .updates-reaction-wrap { position: relative; }
        .updates-reaction-picker { position: absolute; right: 0; bottom: 34px; display: flex; gap: 3px; padding: 5px; background: #101310; border: 1px solid rgba(156,255,0,.2); border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
        .updates-reaction-picker button { width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent; font-size: calc((16px) + 1px); cursor: pointer; }
        .updates-reaction-picker button:hover { background: rgba(156,255,0,.1); transform: translateY(-2px); }
        .updates-reaction-list { display: flex; gap: 5px; margin-top: 8px; }
        .updates-reaction-list span { padding: 3px 7px; color: #d8e6d1; background: rgba(156,255,0,.07); border: 1px solid rgba(156,255,0,.17); border-radius: 12px; font-size: calc((11px) + 1px); }
        .updates-error { margin-top: 12px; color: #ffaaa3; font-size: calc((11px) + 1px); }
        @media (max-width: 768px) { .updates-panel { width: calc(100% - 24px); margin: 10px auto; padding: 12px; border-radius: 13px; } .updates-head { gap: 8px; } .updates-icon { width: 34px; height: 34px; border-radius: 10px; } .updates-panel h1 { font-size: 16px; } .updates-feed { margin-top: 10px; padding-top: 8px; } .updates-post { padding: 9px; } }
      `}</style>
    </section>
  );
}
