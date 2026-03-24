// src/components/Modals/UserProfileModal.jsx
// ============================================================================
// BOOST VISUAL EDITION — fixes: full-width card, close btn inside card
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  X,
  UserPlus,
  UserCheck,
  Loader,
  Shield,
  Crown,
  Image,
  Film,
  BookOpen,
  Heart,
  Eye,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import followService from "../../services/social/followService";
import {
  BOOST_VISUAL,
  getTierBadge,
} from "../../services/account/profileTierService";
import BoostProfileCard from "../Boost/BoostProfileCard";
import BoostAvatarRing from "../Shared/BoostAvatarRing";

const TIER_COLORS = { silver: "#d4d4d4", gold: "#fbbf24", diamond: "#a78bfa" };
const DIAMOND_THEMES = {
  "diamond-cosmos": "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose": "#f472b6",
  "diamond-void": "#e5e5e5",
};
const getTierColor = (tier, themeId) => {
  if (!tier || !TIER_COLORS[tier]) return "#ffffff";
  if (tier === "diamond" && themeId && DIAMOND_THEMES[themeId])
    return DIAMOND_THEMES[themeId];
  return TIER_COLORS[tier];
};

const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.floor(v));
};

const TierBadgePill = ({ tier, paymentStatus }) => {
  const b = getTierBadge(tier, paymentStatus);
  if (!b) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 800,
        color: b.color,
        background: `${b.color}18`,
        border: `1px solid ${b.color}35`,
        boxShadow: `0 0 6px ${b.glow}`,
        flexShrink: 0,
      }}
    >
      {b.emoji} {b.label}
    </span>
  );
};

const ContentCard = ({ item, type }) => {
  const imgUrl = item.image_ids?.[0]
    ? mediaUrlService.getImageUrl(item.image_ids[0], { width: 200 })
    : item.cover_image_id
      ? mediaUrlService.getStoryImageUrl(item.cover_image_id, 200)
      : item.thumbnail_id
        ? mediaUrlService.getVideoThumbnail(item.thumbnail_id, { width: 200 })
        : null;
  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        aspectRatio: "1",
        position: "relative",
      }}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(132,204,22,0.05)",
          }}
        >
          {type === "reel" ? (
            <Film size={22} color="#84cc16" opacity={0.3} />
          ) : type === "story" ? (
            <BookOpen size={22} color="#84cc16" opacity={0.3} />
          ) : (
            <Image size={22} color="#84cc16" opacity={0.3} />
          )}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background:
            "linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%)",
          padding: "5px 5px 4px",
          display: "flex",
          gap: 6,
          fontSize: 9,
          color: "rgba(255,255,255,0.8)",
          fontWeight: 600,
        }}
      >
        {item.likes > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Heart size={8} />
            {fmt(item.likes)}
          </span>
        )}
        {item.views > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Eye size={8} />
            {fmt(item.views)}
          </span>
        )}
      </div>
      {type === "reel" && (
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            background: "rgba(0,0,0,0.5)",
            borderRadius: 4,
            padding: "1px 4px",
            fontSize: 8,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          ▶
        </div>
      )}
    </div>
  );
};

const UserProfileModal = ({ user, currentUser, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [stories, setStories] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [stats, setStats] = useState({
    posts: 0,
    reels: 0,
    stories: 0,
    followers: 0,
    following: 0,
  });

  const mounted = useRef(true);
  const targetId = user?.id || user?.user_id || user?.userId;
  const myId = currentUser?.id;
  const isOwn = myId && targetId === myId;

  useEffect(() => {
    mounted.current = true;
    if (targetId) loadProfile();
    return () => {
      mounted.current = false;
    };
  }, [targetId]); // eslint-disable-line

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id,full_name,username,avatar_id,bio,verified,is_pro,subscription_tier,payment_status,boost_selections,created_at",
        )
        .eq("id", targetId)
        .maybeSingle();

      const raw = p || {};
      let avatarUrl = null;
      if (raw.avatar_id) {
        const base = mediaUrlService.getAvatarUrl(raw.avatar_id, 300);
        if (base && typeof base === "string") {
          const clean = base.split("?")[0];
          avatarUrl = clean.includes("supabase")
            ? `${clean}?quality=100&width=300&height=300&resize=cover&format=webp`
            : base;
        }
      } else if (
        user?.avatar &&
        typeof user.avatar === "string" &&
        user.avatar.startsWith("http")
      ) {
        avatarUrl = user.avatar;
      }

      if (mounted.current)
        setProfile({
          id: targetId,
          fullName: raw.full_name || user?.name || user?.author || "Unknown",
          username: raw.username || user?.username || "unknown",
          avatarUrl,
          bio: raw.bio || null,
          verified: raw.verified || user?.verified || false,
          isPro: raw.is_pro || false,
          joinDate: raw.created_at
            ? new Date(raw.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            : null,
          subscriptionTier:
            raw.subscription_tier ?? user?.subscription_tier ?? "standard",
          paymentStatus:
            raw.payment_status ?? user?.payment_status ?? "pending",
          themeId: raw.boost_selections?.themeId ?? null,
        });

      const [postsR, reelsR, storiesR, followersR, followingR] =
        await Promise.allSettled([
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", targetId)
            .is("deleted_at", null),
          supabase
            .from("reels")
            .select("*", { count: "exact", head: true })
            .eq("user_id", targetId)
            .is("deleted_at", null),
          supabase
            .from("stories")
            .select("*", { count: "exact", head: true })
            .eq("user_id", targetId)
            .is("deleted_at", null),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", targetId),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", targetId),
        ]);
      if (mounted.current)
        setStats({
          posts: postsR.status === "fulfilled" ? (postsR.value.count ?? 0) : 0,
          reels: reelsR.status === "fulfilled" ? (reelsR.value.count ?? 0) : 0,
          stories:
            storiesR.status === "fulfilled" ? (storiesR.value.count ?? 0) : 0,
          followers:
            followersR.status === "fulfilled"
              ? (followersR.value.count ?? 0)
              : 0,
          following:
            followingR.status === "fulfilled"
              ? (followingR.value.count ?? 0)
              : 0,
        });

      if (myId && !isOwn)
        followService
          .isFollowing(myId, targetId)
          .then((v) => {
            if (mounted.current) setIsFollowing(v);
          })
          .catch(() => {});
      loadContent("posts");
    } catch (e) {
      console.warn("[UserProfileModal]", e?.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const loadContent = async (tab) => {
    setContentLoading(true);
    try {
      if (tab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select(
            "id,content,image_ids,video_ids,likes,views,comments_count,created_at",
          )
          .eq("user_id", targetId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(12);
        if (mounted.current) setPosts(data || []);
      } else if (tab === "reels") {
        const { data } = await supabase
          .from("reels")
          .select(
            "id,caption,thumbnail_id,video_id,likes,views,comments_count,created_at",
          )
          .eq("user_id", targetId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(12);
        if (mounted.current) setReels(data || []);
      } else {
        const { data } = await supabase
          .from("stories")
          .select(
            "id,title,cover_image_id,likes,views,comments_count,created_at",
          )
          .eq("user_id", targetId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(12);
        if (mounted.current) setStories(data || []);
      }
    } catch (e) {
      console.warn("[UserProfileModal] content:", e?.message);
    } finally {
      if (mounted.current) setContentLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadContent(tab);
  };

  const handleFollow = useCallback(
    async (e) => {
      e.stopPropagation();
      if (!myId || isOwn || followLoading) return;
      const next = !isFollowing;
      setIsFollowing(next);
      setFollowLoading(true);
      setStats((s) => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
      try {
        if (next) await followService.followUser(myId, targetId);
        else await followService.unfollowUser(myId, targetId);
      } catch {
        setIsFollowing(!next);
        setStats((s) => ({ ...s, followers: s.followers + (next ? -1 : 1) }));
      } finally {
        if (mounted.current) setFollowLoading(false);
      }
    },
    [myId, targetId, isOwn, isFollowing, followLoading],
  );

  const tier = profile?.subscriptionTier ?? "standard";
  const themeId = profile?.themeId ?? null;
  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const nameColor = hasBoosted ? getTierColor(tier, themeId) : "#ffffff";
  const glowColor = hasBoosted ? `${nameColor}50` : "transparent";
  const v = hasBoosted ? BOOST_VISUAL[tier] : null;
  const currentContent =
    activeTab === "posts" ? posts : activeTab === "reels" ? reels : stories;

  return ReactDOM.createPortal(
    <div
      className="upm-bd"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="upm-sheet">
        {loading ? (
          <div className="upm-load">
            <div className="upm-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <>
            {/* Full-width boost card — close button sits inside it */}
            <BoostProfileCard
              tier={hasBoosted ? tier : null}
              themeId={themeId}
              style={{ borderRadius: "20px 20px 0 0", position: "relative" }}
            >
              {/* Close — inside the card so it's over the themed background */}
              <button className="upm-close" onClick={onClose}>
                <X size={16} />
              </button>

              <div className="upm-hdr">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <BoostAvatarRing
                    userId={targetId}
                    tier={hasBoosted ? tier : null}
                    themeId={hasBoosted ? themeId : null}
                    size={84}
                    src={
                      profile?.avatarUrl &&
                      (profile.avatarUrl.startsWith("http") ||
                        profile.avatarUrl.startsWith("blob:"))
                        ? profile.avatarUrl
                        : null
                    }
                    letter={(profile?.fullName || "U").charAt(0).toUpperCase()}
                    showBadge={hasBoosted}
                    badgeSize="md"
                    borderRadius="circle"
                  />
                </div>
                <h2
                  className="upm-name"
                  style={{
                    color: nameColor,
                    textShadow: hasBoosted ? `0 0 24px ${glowColor}` : "none",
                  }}
                >
                  {profile?.fullName || "Unknown"}
                </h2>
                <div className="upm-badges">
                  {profile?.isPro && (
                    <span className="upm-b-pro">
                      <Crown size={9} /> PRO
                    </span>
                  )}
                  {profile?.verified && (
                    <span className="upm-b-ver">
                      <Shield size={9} /> Verified
                    </span>
                  )}
                  <TierBadgePill
                    tier={tier}
                    paymentStatus={profile?.paymentStatus}
                  />
                </div>
                <p
                  className="upm-uname"
                  style={{
                    color: hasBoosted
                      ? `${nameColor}80`
                      : "rgba(255,255,255,0.5)",
                  }}
                >
                  @{profile?.username || "unknown"}
                </p>
                {profile?.bio && <p className="upm-bio">{profile.bio}</p>}
                {profile?.joinDate && (
                  <p className="upm-join">Joined {profile.joinDate}</p>
                )}
              </div>
            </BoostProfileCard>

            {/* Stats */}
            <div className="upm-stats">
              <div className="upm-stat">
                <span className="upm-sv">
                  {fmt(stats.posts + stats.reels + stats.stories)}
                </span>
                <span className="upm-sl">Posts</span>
              </div>
              <div className="upm-sdiv" />
              <div className="upm-stat">
                <span className="upm-sv">{fmt(stats.followers)}</span>
                <span className="upm-sl">Followers</span>
              </div>
              <div className="upm-sdiv" />
              <div className="upm-stat">
                <span className="upm-sv">{fmt(stats.following)}</span>
                <span className="upm-sl">Following</span>
              </div>
            </div>

            {/* Follow */}
            {!isOwn && myId && (
              <div style={{ padding: "14px 20px 0" }}>
                <button
                  className={`upm-fbtn${isFollowing ? " following" : ""}`}
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={
                    hasBoosted && !isFollowing
                      ? {
                          background: `linear-gradient(135deg,${v?.grad?.[0] ?? "#84cc16"},${v?.grad?.[1] ?? "#65a30d"})`,
                          boxShadow: `0 6px 20px ${v?.glow ?? "rgba(132,204,22,0.4)"}`,
                          color: "#000",
                          border: "none",
                        }
                      : hasBoosted && isFollowing
                        ? {
                            borderColor: `${nameColor}45`,
                            color: nameColor,
                            background: `${nameColor}12`,
                          }
                        : {}
                  }
                >
                  {followLoading ? (
                    <Loader
                      size={15}
                      style={{ animation: "upmSpin 0.7s linear infinite" }}
                    />
                  ) : isFollowing ? (
                    <>
                      <UserCheck size={15} /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} /> Follow
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="upm-tabs">
              {[
                {
                  id: "posts",
                  icon: <Image size={14} />,
                  label: "Posts",
                  count: stats.posts,
                },
                {
                  id: "reels",
                  icon: <Film size={14} />,
                  label: "Reels",
                  count: stats.reels,
                },
                {
                  id: "stories",
                  icon: <BookOpen size={14} />,
                  label: "Stories",
                  count: stats.stories,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`upm-tab${activeTab === t.id ? " active" : ""}`}
                  onClick={() => handleTabChange(t.id)}
                  style={
                    activeTab === t.id && hasBoosted
                      ? {
                          color: nameColor,
                          borderBottomColor: nameColor,
                          background: `${nameColor}10`,
                        }
                      : {}
                  }
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className="upm-tc">{fmt(t.count)}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="upm-cnt">
              {contentLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 28,
                  }}
                >
                  <div className="upm-spin-sm" />
                </div>
              ) : currentContent.length > 0 ? (
                <div className="upm-grid">
                  {currentContent.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      type={
                        activeTab === "reels"
                          ? "reel"
                          : activeTab === "stories"
                            ? "story"
                            : "post"
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="upm-empty">
                  {activeTab === "posts" ? (
                    <Image size={32} opacity={0.2} />
                  ) : activeTab === "reels" ? (
                    <Film size={32} opacity={0.2} />
                  ) : (
                    <BookOpen size={32} opacity={0.2} />
                  )}
                  <p>No {activeTab} yet</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .upm-bd{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px 16px;animation:upmFI .2s ease}
        .upm-sheet{position:relative;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;border-radius:20px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 80px rgba(0,0,0,.9);animation:upmSU .25s cubic-bezier(.34,1.4,.64,1);scrollbar-width:none}
        .upm-sheet::-webkit-scrollbar{display:none}
        .upm-close{position:absolute;top:14px;right:14px;z-index:20;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}
        .upm-close:hover{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.45);color:#ef4444}
        .upm-load{padding:60px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;color:#525252;font-size:13px}
        .upm-spin{width:36px;height:36px;border:3px solid rgba(132,204,22,.2);border-top-color:#84cc16;border-radius:50%;animation:upmSpin .8s linear infinite}
        .upm-spin-sm{width:22px;height:22px;border:2px solid rgba(132,204,22,.2);border-top-color:#84cc16;border-radius:50%;animation:upmSpin .8s linear infinite}
        .upm-hdr{padding:44px 24px 24px;text-align:center;position:relative}
        .upm-name{font-size:22px;font-weight:900;margin:0 0 8px;transition:color .3s}
        .upm-badges{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
        .upm-b-pro{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;color:#fbbf24;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.35)}
        .upm-b-ver{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;color:#84cc16;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.3)}
        .upm-uname{font-size:13px;font-weight:600;margin:0 0 10px;transition:color .3s}
        .upm-bio{font-size:13px;color:#a3a3a3;line-height:1.5;margin:0 0 8px;max-width:320px;margin-left:auto;margin-right:auto}
        .upm-join{font-size:11px;color:#525252;font-weight:500;margin:0}
        .upm-stats{display:flex;align-items:stretch;background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}
        .upm-stat{flex:1;padding:14px 8px;text-align:center;display:flex;flex-direction:column;gap:3}
        .upm-sv{font-size:18px;font-weight:900;background:linear-gradient(135deg,#84cc16,#65a30d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .upm-sl{font-size:10px;color:#737373;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
        .upm-sdiv{width:1px;margin:10px 0;background:rgba(255,255,255,.07)}
        .upm-fbtn{width:100%;padding:11px 20px;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;background:linear-gradient(135deg,#84cc16,#65a30d);color:#000;border:none;box-shadow:0 6px 20px rgba(132,204,22,.4)}
        .upm-fbtn.following{background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.3);color:#84cc16;box-shadow:none}
        .upm-fbtn.following:hover{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.35);color:#ef4444}
        .upm-fbtn:disabled{opacity:.6;cursor:default}
        .upm-tabs{display:flex;padding:14px 16px 0;gap:6px}
        .upm-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 6px;border-radius:10px 10px 0 0;font-size:12px;font-weight:700;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .18s;background:rgba(255,255,255,.03);color:#525252}
        .upm-tab.active{background:rgba(132,204,22,.08);color:#84cc16;border-bottom-color:#84cc16}
        .upm-tc{font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(255,255,255,.07);color:#737373}
        .upm-cnt{padding:10px 14px 20px;min-height:100px}
        .upm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .upm-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:30px;color:#525252;font-size:13px}
        @keyframes upmFI{from{opacity:0}to{opacity:1}}
        @keyframes upmSU{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes upmSpin{to{transform:rotate(360deg)}}
      `}</style>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
