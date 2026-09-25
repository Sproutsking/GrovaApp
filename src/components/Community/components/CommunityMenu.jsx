// components/Community/components/CommunityMenu.jsx
// FIXED: menu-overlay top offset = 47px mobile / 57px desktop
// Community icon supports image URLs. Stats show real online count.
import React, { useState, useEffect } from "react";
import {
  X, Users, Link2, Settings, LogOut, Crown, ChevronRight,
  ChevronLeft, Bell, Trash2, Plus, Star, TrendingUp, Activity, AlertTriangle, Palette, Wrench,
} from "lucide-react";
import permissionService from "../../../services/community/permissionService";
import { isCommunityMemberOnline } from "../../../services/community/communityOnlineStatusService";
import { supabase } from "../../../services/config/supabase";
import RolesPermissionsSection from "./sections/RolesPermissionsSection";
import NotificationsSection from "./sections/NotificationsSection";
import MembersSection from "./sections/MembersSection";
import CommunitySettingsSection from "./sections/CommunitySettingsSection";
import AnalyticsSection from "./sections/AnalyticsSection";
import ToolsSection from "./sections/ToolsSection";
import ChannelManagementSection from "./sections/ChannelManagementSection";
import CategoryManagementSection from "./sections/CategoryManagementSection";

const ConfirmDialog = ({ show, onClose, onConfirm, title, message, isDanger }) => {
  if (!show) return null;
  return (
    <div className="conf-overlay" onClick={onClose}>
      <div className="conf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="conf-header">
          <AlertTriangle size={22} color={isDanger ? "#ff6b6b" : "#9cff00"} />
          <h3>{title}</h3>
        </div>
        <p className="conf-msg">{message}</p>
        <div className="conf-actions">
          <button className="conf-btn cancel" onClick={onClose}>Cancel</button>
          <button className={`conf-btn ${isDanger ? "danger" : "primary"}`} onClick={() => { onConfirm(); onClose(); }}>
            Confirm
          </button>
        </div>
      </div>
      <style>{`
        .conf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:20000;display:flex;align-items:center;justify-content:center;animation:cfadeIn .2s ease}
        @keyframes cfadeIn{from{opacity:0}to{opacity:1}}
        .conf-dialog{background:rgba(15,15,15,.98);border:2px solid rgba(156,255,0,.25);border-radius:16px;padding:24px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:cslideUp .3s cubic-bezier(.4,0,.2,1)}
        @keyframes cslideUp{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        .conf-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .conf-header h3{font-size:17px;font-weight:800;color:#fff;margin:0}
        .conf-msg{font-size:13px;color:#aaa;line-height:1.6;margin:0 0 20px}
        .conf-actions{display:flex;gap:10px;justify-content:flex-end}
        .conf-btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid transparent;transition:all .2s}
        .conf-btn.cancel{background:rgba(26,26,26,.6);border-color:rgba(42,42,42,.8);color:#999}
        .conf-btn.cancel:hover{border-color:rgba(156,255,0,.3);color:#9cff00}
        .conf-btn.primary{background:linear-gradient(135deg,#9cff00,#667eea);color:#000}
        .conf-btn.primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(156,255,0,.3)}
        .conf-btn.danger{background:#ff6b6b;color:#fff}
        .conf-btn.danger:hover{background:#ff5252;transform:translateY(-1px)}
      `}</style>
    </div>
  );
};

// Community icon: handles URL images and emoji
const CommunityIcon = ({ community, size = 52 }) => {
  const icon = community?.icon;
  const initials = String(community?.name || "Community").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  const style = {
    width: size, height: size, borderRadius: 14, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.54, overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0,0,0,.3)",
  };
  const borderStyle = community?.icon_border || "default";
  const border = borderStyle === "none"
    ? "none"
    : borderStyle === "lime"
      ? "2px solid rgba(156,255,0,.7)"
      : borderStyle === "dashed"
        ? "2px dashed rgba(156,255,0,.55)"
        : "1px solid rgba(255,255,255,.28)";
  if (icon?.startsWith("http")) {
    return (
      <div style={{ ...style, border, background: community.banner_gradient || "#1a1a1a" }}>
        <img src={icon} alt={community.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </div>
    );
  }
  return (
    <div style={{ ...style, border, background: community?.banner_gradient || "linear-gradient(135deg,#667eea,#764ba2)" }}>
      {icon || <span style={{ fontSize: size * 0.34, fontWeight: 900, letterSpacing: ".04em", color: "#fff" }}>{initials}</span>}
    </div>
  );
};

const COMMUNITY_SETUP_GUIDES = [
  {
    title: "Owner controls",
    summary: "The owner role is protected and stays above all other roles.",
    detail: "Keep ownership fixed, protect admin powers, and avoid accidental role changes by non-owners.",
  },
  {
    title: "Channels",
    summary: "Use channels for topics, support, announcements, and verification.",
    detail: "Create channels, set their purpose, and keep the welcome or verification flow visible to new members.",
  },
  {
    title: "Categories",
    summary: "Group channels together so members can navigate faster.",
    detail: "Drag and drop channels into categories to organize your structure and keep discussions clean.",
  },
  {
    title: "Community settings",
    summary: "Tune the look, privacy, and default member experience.",
    detail: "Use community settings to keep your banner, privacy mode, and onboarding flow aligned with your brand.",
  },
];

const CommunityMenu = ({
  show, onClose, community, userId,
  onLeave, onUpdate, onCreateChannel, onDeleteCommunity,
  onOpenInvite, onOpenBackgroundSwitcher,
  members = [], roles = [], channels = [],
}) => {
  const [menuView, setMenuView] = useState("main");
  const [selectedRole, setSelectedRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [liveCounts, setLiveCounts] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: "", message: "", onConfirm: ()=>{}, isDanger: false });

  useEffect(() => {
    if (show && community) {
      setMenuView("main");
      setSelectedRole(null);
      setLiveCounts(null);
      loadUserPermissions();
      loadLiveCounts();
    }
  }, [show, community]);

  useEffect(() => {
    if (!show) return undefined;
    document.body.classList.add("community-menu-fullscreen");
    return () => document.body.classList.remove("community-menu-fullscreen");
  }, [show]);

  const loadUserPermissions = async () => {
    try {
      const permissions = await permissionService.getUserPermissions(community.id, userId);
      setUserPermissions(permissions || {});
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  };

  const loadLiveCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select("is_online, last_seen")
        .eq("community_id", community.id);
      if (error) throw error;
      setLiveCounts({
        members: data?.length || 0,
        online: (data || []).filter((member) => isCommunityMemberOnline(member)).length,
      });
    } catch (error) {
      console.warn("Could not refresh community counts:", error?.message);
    }
  };

  const isOwner = community?.owner_id === userId;
  const hasAdminOverride = Boolean(userPermissions?.administrator);
  const canManageRoles = userPermissions?.manageRoles || hasAdminOverride || isOwner;
  const canManageCommunity = userPermissions?.manageCommunity || hasAdminOverride || isOwner;
  const canManageChannels = userPermissions?.manageChannels || hasAdminOverride || isOwner;
  const canManageBackground = canManageCommunity || canManageChannels || hasAdminOverride;
  const canCreateChannels = userPermissions?.createChannels || hasAdminOverride || isOwner;

  const showConfirm = (title, message, onConfirm, isDanger = false) => {
    setConfirmDialog({ show: true, title, message, onConfirm, isDanger });
  };

  const handleUpdateRole = async (roleId, updates) => { await onUpdate({ type: "role", roleId, updates }); };
  const handleCreateRole = async (roleData) => { await onUpdate({ type: "createRole", roleData }); };
  const handleAssignRole = async (memberId, roleId) => { await onUpdate({ type: "assignRole", memberId, roleId }); };
  const handleReorderRoles = async (nextRoles) => { await onUpdate({ type: "reorderRoles", roles: nextRoles }); };

  if (!show) return null;

  const countValue = (value) => {
    if (Array.isArray(value)) return countValue(value[0]);
    if (value && typeof value === "object") return countValue(value.count);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const memberCount = liveCounts?.members ?? (community?.member_count == null ? members.length : countValue(community.member_count));
  const onlineCount = liveCounts?.online ?? (community?.online_count == null
    ? members.filter((member) => isCommunityMemberOnline(member)).length
    : countValue(community.online_count));

  return (
    <>
      {/* FIXED: top offset 47px mobile / 57px desktop to clear app header */}
      <div className="cm-overlay" onClick={onClose}>
        <div className="cm-sidebar" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="cm-header">
            {menuView === "main" ? (
              <div className="cm-head-main">
                <CommunityIcon community={community} size={48} />
                <div className="cm-head-info">
                  <div className="cm-head-name">
                    {community?.name}
                    {community?.is_verified && <Star size={14} color="#9cff00" fill="#9cff00" />}
                  </div>
                  <div className="cm-head-stats">
                    <span>{memberCount.toLocaleString()} members</span>
                    <span className="cm-dot">·</span>
                    <span className="cm-online">{onlineCount} online</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cm-head-back">
                <button className="cm-back-btn" onClick={() => setMenuView("main")}>
                  <ChevronLeft size={18} />
                </button>
                <span className="cm-view-title">
                  {menuView==="members"&&"Members"}
                  {menuView==="settings"&&"Settings"}
                  {menuView==="roles"&&"Roles & Permissions"}
                  {menuView==="analytics"&&"Analytics"}
                  {menuView==="notifications"&&"Notifications"}
                  {menuView==="tools"&&"Tools"}
                  {menuView==="channels"&&"Channels"}
                  {menuView==="categories"&&"Categories"}
                </span>
              </div>
            )}
            <button className="cm-close-btn" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Content */}
          <div className="cm-content">
            {menuView === "main" && (
              <>
                <div className="cm-section">
                  <div className="cm-stat-grid">
                    <div className="cm-stat">
                      <Users size={18} color="#9cff00" />
                      <div>
                        <div className="cm-stat-val">{memberCount.toLocaleString()}</div>
                        <div className="cm-stat-lbl">Total Members</div>
                      </div>
                    </div>
                    <div className="cm-stat">
                      <Activity size={18} color="#667eea" />
                      <div>
                        <div className="cm-stat-val">{onlineCount}</div>
                        <div className="cm-stat-lbl">Online Now</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cm-section">
                  {[
                    { label:"View Members", desc:"Browse all community members", icon:<Users size={16}/>, gradient:"linear-gradient(135deg,#9cff00,#667eea)", onClick:()=>setMenuView("members"), arrow:true },
                    { label:"Help & Setup", desc:"Learn settings, channels, and categories", icon:<Star size={16}/>, gradient:"linear-gradient(135deg,#f9d423,#ff4e50)", onClick:()=>setMenuView("help"), arrow:true },
                    { label:"Invite People", desc:"Share invite links", icon:<Link2 size={16}/>, gradient:"linear-gradient(135deg,#f093fb,#f5576c)", onClick:()=>{onClose();onOpenInvite();} },
                    ...(canCreateChannels ? [{ label:"Create Channel", desc:"Add a new channel", icon:<Plus size={16}/>, gradient:"linear-gradient(135deg,#4facfe,#00f2fe)", onClick:onCreateChannel }] : []),
                    ...(canManageBackground ? [{ label:"Change Background", desc:"Customize chat appearance", icon:<Palette size={16}/>, gradient:"linear-gradient(135deg,#667eea,#764ba2)", onClick:()=>{onClose();onOpenBackgroundSwitcher?.();} }] : []),
                    ...(canManageCommunity ? [
                      { label:"Community Settings", desc:"Manage appearance & privacy", icon:<Settings size={16}/>, gradient:"linear-gradient(135deg,#43e97b,#38f9d7)", onClick:()=>setMenuView("settings"), arrow:true },
                      { label:"Analytics", desc:"View community insights", icon:<TrendingUp size={16}/>, gradient:"linear-gradient(135deg,#a8edea,#fed6e3)", onClick:()=>setMenuView("analytics"), arrow:true },
                    ] : []),
                    ...(canManageRoles ? [{ label:"Roles & Permissions", desc:"Configure member roles", icon:<Crown size={16}/>, gradient:"linear-gradient(135deg,#fa709a,#fee140)", onClick:()=>setMenuView("roles"), arrow:true }] : []),
                    { label:"Notifications", desc:"Customize your alerts", icon:<Bell size={16}/>, gradient:"linear-gradient(135deg,#667eea,#764ba2)", onClick:()=>setMenuView("notifications"), arrow:true },
                    { label:"Tools", desc:"Configure member-facing community tools", icon:<Wrench size={16}/>, gradient:"linear-gradient(135deg,#9cff00,#43e97b)", onClick:()=>setMenuView("tools"), arrow:true },
                    ...(canCreateChannels ? [{ label:"Manage Channels", desc:"Edit channels and organize categories", icon:<Settings size={16}/>, gradient:"linear-gradient(135deg,#60a5fa,#22d3ee)", onClick:()=>setMenuView("channels"), arrow:true }] : []),
                    ...(canManageCommunity ? [{ label:"Manage Categories", desc:"Create and arrange channel groups", icon:<Settings size={16}/>, gradient:"linear-gradient(135deg,#fbbf24,#f97316)", onClick:()=>setMenuView("categories"), arrow:true }] : []),
                  ].map((item, i) => (
                    <div key={i} className="cm-item" onClick={item.onClick}>
                      <div className="cm-item-icon" style={{ background: item.gradient }}>{item.icon}</div>
                      <div className="cm-item-content">
                        <span className="cm-item-title">{item.label}</span>
                        <span className="cm-item-desc">{item.desc}</span>
                      </div>
                      {item.arrow && <ChevronRight size={15} color="#444" />}
                    </div>
                  ))}

                  {!isOwner && (
                    <div className="cm-item danger" onClick={() => showConfirm("Leave Community", "Are you sure you want to leave? You can always rejoin later.", () => { onLeave(community.id); onClose(); }, false)}>
                      <div className="cm-item-icon" style={{ background: "#ff6b6b" }}><LogOut size={16} /></div>
                      <div className="cm-item-content">
                        <span className="cm-item-title">Leave Community</span>
                        <span className="cm-item-desc">You can always rejoin later</span>
                      </div>
                    </div>
                  )}

                  {(isOwner || canManageCommunity) && (
                    <div className="cm-item danger" onClick={() => showConfirm("Delete Community", "⚠️ This permanently deletes the community and all its data. Cannot be undone.", () => { onDeleteCommunity(); onClose(); }, true)}>
                      <div className="cm-item-icon" style={{ background: "#ff6b6b" }}><Trash2 size={16} /></div>
                      <div className="cm-item-content">
                        <span className="cm-item-title">Delete Community</span>
                        <span className="cm-item-desc">Permanently remove this community</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {menuView === "members"       && <MembersSection community={community} userId={userId} />}
            {menuView === "help" && (
              <div className="community-help-shell">
                <div className="community-help-header">
                  <div>
                    <span className="community-help-kicker">Community playbook</span>
                    <h2>How to make your community feel premium</h2>
                  </div>
                </div>
                <div className="community-help-list">
                  {COMMUNITY_SETUP_GUIDES.map((guide) => (
                    <div key={guide.title} className="community-help-card">
                      <div className="community-help-card-title">{guide.title}</div>
                      <div className="community-help-card-summary">{guide.summary}</div>
                      <p>{guide.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {menuView === "notifications" && <NotificationsSection community={community} onUpdateNotifications={async(s)=>onUpdate({type:"notifications",settings:s})} />}
            {menuView === "roles"         && (
              <RolesPermissionsSection
                communityId={community.id}
                roles={roles} members={members}
                selectedRole={selectedRole} setSelectedRole={setSelectedRole}
                canManageRoles={canManageRoles}
                onUpdateRole={handleUpdateRole} onCreateRole={handleCreateRole} onAssignRole={handleAssignRole} onReorderRoles={handleReorderRoles}
              />
            )}
            {menuView === "settings"  && <CommunitySettingsSection community={community} userId={userId} channels={channels} onUpdate={async(s)=>onUpdate(s.type === "tool" ? s : {type:"community",settings:s})} onClose={()=>setMenuView("main")} />}
            {menuView === "analytics" && <AnalyticsSection community={community} />}
            {menuView === "tools" && <ToolsSection
              communityId={community.id}
              userId={userId}
              channels={channels}
              canManage={canManageCommunity}
              onOpenInvite={() => { onClose(); onOpenInvite?.(); }}
              onOpenUpgrade={() => setMenuView("settings")}
              onOpenModeration={() => setMenuView("roles")}
              onCreateChannel={() => { onClose(); onCreateChannel?.(); }}
            />}
            {menuView === "channels" && <ChannelManagementSection
              channels={channels}
              onCreate={() => { onClose(); onCreateChannel?.(); }}
              onEdit={(channel) => { onClose(); window.dispatchEvent(new CustomEvent("community:edit-channel", { detail: channel })); }}
            />}
            {menuView === "categories" && <CategoryManagementSection communityId={community?.id} onChanged={() => window.dispatchEvent(new CustomEvent("community:channels-changed"))} />}
          </div>
        </div>
      </div>

      <ConfirmDialog
        show={confirmDialog.show} onClose={() => setConfirmDialog(p=>({...p,show:false}))}
        onConfirm={confirmDialog.onConfirm} title={confirmDialog.title}
        message={confirmDialog.message} isDanger={confirmDialog.isDanger}
      />

      <style>{`
        .cm-overlay{
          position:fixed;
          inset:0;
          left:0;right:0;bottom:0;
          background:var(--modal-overlay);
          backdrop-filter:blur(4px);
          z-index:10000;
          animation:overlayIn .25s ease;
        }
        body.community-menu-fullscreen .mh-header,
        body.community-menu-fullscreen .mbn{display:none !important}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}

        .cm-sidebar{
          position:absolute;
          top:0;right:0;bottom:0;
          width:100%;max-width:none;
          background:var(--panel-strong);
          border-left:none;
          box-shadow:none;
          display:flex;flex-direction:column;overflow:hidden;
          animation:slideInR .35s cubic-bezier(.4,0,.2,1);
        }
        @keyframes slideInR{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}

        .cm-header{
          padding:7px 10px;
          border-bottom:1px solid var(--surface-border);
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          flex-shrink:0;
          background:var(--surface-elevated);
        }
        .cm-head-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
        .cm-head-info{flex:1;min-width:0}
        .cm-head-name{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:900;color:var(--text);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cm-head-stats{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary)}
        .cm-dot{color:var(--text-muted)}
        .cm-online{color:var(--brand-success);font-weight:700}
        .cm-head-back{display:flex;align-items:center;gap:10px;flex:1}
        .cm-view-title{font-size:15px;font-weight:800;color:var(--text)}
        .cm-back-btn{width:34px;height:34px;border-radius:50%;background:var(--surface);border:1.5px solid var(--surface-border);color:var(--accent);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .cm-back-btn:hover{border-color:var(--accent-border-strong);transform:translateX(-2px)}
        .cm-close-btn{width:36px;height:36px;border-radius:50%;background:var(--surface);border:1.5px solid var(--surface-border);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .cm-close-btn:hover{border-color:var(--danger-border);color:var(--danger);transform:rotate(90deg)}

        .cm-content{flex:1;overflow-y:auto;overflow-x:hidden}
        .cm-content::-webkit-scrollbar{width:5px}
        .cm-content::-webkit-scrollbar-thumb{background:var(--accent-bg-strong);border-radius:3px}

        .cm-section{padding:10px}
        .cm-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:4px}
        .cm-stat{padding:14px;background:var(--surface);border:1px solid var(--surface-border);border-radius:11px;display:flex;align-items:center;gap:10px;transition:all .25s}
        .cm-stat:hover{border-color:var(--accent-border);transform:translateY(-1px)}
        .cm-stat-val{font-size:18px;font-weight:900;color:var(--accent)}
        .cm-stat-lbl{font-size:10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.4px}

        .cm-item{display:flex;align-items:center;gap:10px;padding:13px 12px;background:var(--surface);border:1px solid var(--surface-border);border-radius:11px;cursor:pointer;transition:all .25s cubic-bezier(.4,0,.2,1);margin-bottom:6px}
        .cm-item:hover{background:var(--surface-strong);border-color:var(--accent-border);transform:translateX(5px)}
        .cm-item.danger:hover{border-color:var(--danger-border);background:var(--danger-bg)}
        .cm-item-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
        .cm-item-content{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .cm-item-title{font-size:13px;font-weight:700;color:var(--text)}
        .cm-item-desc{font-size:10px;color:var(--text-secondary)}

        .community-help-shell {
          padding: 18px 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .community-help-header {
          padding: 4px 4px 0;
        }
        .community-help-kicker {
          display: inline-block;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9cff00;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .community-help-header h2 {
          margin: 0;
          font-size: 20px;
          color: #fff;
          line-height: 1.2;
        }
        .community-help-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .community-help-card {
          background: rgba(18,18,18,0.9);
          border: 1.5px solid rgba(156,255,0,0.2);
          border-radius: 14px;
          padding: 14px 14px 12px;
        }
        .community-help-card-title {
          font-size: 14px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 5px;
        }
        .community-help-card-summary {
          font-size: 12px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 6px;
        }
        .community-help-card p {
          margin: 0;
          color: #a3a3a3;
          font-size: 12px;
          line-height: 1.5;
        }

        @media(max-width:768px){
          .cm-sidebar{max-width:100%;border-left:none;animation:slideUpMobile .3s cubic-bezier(.4,0,.2,1)}
          .cm-header{padding:8px 12px}
          .cm-section{padding:8px}
          .community-help-shell{padding:12px 10px 18px}
          @keyframes slideUpMobile{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        }
      `}</style>
    </>
  );
};

export default CommunityMenu;