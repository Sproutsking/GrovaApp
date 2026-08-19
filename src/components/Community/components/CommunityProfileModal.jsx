import React, { useEffect, useState } from "react";
import { Crown, MessageCircle, Plus, Shield, UserCheck, UserPlus, UserRound, X } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import mediaUrlService from "../../../services/shared/mediaUrlService";
import followService from "../../../services/social/followService";
import { BOOST_VISUAL } from "../../../services/account/profileTierService";
import { useUserBoostTier } from "../../../hooks/useUserBoostTier";
import BoostProfileCard from "../../Boost/BoostProfileCard";
import BoostAvatarRing from "../../Shared/BoostAvatarRing";

const PIXEL_PALETTES = {
  standard: ["#9cff00", "#38bdf8", "#a78bfa", "#fbbf24"],
  silver: ["#f8fafc", "#cbd5e1", "#94a3b8", "#e2e8f0"],
  gold: ["#fef08a", "#fbbf24", "#f97316", "#fde68a"],
  diamond: ["#f0abfc", "#a78bfa", "#67e8f9", "#f8fafc"],
};

const createPixelPattern = (seed, tier) => {
  let value = Array.from(`${seed || "profile"}-${tier}`).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const palette = PIXEL_PALETTES[tier] || PIXEL_PALETTES.standard;
  return Array.from({ length: 28 }, (_, index) => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return {
      left: `${(value % 96) + 2}%`,
      top: `${(Math.floor(value / 97) % 72) + 6}%`,
      size: `${4 + (value % 7)}px`,
      color: palette[index % palette.length],
      opacity: 0.22 + ((value % 55) / 100),
      delay: `${(value % 1800)}ms`,
    };
  });
};

const CommunityProfileModal = ({
  user,
  community,
  member,
  roles = [],
  canManageRoles = false,
  onAssignRole,
  onOpenProfile,
  onOpenDm,
  currentUserId,
  onClose,
}) => {
  const [memberships, setMemberships] = useState([]);
  const [mutualStats, setMutualStats] = useState({ communities: 0, following: 0, followers: 0 });
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = user?.avatar_id ? mediaUrlService.getAvatarUrl(user.avatar_id, 240) : null;
  const displayName = user?.full_name || user?.username || "Unknown user";
  const isOwnProfile = Boolean(currentUserId && user?.id && currentUserId === user.id);
  const { tier: liveTier, themeId: liveThemeId } = useUserBoostTier(user?.id);
  const tier = liveTier || user?.subscription_tier || null;
  const themeId = liveThemeId || user?.boost_selections?.themeId || null;
  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const boostVisual = hasBoosted ? BOOST_VISUAL?.[tier] : null;
  const pixelTier = hasBoosted ? tier : "standard";
  const pixels = createPixelPattern(user?.id, pixelTier);

  useEffect(() => {
    let active = true;
    const loadMemberships = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("community_members")
        .select("id, role_id, role:community_roles(id, name, color), community:communities(id, name, icon)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });
      if (active) setMemberships(data || []);
    };
    loadMemberships();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const loadMutualStats = async () => {
      if (!currentUserId || !user?.id || currentUserId === user.id) {
        setMutualStats({ communities: 0, following: 0, followers: 0 });
        return;
      }
      const [{ data: mine }, { data: theirs }, { data: myFollowing }, { data: theirFollowing }, { data: myFollowers }, { data: theirFollowers }] = await Promise.all([
        supabase.from("community_members").select("community_id").eq("user_id", currentUserId),
        supabase.from("community_members").select("community_id").eq("user_id", user.id),
        supabase.from("follows").select("following_id").eq("follower_id", currentUserId),
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("follows").select("follower_id").eq("following_id", currentUserId),
        supabase.from("follows").select("follower_id").eq("following_id", user.id),
      ]);
      const intersection = (left = [], right = [], key) => {
        const rightIds = new Set(right.map((item) => item[key]));
        return left.filter((item) => rightIds.has(item[key])).length;
      };
      if (active) setMutualStats({
        communities: intersection(mine, theirs, "community_id"),
        following: intersection(myFollowing, theirFollowing, "following_id"),
        followers: intersection(myFollowers, theirFollowers, "follower_id"),
      });
    };
    loadMutualStats().catch(() => {});
    return () => { active = false; };
  }, [currentUserId, user?.id]);

  useEffect(() => {
    let active = true;
    if (!currentUserId || !user?.id || isOwnProfile) {
      setIsFollowing(false);
      return undefined;
    }
    followService.isFollowing(currentUserId, user.id).then((following) => {
      if (active) setIsFollowing(Boolean(following));
    });
    return () => { active = false; };
  }, [currentUserId, user?.id, isOwnProfile]);

  const handleFollow = async () => {
    if (!currentUserId || !user?.id || isOwnProfile || followLoading) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowLoading(true);
    try {
      const result = next
        ? await followService.followUser(currentUserId, user.id)
        : await followService.unfollowUser(currentUserId, user.id);
      if (result?.success === false) setIsFollowing(!next);
    } catch {
      setIsFollowing(!next);
    } finally {
      setFollowLoading(false);
    }
  };

  const currentRole = member?.role || memberships.find((item) => item.community?.id === community?.id)?.role;
  const roleBadges = memberships.filter((item) => item.role?.name).map((item) => ({
    ...item.role,
    communityName: item.community?.name,
  }));
  if (currentRole && !roleBadges.some((role) => role.id === currentRole.id)) roleBadges.unshift(currentRole);

  const assignableRoles = roles.filter((role) => role.name?.toLowerCase() !== "owner");

  return (
    <div className="community-profile-overlay" onClick={onClose}>
      <section className="community-profile-card" onClick={(event) => event.stopPropagation()}>
        <button className="community-profile-close" onClick={onClose} aria-label="Close profile"><X size={16} /></button>
        <BoostProfileCard
          tier={hasBoosted ? tier : null}
          themeId={hasBoosted ? themeId : null}
          style={{ borderRadius: "17px", minHeight: "100%" }}
        >
        <div className={`community-profile-cover pixel-tier-${pixelTier}`}>
          <div className="community-profile-pixel-layer" aria-hidden="true">
            {pixels.map((pixel, index) => <i key={index} style={{ left: pixel.left, top: pixel.top, width: pixel.size, height: pixel.size, background: pixel.color, opacity: pixel.opacity, animationDelay: pixel.delay }} />)}
          </div>
        </div>
        <div className="community-profile-body">
          <div className="community-profile-avatar">
            <BoostAvatarRing
              userId={user?.id}
              tier={hasBoosted ? tier : null}
              themeId={hasBoosted ? themeId : null}
              size={58}
              src={avatarUrl && !avatarFailed ? avatarUrl : null}
              letter={displayName.charAt(0).toUpperCase()}
              showBadge={hasBoosted}
              badgeSize="sm"
              borderRadius="circle"
            />
          </div>
          <div className="community-profile-heading">
            <h2 style={hasBoosted ? { color: boostVisual?.color || "#fff", textShadow: `0 0 18px ${boostVisual?.glow || "rgba(156,255,0,.35)"}` } : undefined}>{displayName}</h2>
            <span>@{user?.username || "unknown"}</span>
            {hasBoosted && <small className="community-profile-boost-label">{tier} boost</small>}
          </div>
          <div className="community-profile-stats">
            <span><strong>{mutualStats.communities}</strong> mutual {mutualStats.communities === 1 ? "community" : "communities"}</span>
            <span><strong>{mutualStats.following}</strong> mutual following</span>
            <span><strong>{mutualStats.followers}</strong> mutual followers</span>
          </div>
          <div className="community-profile-actions">
            <button onClick={() => onOpenDm?.(user)}><MessageCircle size={14} /> DM</button>
            <button className={`follow-action${isFollowing ? " following" : ""}`} onClick={handleFollow} disabled={isOwnProfile || followLoading}>
              {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
              {isOwnProfile ? "You" : followLoading ? "..." : isFollowing ? "Following" : "Follow"}
            </button>
            <button className="primary" onClick={() => onOpenProfile?.(user)}><UserRound size={14} /> Profile</button>
          </div>
          <div className="community-profile-role-head"><span>Roles</span>{canManageRoles && <button onClick={() => setShowRolePicker((value) => !value)} aria-label="Assign role"><Plus size={15} /></button>}</div>
          <div className="community-profile-roles">
            {roleBadges.length ? roleBadges.map((role, index) => (
              <span className="community-profile-role" key={`${role.id}-${index}`} style={{ "--role-color": role.color || "#9cff00" }}>
                <span className="community-profile-role-icon">{role.icon || "♟"}</span>{role.name}
                {role.communityName && <small>{role.communityName}</small>}
              </span>
            )) : <span className="community-profile-empty"><Shield size={13} /> No roles assigned</span>}
          </div>
          {showRolePicker && canManageRoles && member && (
            <label className="community-profile-assign">
              <span>Assign a community role</span>
              <select defaultValue="" onChange={(event) => { if (event.target.value) onAssignRole?.(member.id, event.target.value); setShowRolePicker(false); }}>
                <option value="">Choose role...</option>
                {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
          )}
        </div>
        </BoostProfileCard>
        <style>{`
          .community-profile-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,5,3,.48);backdrop-filter:blur(3px);animation:communityProfileIn .18s ease}
          .community-profile-card{position:relative;width:min(100%,320px);overflow:hidden;border:1px solid rgba(156,255,0,.22);border-radius:18px;background:#09130b;box-shadow:0 24px 70px rgba(0,0,0,.7),0 0 30px rgba(156,255,0,.08)}
          .community-profile-cover{height:72px;background:radial-gradient(circle at 20% 0%,rgba(156,255,0,.3),transparent 45%),linear-gradient(135deg,#0c2711,#102b18 55%,#0a160d)}
          .community-profile-cover{position:relative;overflow:hidden}.community-profile-pixel-layer{position:absolute;inset:0;image-rendering:pixelated;background-image:linear-gradient(135deg,rgba(255,255,255,.06) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.04) 50%,rgba(255,255,255,.04) 75%,transparent 75%);background-size:12px 12px}.community-profile-pixel-layer i{position:absolute;display:block;border-radius:1px;box-shadow:0 0 8px currentColor}.pixel-tier-silver .community-profile-pixel-layer i{box-shadow:0 0 9px rgba(226,232,240,.45)}.pixel-tier-gold .community-profile-pixel-layer i{box-shadow:0 0 10px rgba(251,191,36,.5)}.pixel-tier-diamond .community-profile-pixel-layer i{box-shadow:0 0 12px rgba(167,139,250,.6)}
          .community-profile-body{padding:0 16px 16px}.community-profile-close{position:absolute;right:10px;top:10px;width:28px;height:28px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(0,0,0,.35);color:#b5c5b5;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2}
          .community-profile-avatar{width:58px;height:58px;margin-top:-29px;border:3px solid #09130b;border-radius:50%;overflow:visible;background:#1b4320;color:#baff82;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900}.community-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}
          .community-profile-heading{margin-top:8px}.community-profile-heading h2{margin:0;color:#f1fff1;font-size:17px;font-weight:800}.community-profile-heading span{display:block;margin-top:2px;color:#6d9670;font-size:11px}.community-profile-boost-label{display:inline-block;margin-top:4px;color:#9cff00;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
          .community-profile-stats{display:grid;grid-template-columns:repeat(3,1fr);margin:13px 0;padding:8px 0;border:1px solid rgba(156,255,0,.12);border-radius:9px;background:rgba(0,0,0,.14);color:#719273;font-size:9px;text-align:center}.community-profile-stats span{padding:0 7px}.community-profile-stats span+span{border-left:1px solid rgba(156,255,0,.2)}.community-profile-stats strong{display:block;color:#eaffea;font-size:13px;margin-bottom:2px}
          .community-profile-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.community-profile-actions button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;padding:9px 5px;border:1px solid rgba(156,255,0,.22);border-radius:9px;background:rgba(156,255,0,.06);color:#c9e8c5;font:700 10px inherit;cursor:pointer}.community-profile-actions button.primary{background:#2e9f38;border-color:#45bc50;color:#fff}.community-profile-actions button.following{background:rgba(156,255,0,.14);border-color:rgba(156,255,0,.5);color:#baff82}.community-profile-actions button:disabled{opacity:.6;cursor:not-allowed}.community-profile-actions button:hover:not(:disabled){filter:brightness(1.12)}
          .community-profile-role-head{display:flex;align-items:center;justify-content:space-between;margin-top:18px;color:#769578;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px}.community-profile-role-head button{width:25px;height:25px;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(156,255,0,.45);border-radius:7px;background:rgba(156,255,0,.08);color:#9cff00;cursor:pointer}.community-profile-roles{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.community-profile-role{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--role-color) 35%,transparent);border-radius:7px;background:color-mix(in srgb,var(--role-color) 10%,transparent);color:var(--role-color);font-size:10px;font-weight:800}.community-profile-role small{color:#79947b;font-size:8px;font-weight:600}.community-profile-empty{display:flex;align-items:center;gap:5px;color:#668168;font-size:10px}.community-profile-assign{display:flex;flex-direction:column;gap:6px;margin-top:10px;color:#759176;font-size:10px;font-weight:700}.community-profile-assign select{padding:8px;border:1px solid rgba(156,255,0,.22);border-radius:8px;background:#0d1c10;color:#d9f4d5;font-size:11px;outline:0}
          @keyframes communityProfileIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        `}</style>
      </section>
    </div>
  );
};

export default CommunityProfileModal;
