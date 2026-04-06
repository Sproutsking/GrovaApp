// components/Community/components/CommunityMenu.jsx
// FIXED: menu-overlay top offset = 47px mobile / 57px desktop
// Community icon supports image URLs. Stats show real online count.
import React, { useState, useEffect } from "react";
import {
  X, Users, Link2, Settings, LogOut, Crown, ChevronRight,
  ChevronLeft, Bell, Trash2, Plus, Star, TrendingUp, Activity, AlertTriangle, Palette,
} from "lucide-react";
import permissionService from "../../../services/community/permissionService";
import RolesPermissionsSection from "./sections/RolesPermissionsSection";
import NotificationsSection from "./sections/NotificationsSection";
import MembersSection from "./sections/MembersSection";
import CommunitySettingsSection from "./sections/CommunitySettingsSection";
import AnalyticsSection from "./sections/AnalyticsSection";

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
  const style = {
    width: size, height: size, borderRadius: 14, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.54, overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0,0,0,.3)",
  };
  if (icon?.startsWith("http")) {
    return (
      <div style={{ ...style, background: community.banner_gradient || "#1a1a1a" }}>
        <img src={icon} alt={community.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </div>
    );
  }
  return (
    <div style={{ ...style, background: community?.banner_gradient || "linear-gradient(135deg,#667eea,#764ba2)" }}>
      {icon || "🌟"}
    </div>
  );
};

const CommunityMenu = ({
  show, onClose, community, userId,
  onLeave, onUpdate, onCreateChannel, onDeleteCommunity,
  onOpenInvite, onOpenBackgroundSwitcher,
  members = [], roles = [], channels = [],
}) => {
  const [menuView, setMenuView] = useState("main");
  const [selectedRole, setSelectedRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: "", message: "", onConfirm: ()=>{}, isDanger: false });

  useEffect(() => {
    if (show && community) {
      setMenuView("main");
      setSelectedRole(null);
      loadUserPermissions();
    }
  }, [show, community]);

  const loadUserPermissions = async () => {
    try {
      const permissions = await permissionService.getUserPermissions(community.id, userId);
      setUserPermissions(permissions || {});
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  };

  const isOwner = community?.owner_id === userId;
  const canManageRoles = userPermissions?.manageRoles || isOwner;
  const canManageCommunity = userPermissions?.manageCommunity || isOwner;
  const canCreateChannels = userPermissions?.createChannels || isOwner;

  const showConfirm = (title, message, onConfirm, isDanger = false) => {
    setConfirmDialog({ show: true, title, message, onConfirm, isDanger });
  };

  const handleUpdateRole = async (roleId, updates) => { await onUpdate({ type: "role", roleId, updates }); };
  const handleCreateRole = async (roleData) => { await onUpdate({ type: "createRole", roleData }); };

  if (!show) return null;

  // Online count: prefer community.online_count, fall back to members filter
  const onlineCount = community?.online_count ?? members.filter((m) => m.is_online).length;

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
                    <span>{(community?.member_count || members.length).toLocaleString()} members</span>
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
                        <div className="cm-stat-val">{(community?.member_count || members.length).toLocaleString()}</div>
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
                    { label:"Invite People", desc:"Share invite links", icon:<Link2 size={16}/>, gradient:"linear-gradient(135deg,#f093fb,#f5576c)", onClick:()=>{onClose();onOpenInvite();} },
                    ...(canCreateChannels ? [{ label:"Create Channel", desc:"Add a new channel", icon:<Plus size={16}/>, gradient:"linear-gradient(135deg,#4facfe,#00f2fe)", onClick:onCreateChannel }] : []),
                    { label:"Change Background", desc:"Customize chat appearance", icon:<Palette size={16}/>, gradient:"linear-gradient(135deg,#667eea,#764ba2)", onClick:()=>{onClose();onOpenBackgroundSwitcher?.();} },
                    ...(canManageCommunity ? [
                      { label:"Community Settings", desc:"Manage appearance & privacy", icon:<Settings size={16}/>, gradient:"linear-gradient(135deg,#43e97b,#38f9d7)", onClick:()=>setMenuView("settings"), arrow:true },
                      { label:"Roles & Permissions", desc:"Configure member roles", icon:<Crown size={16}/>, gradient:"linear-gradient(135deg,#fa709a,#fee140)", onClick:()=>setMenuView("roles"), arrow:true },
                      { label:"Analytics", desc:"View community insights", icon:<TrendingUp size={16}/>, gradient:"linear-gradient(135deg,#a8edea,#fed6e3)", onClick:()=>setMenuView("analytics"), arrow:true },
                    ] : []),
                    { label:"Notifications", desc:"Customize your alerts", icon:<Bell size={16}/>, gradient:"linear-gradient(135deg,#667eea,#764ba2)", onClick:()=>setMenuView("notifications"), arrow:true },
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

                  {isOwner && (
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
            {menuView === "notifications" && <NotificationsSection community={community} onUpdateNotifications={async(s)=>onUpdate({type:"notifications",settings:s})} />}
            {menuView === "roles"         && (
              <RolesPermissionsSection
                roles={roles} members={members}
                selectedRole={selectedRole} setSelectedRole={setSelectedRole}
                canManageRoles={canManageRoles}
                onUpdateRole={handleUpdateRole} onCreateRole={handleCreateRole}
              />
            )}
            {menuView === "settings"  && <CommunitySettingsSection community={community} userId={userId} onUpdate={async(s)=>onUpdate({type:"community",settings:s})} onClose={()=>setMenuView("main")} />}
            {menuView === "analytics" && <AnalyticsSection community={community} />}
          </div>
        </div>
      </div>

      <ConfirmDialog
        show={confirmDialog.show} onClose={() => setConfirmDialog(p=>({...p,show:false}))}
        onConfirm={confirmDialog.onConfirm} title={confirmDialog.title}
        message={confirmDialog.message} isDanger={confirmDialog.isDanger}
      />

      <style>{`
        /* FIXED: 47px mobile / 57px desktop top offset to clear the app root header */
        .cm-overlay{
          position:fixed;
          top:47px; /* mobile */
          left:0;right:0;bottom:0;
          background:rgba(0,0,0,.35);
          backdrop-filter:blur(4px);
          z-index:10000;
          animation:overlayIn .25s ease;
        }
        @media(min-width:769px){
          .cm-overlay{top:57px;} /* desktop */
        }
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}

        .cm-sidebar{
          position:absolute;
          top:0;right:0;bottom:0;
          width:100%;max-width:400px;
          background:rgba(10,10,10,.98);
          border-left:1.5px solid rgba(156,255,0,.15);
          box-shadow:-8px 0 32px rgba(0,0,0,.7),0 0 60px rgba(156,255,0,.06);
          display:flex;flex-direction:column;overflow:hidden;
          animation:slideInR .35s cubic-bezier(.4,0,.2,1);
        }
        @keyframes slideInR{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}

        .cm-header{
          padding:10px 12px;
          border-bottom:1px solid rgba(156,255,0,.08);
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          flex-shrink:0;
          background:rgba(15,15,15,.8);
        }
        .cm-head-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
        .cm-head-info{flex:1;min-width:0}
        .cm-head-name{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:900;color:#fff;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cm-head-stats{display:flex;align-items:center;gap:6px;font-size:11px;color:#777}
        .cm-dot{color:#444}
        .cm-online{color:#10b981;font-weight:700}
        .cm-head-back{display:flex;align-items:center;gap:10px;flex:1}
        .cm-view-title{font-size:15px;font-weight:800;color:#fff}
        .cm-back-btn{width:34px;height:34px;border-radius:50%;background:rgba(20,20,20,.8);border:1.5px solid rgba(40,40,40,.9);color:#9cff00;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .cm-back-btn:hover{border-color:rgba(156,255,0,.5);transform:translateX(-2px)}
        .cm-close-btn{width:36px;height:36px;border-radius:50%;background:rgba(10,10,10,.9);border:1.5px solid rgba(40,40,40,.8);color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .cm-close-btn:hover{border-color:rgba(255,107,107,.5);color:#ff6b6b;transform:rotate(90deg)}

        .cm-content{flex:1;overflow-y:auto;overflow-x:hidden}
        .cm-content::-webkit-scrollbar{width:5px}
        .cm-content::-webkit-scrollbar-thumb{background:rgba(156,255,0,.2);border-radius:3px}

        .cm-section{padding:10px}
        .cm-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:4px}
        .cm-stat{padding:14px;background:rgba(20,20,20,.7);border:1px solid rgba(36,36,36,.8);border-radius:11px;display:flex;align-items:center;gap:10px;transition:all .25s}
        .cm-stat:hover{border-color:rgba(156,255,0,.2);transform:translateY(-1px)}
        .cm-stat-val{font-size:18px;font-weight:900;color:#9cff00}
        .cm-stat-lbl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.4px}

        .cm-item{display:flex;align-items:center;gap:10px;padding:13px 12px;background:rgba(18,18,18,.5);border:1px solid rgba(32,32,32,.7);border-radius:11px;cursor:pointer;transition:all .25s cubic-bezier(.4,0,.2,1);margin-bottom:6px}
        .cm-item:hover{background:rgba(22,22,22,.9);border-color:rgba(156,255,0,.25);transform:translateX(5px)}
        .cm-item.danger:hover{border-color:rgba(255,107,107,.4);background:rgba(255,107,107,.04)}
        .cm-item-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
        .cm-item-content{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .cm-item-title{font-size:13px;font-weight:700;color:#fff}
        .cm-item-desc{font-size:10px;color:#666}

        @media(max-width:768px){
          .cm-sidebar{max-width:100%;border-left:none;animation:slideUpMobile .3s cubic-bezier(.4,0,.2,1)}
          @keyframes slideUpMobile{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        }
      `}</style>
    </>
  );
};

export default CommunityMenu;