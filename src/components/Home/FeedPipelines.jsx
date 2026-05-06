// src/components/Home/FeedPipelines.jsx
//
// ═══════════════════════════════════════════════════════════════════════════
// FEED PIPELINES — Instagram/X/Facebook-style injected feed units
// ───────────────────────────────────────────────────────────────────────────
//
// Three pipeline types randomly injected into PostTab every 15–30 posts:
//
// [PIPELINE-FOLLOWS]  "People you might know" — horizontal scroll strip.
//                     Fetches from follows graph (who your followings follow).
//                     Tapping a card opens their profile.
//
// [PIPELINE-REELS]    "Trending Reels" — horizontal scroll strip showing
//                     hot reels. Tapping navigates to the Reels tab.
//
// [PIPELINE-NEWS]     "Breaking Now" — real-time global news fetched fresh
//                     from your newsService. Tapping navigates to News tab.
//
// Each pipeline is a self-contained component with its own data fetching,
// skeleton loading (shown only on first mount, never again once loaded),
// and navigation callbacks. The parent PostTab calls useFeedInjections()
// to get a stable injection map: { postIndex → pipelineType }.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Users,
  Film,
  Newspaper,
  UserPlus,
  Check,
  Play,
  Radio,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import reelService from "../../services/home/reelService";
import newsService from "../../services/news/newsService";
import followService from "../../services/social/followService";

// ─── Pipeline types ──────────────────────────────────────────────────────────
export const PIPELINE = {
  FOLLOWS: "follows",
  REELS: "reels",
  NEWS: "news",
};

// ─── Injection strategy ───────────────────────────────────────────────────────
// Returns a stable map of { postIndex → pipelineType } for a given post list.
// Re-computed only when posts.length changes to avoid scroll jank.
export function useFeedInjections(postCount) {
  return useMemo(() => {
    const map = new Map();
    if (postCount < 15) return map;

    const types = [PIPELINE.FOLLOWS, PIPELINE.REELS, PIPELINE.NEWS];
    let cursor = 0;
    let typeIndex = 0;

    // Shuffle the order so each session feels different
    const shuffled = [...types].sort(() => Math.random() - 0.5);

    while (cursor < postCount) {
      // Random gap between 15 and 30
      const gap = 15 + Math.floor(Math.random() * 16);
      cursor += gap;
      if (cursor >= postCount) break;
      map.set(cursor, shuffled[typeIndex % shuffled.length]);
      typeIndex++;
    }

    return map;
  }, [postCount]); // eslint-disable-line
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared strip shell — wraps all three pipelines with consistent chrome
// ═══════════════════════════════════════════════════════════════════════════
const PipelineShell = ({
  icon,
  label,
  badge,
  children,
  accentColor = "#84cc16",
}) => (
  <div className="fp-shell" style={{ "--fp-accent": accentColor }}>
    <div className="fp-header">
      <div className="fp-header-l">
        <span className="fp-dot" />
        {icon}
        <span className="fp-label">{label}</span>
        {badge && <span className="fp-badge">{badge}</span>}
      </div>
    </div>
    <div className="fp-strip">{children}</div>
    <style>{FP_CSS}</style>
  </div>
);

// ─── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = ({ width = 130, height = 160 }) => (
  <div
    className="fp-skel"
    style={{ width, minWidth: width, height }}
    aria-hidden="true"
  />
);

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-FOLLOWS] People you might know
// ═══════════════════════════════════════════════════════════════════════════
const FollowCard = ({ user, currentUserId }) => {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const avatarUrl = user.avatar_id
    ? mediaUrlService.getAvatarUrl(user.avatar_id, 120)
    : null;

  const initials = (user.full_name || user.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const toggle = async (e) => {
    e.stopPropagation();
    if (!currentUserId || loading) return;
    setLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      next
        ? await followService.followUser(currentUserId, user.id)
        : await followService.unfollowUser(currentUserId, user.id);
    } catch {
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-follow-card">
      <div className="fp-avatar-wrap">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.full_name}
            className="fp-avatar-img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="fp-avatar-initials">{initials}</div>
        )}
        {user.verified && <span className="fp-verified">✓</span>}
      </div>
      <div className="fp-follow-name">{user.full_name || user.username}</div>
      <div className="fp-follow-user">@{user.username}</div>
      {user.mutual_count > 0 && (
        <div className="fp-mutual">{user.mutual_count} mutual</div>
      )}
      <button
        className={`fp-follow-btn${following ? " following" : ""}`}
        onClick={toggle}
        disabled={loading}
      >
        {following ? (
          <>
            <Check size={11} />
            <span>Following</span>
          </>
        ) : (
          <>
            <UserPlus size={11} />
            <span>Follow</span>
          </>
        )}
      </button>
    </div>
  );
};

export const FollowsPipeline = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current || !currentUser?.id) return;
    fetched.current = true;

    (async () => {
      try {
        // 1. Get who currentUser follows
        const { data: myFollows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id)
          .limit(30);

        const myFollowingIds = (myFollows || []).map((f) => f.following_id);

        // 2. Get who THEY follow (2nd-degree connections)
        let suggestions = [];
        if (myFollowingIds.length > 0) {
          const { data: secondDegree } = await supabase
            .from("follows")
            .select(
              "following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_id, verified)",
            )
            .in("follower_id", myFollowingIds.slice(0, 10))
            .not(
              "following_id",
              "in",
              `(${[currentUser.id, ...myFollowingIds].join(",")})`,
            )
            .limit(40);

          // Count mutual connections per suggested user
          const mutualMap = new Map();
          (secondDegree || []).forEach((row) => {
            const uid = row.following_id;
            if (!uid) return;
            mutualMap.set(uid, (mutualMap.get(uid) || 0) + 1);
          });

          suggestions = Array.from(
            new Map(
              (secondDegree || [])
                .filter((r) => r.profiles)
                .map((r) => [
                  r.following_id,
                  {
                    ...r.profiles,
                    mutual_count: mutualMap.get(r.following_id) || 0,
                  },
                ]),
            ).values(),
          )
            .sort((a, b) => b.mutual_count - a.mutual_count)
            .slice(0, 12);
        }

        // 3. Fallback: popular / recently active users
        if (suggestions.length < 6) {
          const excludeIds = [
            currentUser.id,
            ...myFollowingIds,
            ...suggestions.map((u) => u.id),
          ];
          const { data: popular } = await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_id, verified")
            .is("deleted_at", null)
            .not("id", "in", `(${excludeIds.join(",")})`)
            .eq("account_status", "active")
            .order("created_at", { ascending: false })
            .limit(12 - suggestions.length);

          suggestions = [
            ...suggestions,
            ...(popular || []).map((u) => ({ ...u, mutual_count: 0 })),
          ];
        }

        setUsers(suggestions.slice(0, 12));
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.id]);

  if (!loading && users.length === 0) return null;

  return (
    <PipelineShell
      icon={<Users size={12} />}
      label="People you might know"
      accentColor="#84cc16"
    >
      {loading
        ? [1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} width={120} height={170} />
          ))
        : users.map((u) => (
            <FollowCard key={u.id} user={u} currentUserId={currentUser?.id} />
          ))}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-REELS] Trending Reels
// ═══════════════════════════════════════════════════════════════════════════
const ReelThumb = ({ reel, onNavigate }) => {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  const thumbUrl = reel.thumbnail_id
    ? mediaUrlService.getImageUrl(reel.thumbnail_id, {
        width: 200,
        quality: "auto:good",
        format: "webp",
        crop: "fill",
        gravity: "auto",
      })
    : null;

  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0));

  return (
    <button
      className="fp-reel-card"
      onClick={() => onNavigate?.("reels", reel)}
      aria-label={reel.caption || "Trending reel"}
    >
      <div className="fp-reel-thumb-wrap">
        {!err && thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="fp-reel-thumb"
            loading="lazy"
            decoding="async"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.18s" }}
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
          />
        ) : (
          <div className="fp-reel-no-thumb">
            <Play
              size={22}
              fill="rgba(255,255,255,0.5)"
              color="rgba(255,255,255,0.5)"
            />
          </div>
        )}
        {/* Poster immediately visible even if image is loading */}
        <div className="fp-reel-overlay" />
        <div className="fp-reel-play-icon">
          <Play size={14} fill="#fff" color="#fff" />
        </div>
        <div className="fp-reel-views">{fmt(reel.views)} views</div>
      </div>
      <div className="fp-reel-caption">
        {reel.caption || reel.category || "Trending"}
      </div>
    </button>
  );
};

export const ReelsPipeline = ({ onNavigate }) => {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const data = await reelService.getReels({ limit: 12 });
        // Sort by views descending — most viral first
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a, b) => (b.views || 0) - (a.views || 0),
        );
        setReels(sorted.slice(0, 10));
      } catch {
        setReels([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!loading && reels.length === 0) return null;

  return (
    <PipelineShell
      icon={<Film size={12} />}
      label="Trending Reels"
      badge="HOT"
      accentColor="#a855f7"
    >
      {loading
        ? [1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} width={118} height={180} />
          ))
        : reels.map((r) => (
            <ReelThumb key={r.id} reel={r} onNavigate={onNavigate} />
          ))}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-NEWS] Breaking Now — real-time global news
// ═══════════════════════════════════════════════════════════════════════════
const NewsThumb = ({ article, onNavigate }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const ago = (() => {
    if (!article.published_at) return "";
    const s = Math.floor((Date.now() - new Date(article.published_at)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  })();

  const isBreaking = article.tier <= 1 || article.liveStatus === "live";

  return (
    <button
      className="fp-news-card"
      onClick={() => onNavigate?.("news", article)}
      aria-label={article.title}
    >
      <div className="fp-news-img-wrap">
        {!imgErr && article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="fp-news-img"
            loading="lazy"
            decoding="async"
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.2s" }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="fp-news-no-img">
            <Newspaper size={20} color="rgba(255,255,255,0.25)" />
          </div>
        )}
        <div className="fp-news-img-overlay" />
        {isBreaking && (
          <div className="fp-news-breaking">
            <Radio size={7} /> BREAKING
          </div>
        )}
        <div className="fp-news-source">{article.source_name}</div>
      </div>
      <div className="fp-news-title">{article.title}</div>
      <div className="fp-news-ago">{ago}</div>
    </button>
  );
};

export const NewsPipeline = ({ onNavigate }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        // Fetch fresh — bypass any stale cache for true real-time feel
        const data = await newsService.getNewsPosts({ limit: 15, offset: 0 });
        const safe = Array.isArray(data) ? data : [];
        // Surface breaking/fresh first
        const sorted = safe.sort((a, b) => {
          const ta = a.tier ?? 99,
            tb = b.tier ?? 99;
          if (ta !== tb) return ta - tb;
          return new Date(b.published_at) - new Date(a.published_at);
        });
        setArticles(sorted.slice(0, 10));
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!loading && articles.length === 0) return null;

  return (
    <PipelineShell
      icon={<Newspaper size={12} />}
      label="Breaking Now"
      badge="LIVE"
      accentColor="#ef4444"
    >
      {loading
        ? [1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} width={190} height={160} />
          ))
        : articles.map((a) => (
            <NewsThumb
              key={a.id || a.url_hash}
              article={a}
              onNavigate={onNavigate}
            />
          ))}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FeedPipeline — the injected component PostTab renders at injection points
// ═══════════════════════════════════════════════════════════════════════════
export const FeedPipeline = ({ type, currentUser, onNavigate }) => {
  switch (type) {
    case PIPELINE.FOLLOWS:
      return <FollowsPipeline currentUser={currentUser} />;
    case PIPELINE.REELS:
      return <ReelsPipeline onNavigate={onNavigate} />;
    case PIPELINE.NEWS:
      return <NewsPipeline onNavigate={onNavigate} />;
    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════
const FP_CSS = `
/* ── Shell ── */
.fp-shell{
  width:100%;
  background:rgba(255,255,255,0.022);
  border-top:1px solid rgba(255,255,255,0.055);
  border-bottom:1px solid rgba(255,255,255,0.055);
  margin:8px 0;
  overflow:hidden;
}
.fp-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px 6px;
}
.fp-header-l{
  display:flex;align-items:center;gap:6px;
  color:rgba(255,255,255,0.45);font-size:11px;font-weight:800;
  letter-spacing:.06em;text-transform:uppercase;
}
.fp-dot{
  width:5px;height:5px;border-radius:50%;
  background:var(--fp-accent,#84cc16);
  flex-shrink:0;
  box-shadow:0 0 6px var(--fp-accent,#84cc16);
  animation:fpPulse 2s ease-in-out infinite;
}
@keyframes fpPulse{0%,100%{opacity:1}50%{opacity:.35}}
.fp-badge{
  background:rgba(239,68,68,0.18);
  border:1px solid rgba(239,68,68,0.35);
  color:#f87171;
  font-size:8px;font-weight:900;letter-spacing:.08em;
  padding:1px 6px;border-radius:999px;
}
.fp-strip{
  display:flex;
  align-items:flex-start;
  gap:10px;
  padding:4px 14px 14px;
  overflow-x:auto;
  scroll-snap-type:x mandatory;
  scrollbar-width:none;
  -webkit-overflow-scrolling:touch;
}
.fp-strip::-webkit-scrollbar{display:none;}

/* ── Skeleton ── */
.fp-skel{
  border-radius:12px;
  flex-shrink:0;
  scroll-snap-align:start;
  background:rgba(255,255,255,0.06);
  animation:fpSkel 1.5s ease-in-out infinite;
}
@keyframes fpSkel{0%,100%{opacity:.5}50%{opacity:.15}}

/* ── Follow cards ── */
.fp-follow-card{
  width:120px;min-width:120px;
  display:flex;flex-direction:column;align-items:center;
  gap:5px;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(255,255,255,0.07);
  border-radius:14px;
  padding:14px 10px 12px;
  flex-shrink:0;
  scroll-snap-align:start;
  transition:border-color .2s,background .2s;
}
.fp-follow-card:hover{
  background:rgba(255,255,255,0.055);
  border-color:rgba(132,204,22,0.2);
}
.fp-avatar-wrap{
  position:relative;
  width:58px;height:58px;
}
.fp-avatar-img{
  width:58px;height:58px;
  border-radius:50%;
  object-fit:cover;
  border:2px solid rgba(255,255,255,0.1);
  display:block;
}
.fp-avatar-initials{
  width:58px;height:58px;
  border-radius:50%;
  background:linear-gradient(135deg,rgba(132,204,22,0.3),rgba(132,204,22,0.1));
  border:2px solid rgba(132,204,22,0.25);
  display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:800;color:#a3e635;
}
.fp-verified{
  position:absolute;bottom:0;right:0;
  width:16px;height:16px;
  background:#3b82f6;
  border-radius:50%;
  border:2px solid #080808;
  display:flex;align-items:center;justify-content:center;
  font-size:8px;color:#fff;font-weight:900;
}
.fp-follow-name{
  font-size:12px;font-weight:700;color:rgba(255,255,255,0.82);
  text-align:center;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  width:100%;
}
.fp-follow-user{
  font-size:10px;color:rgba(255,255,255,0.32);
  text-align:center;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  width:100%;
}
.fp-mutual{
  font-size:9px;color:rgba(132,204,22,0.7);font-weight:600;
  text-align:center;
}
.fp-follow-btn{
  display:inline-flex;align-items:center;gap:4px;
  padding:5px 12px;border-radius:999px;
  font-size:10.5px;font-weight:700;
  cursor:pointer;font-family:inherit;
  background:rgba(132,204,22,0.12);
  border:1px solid rgba(132,204,22,0.3);
  color:#a3e635;
  transition:all .18s;
  margin-top:2px;
  width:100%;justify-content:center;
}
.fp-follow-btn:hover:not(:disabled){
  background:rgba(132,204,22,0.22);
  border-color:rgba(132,204,22,0.5);
}
.fp-follow-btn.following{
  background:rgba(255,255,255,0.05);
  border-color:rgba(255,255,255,0.12);
  color:rgba(255,255,255,0.45);
}
.fp-follow-btn:disabled{opacity:.6;cursor:default;}

/* ── Reel cards ── */
.fp-reel-card{
  width:118px;min-width:118px;
  display:flex;flex-direction:column;gap:6px;
  background:transparent;border:none;padding:0;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.fp-reel-thumb-wrap{
  position:relative;
  width:118px;height:186px;
  border-radius:12px;overflow:hidden;
  background:#0a0a0a;
  border:1px solid rgba(255,255,255,0.07);
}
.fp-reel-card:hover .fp-reel-thumb-wrap{
  border-color:rgba(168,85,247,0.35);
}
.fp-reel-thumb{
  width:100%;height:100%;object-fit:cover;display:block;
}
.fp-reel-no-thumb{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1a0a2e,#0d0014);
}
.fp-reel-overlay{
  position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.85) 100%);
  pointer-events:none;
}
.fp-reel-play-icon{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  width:36px;height:36px;
  border-radius:50%;
  background:rgba(0,0,0,0.5);
  border:1.5px solid rgba(255,255,255,0.4);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(6px);
  opacity:0;
  transition:opacity .2s;
}
.fp-reel-card:hover .fp-reel-play-icon{opacity:1;}
.fp-reel-views{
  position:absolute;bottom:6px;left:7px;
  font-size:9px;font-weight:700;color:rgba(255,255,255,0.75);
  text-shadow:0 1px 4px rgba(0,0,0,0.8);
}
.fp-reel-caption{
  font-size:11px;font-weight:700;
  color:rgba(255,255,255,0.65);
  line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  padding:0 2px;
}

/* ── News cards ── */
.fp-news-card{
  width:190px;min-width:190px;
  display:flex;flex-direction:column;gap:6px;
  background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:12px;overflow:hidden;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;
  padding:0;
  transition:border-color .18s,background .18s;
  -webkit-tap-highlight-color:transparent;
}
.fp-news-card:hover{
  border-color:rgba(239,68,68,0.3);
  background:rgba(255,255,255,0.04);
}
.fp-news-img-wrap{
  position:relative;
  width:100%;height:108px;
  overflow:hidden;
  background:#111;
  flex-shrink:0;
}
.fp-news-img{
  width:100%;height:100%;object-fit:cover;display:block;
}
.fp-news-no-img{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  background:#111;
}
.fp-news-img-overlay{
  position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.7) 100%);
  pointer-events:none;
}
.fp-news-breaking{
  position:absolute;top:6px;left:6px;
  display:inline-flex;align-items:center;gap:4px;
  background:rgba(239,68,68,0.95);
  color:#fff;font-size:8px;font-weight:900;letter-spacing:.07em;
  padding:2px 7px;border-radius:4px;
  animation:fpBreaking 1.4s ease-in-out infinite;
}
@keyframes fpBreaking{0%,100%{opacity:1}50%{opacity:.7}}
.fp-news-source{
  position:absolute;bottom:5px;right:7px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.5);
  text-shadow:0 1px 3px rgba(0,0,0,0.9);
  max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fp-news-title{
  font-size:11.5px;font-weight:700;
  color:rgba(255,255,255,0.82);
  line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  padding:0 10px;
}
.fp-news-ago{
  font-size:10px;color:rgba(255,255,255,0.3);font-weight:600;
  padding:0 10px 10px;
}

/* Mobile */
@media(max-width:768px){
  .fp-strip{padding:4px 12px 12px;gap:9px;}
  .fp-header{padding:8px 12px 5px;}
}
`;
