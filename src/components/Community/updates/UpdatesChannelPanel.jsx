import React, { useEffect, useState } from "react";
import { MessageCircle, Radio, RefreshCw, Smile } from "lucide-react";
import socialUpdatesService from "../../../services/community/socialUpdatesService";

const QUICK_REACTIONS = ["❤️", "🔥", "👏", "😂"];

export default function UpdatesChannelPanel({ channelId, onReply, canAddReactions = true, userId, focusPostId = null }) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [reactionPost, setReactionPost] = useState(null);
  const [reactions, setReactions] = useState({});

  const load = async () => {
    try {
      setError("");
      setPosts(await socialUpdatesService.listPosts(channelId));
    } catch (err) {
      setError(err.message || "Could not load updates");
    }
  };

  useEffect(() => {
    if (channelId) load();
  }, [channelId]);

  useEffect(() => {
    if (!focusPostId || !posts.length) return;
    const frame = requestAnimationFrame(() => {
      const element = document.querySelector(`[data-post-id="${focusPostId}"]`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("post-navigation-target");
      setTimeout(() => element.classList.remove("post-navigation-target"), 1800);
    });
    return () => cancelAnimationFrame(frame);
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
            <article className="updates-post" key={post.id} data-post-id={post.id}>
              <div className="updates-post-source">{post.provider || "Community source"}</div>
              <h2>{post.content || "New update"}</h2>
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
        .updates-panel { max-width: 760px; margin: 26px auto; padding: 24px; border: 1px solid rgba(96,165,250,.2); border-radius: 20px; background: linear-gradient(145deg, rgba(17,28,40,.97), rgba(8,13,18,.99)); color: #eef8ff; }
        .updates-head { display: flex; align-items: flex-start; gap: 14px; }
        .updates-icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: #67e8f9; background: rgba(34,211,238,.1); border: 1px solid rgba(34,211,238,.3); flex-shrink: 0; }
        .updates-head span { font-size: 10px; color: #67e8f9; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
        .updates-panel h1 { margin: 4px 0; font-size: 22px; }
        .updates-panel p { margin: 0; color: #8fa3b5; font-size: 12px; }
        .updates-refresh { margin-left: auto; border: 0; background: transparent; color: #7890a4; cursor: pointer; }
        .updates-feed { margin-top: 20px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 14px; }
        .updates-empty { padding: 20px 0; color: #718493; font-size: 12px; }
        .updates-post { margin-top: 8px; padding: 13px; border-radius: 11px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
        .updates-post.post-navigation-target { border-color: #9cff00; box-shadow: 0 0 0 3px rgba(156,255,0,.18), 0 0 24px rgba(156,255,0,.2); }
        .updates-post-source { color: #67e8f9; font-size: 9px; text-transform: uppercase; font-weight: 800; }
        .updates-post h2 { margin: 5px 0; font-size: 14px; }
        .updates-post-meta { display: flex; gap: 8px; color: #7990a1; font-size: 10px; }
        .updates-post-meta a { color: #a5f3fc; margin-left: auto; }
        .updates-post-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 13px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.07); }
        .updates-action { display: inline-flex; align-items: center; gap: 6px; color: #b7d4e1; background: transparent; border: 0; padding: 5px 7px; border-radius: 7px; font: 700 10px inherit; cursor: pointer; }
        .updates-action:hover:not(:disabled) { color: #9cff00; background: rgba(156,255,0,.08); }
        .updates-action:disabled { opacity: .45; cursor: not-allowed; }
        .updates-reaction-wrap { position: relative; }
        .updates-reaction-picker { position: absolute; right: 0; bottom: 34px; display: flex; gap: 3px; padding: 5px; background: #101b22; border: 1px solid rgba(103,232,249,.24); border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
        .updates-reaction-picker button { width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent; font-size: 16px; cursor: pointer; }
        .updates-reaction-picker button:hover { background: rgba(103,232,249,.12); transform: translateY(-2px); }
        .updates-reaction-list { display: flex; gap: 5px; margin-top: 8px; }
        .updates-reaction-list span { padding: 3px 7px; color: #d8f6ff; background: rgba(103,232,249,.1); border: 1px solid rgba(103,232,249,.2); border-radius: 12px; font-size: 11px; }
        .updates-error { margin-top: 12px; color: #ffaaa3; font-size: 11px; }
        @media (max-width: 600px) { .updates-panel { margin: 14px; padding: 16px; } }
      `}</style>
    </section>
  );
}
