// src/components/Admin/AdminDashboard.jsx
// 2FA gate REMOVED — admin access is controlled by admin_team table membership.
// If you're in admin_team with status='active', you're in. No extra gate needed.

import React, { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, DollarSign, FileText, Flag, Gift,
  Settings, Search, Download, Bell, Check, X, Edit2,
  Trash2, Plus, UserPlus, ChevronDown, RefreshCw, BarChart3,
  Activity, Zap, Globe, Server, Database, Wifi, AlertCircle,
  CheckCircle, ArrowUp, ArrowDown, Crown, Star, Lock,
  AlertTriangle, Loader2, Eye, EyeOff, Save, RotateCcw,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import authService from "../../services/auth/authService";
import "./AdminDashboard.css";

// ─── Preset admins ────────────────────────────────────────────────────────────
const PRESET_ADMINS = [
  { email: "mikesonsmith88@gmail.com",  role: "a_admin", name: "Mikeson Ethers" },
  { email: "sproutsking007@gmail.com",  role: "a_admin", name: "Sprouts King" },
  { email: "donaldbernard044@gmail.com",role: "b_admin", name: "Donald Ethers" },
  { email: "queendinaries@gmail.com",   role: "b_admin", name: "Sol Queen" },
];

// ─── Role definitions ─────────────────────────────────────────────────────────
const DEFAULT_ROLES = {
  ceo_owner:  { label: "CEO / Owner", color: "#f59e0b", icon: Crown, level: 100, permissions: ["all"],            description: "Full unrestricted platform control" },
  a_admin:    { label: "Admin A",     color: "#a3e635", icon: Shield, level: 80,  permissions: ["users","content","reports","transactions","invites","team","analytics","system"], description: "Senior admin with broad permissions" },
  b_admin:    { label: "Admin B",     color: "#3b82f6", icon: Star,  level: 50,  permissions: ["users","content","reports"], description: "Standard admin for moderation tasks" },
  support:    { label: "Support",     color: "#8b5cf6", icon: Users, level: 20,  permissions: ["users","reports"], description: "Customer support team member" },
};

const ALL_PERMISSIONS = [
  { id: "users",        label: "User Management" },
  { id: "content",      label: "Content Moderation" },
  { id: "reports",      label: "Reports & Flags" },
  { id: "transactions", label: "Transactions" },
  { id: "invites",      label: "Invite Codes" },
  { id: "team",         label: "Admin Team" },
  { id: "analytics",    label: "Analytics" },
  { id: "system",       label: "System Settings" },
  { id: "freeze",       label: "Platform Freeze" },
];

const REGIONS = [
  { id: "all",           label: "🌍 Global (All Regions)" },
  { id: "africa",        label: "🌍 Africa" },
  { id: "north_america", label: "🌎 North America" },
  { id: "south_america", label: "🌎 South America" },
  { id: "europe",        label: "🌍 Europe" },
  { id: "asia",          label: "🌏 Asia" },
  { id: "oceania",       label: "🌏 Oceania" },
  { id: "middle_east",   label: "🌍 Middle East" },
];

const COUNTRY_GROUPS = {
  africa:        ["NG","GH","KE","ZA","EG","TZ","ET","RW","SN","CI"],
  north_america: ["US","CA","MX"],
  south_america: ["BR","AR","CO","PE","CL"],
  europe:        ["GB","DE","FR","IT","ES","NL","SE","NO"],
  asia:          ["IN","CN","JP","KR","SG","MY","ID","PH","TH"],
  oceania:       ["AU","NZ"],
  middle_east:   ["AE","SA","QA","KW","TR"],
};

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
const AdminDashboard = ({ adminData, onClose }) => {
  const [currentUserId, setCurrentUserId]   = useState(null);
  const [activeSection, setActiveSection]   = useState("overview");
  const [searchQuery, setSearchQuery]       = useState("");
  const [adminTeam, setAdminTeam]           = useState([]);
  const [loadingTeam, setLoadingTeam]       = useState(false);
  const [inviteCodes, setInviteCodes]       = useState([]);
  const [roles, setRoles]                   = useState(DEFAULT_ROLES);
  const [showAddAdmin, setShowAddAdmin]     = useState(false);
  const [showEditRole, setShowEditRole]     = useState(null);
  const [freezeStatus, setFreezeStatus]     = useState({});
  const [stats, setStats]                   = useState({
    totalUsers: 0, activeUsers: 0, newUsers24h: 0,
    totalRevenue: 0, monthlyRevenue: 0, revenueGrowth: 0,
    totalPosts: 0, totalReels: 0, totalStories: 0,
    pendingReports: 0, totalCommunities: 0, engagementRate: 0,
    platformHealth: 98.5, pendingTransactions: 0,
  });

  const [newAdmin, setNewAdmin]   = useState({ email: "", name: "", role: "b_admin", permissions: [] });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addError, setAddError]   = useState("");

  useEffect(() => {
    authService.getCurrentUser().then((u) => { if (u) setCurrentUserId(u.id); });
    loadStats();
    loadAdminTeam();
    loadInviteCodes();
    loadFreezeStatus();
  }, []);

  const userRole     = adminData?.role;
  const hasPermission = (perm) => {
    if (!adminData) return false;
    if (adminData.permissions?.includes("all")) return true;
    return adminData.permissions?.includes(perm);
  };
  const canManageTeam = hasPermission("team") || userRole === "ceo_owner";
  const canFreeze     = hasPermission("freeze") || userRole === "ceo_owner" || userRole === "a_admin";

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const [{ count: users }, { count: posts }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("posts").select("*", { count: "exact", head: true }).is("deleted_at", null),
      ]);
      setStats((prev) => ({ ...prev, totalUsers: users || 0, totalPosts: posts || 0 }));
    } catch (e) { console.error("Stats:", e); }
  };

  const loadAdminTeam = async () => {
    setLoadingTeam(true);
    try {
      const { data } = await supabase.from("admin_team").select("*").order("created_at");
      if (data) setAdminTeam(data);
    } catch (e) { console.error("Team:", e); }
    finally { setLoadingTeam(false); }
  };

  const loadInviteCodes = async () => {
    const { data } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false });
    if (data) setInviteCodes(data);
  };

  const loadFreezeStatus = async () => {
    try {
      const { data } = await supabase.from("platform_settings").select("*").eq("key", "freeze_status").maybeSingle();
      if (data?.value) setFreezeStatus(data.value);
    } catch {}
  };

  // ── Seed presets ────────────────────────────────────────────────────────────
  const seedPresetAdmins = async () => {
    for (const preset of PRESET_ADMINS) {
      const { data: profile } = await supabase.from("profiles").select("id,full_name").eq("email", preset.email).maybeSingle();
      if (profile) {
        const { data: existing } = await supabase.from("admin_team").select("id").eq("user_id", profile.id).maybeSingle();
        if (!existing) {
          await supabase.from("admin_team").insert({
            user_id: profile.id, email: preset.email,
            full_name: profile.full_name || preset.name,
            role: preset.role, permissions: DEFAULT_ROLES[preset.role].permissions, status: "active",
          });
        }
      }
    }
    loadAdminTeam();
  };

  // ── Add admin ───────────────────────────────────────────────────────────────
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newAdmin.email || !newAdmin.role) { setAddError("Email and role required."); return; }
    setAddingAdmin(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("id,full_name").eq("email", newAdmin.email.toLowerCase()).maybeSingle();
      if (!profile) { setAddError("No Xeevia account found with that email."); return; }
      const { data: existing } = await supabase.from("admin_team").select("id").eq("user_id", profile.id).maybeSingle();
      if (existing) { setAddError("This user is already in the admin team."); return; }
      const roleDef = roles[newAdmin.role];
      const perms = newAdmin.permissions.length > 0 ? newAdmin.permissions : roleDef.permissions;
      const { error } = await supabase.from("admin_team").insert({
        user_id: profile.id, email: newAdmin.email.toLowerCase(),
        full_name: newAdmin.name || profile.full_name || "Admin",
        role: newAdmin.role, permissions: perms, status: "active", created_by: currentUserId,
      });
      if (error) throw error;
      setShowAddAdmin(false);
      setNewAdmin({ email: "", name: "", role: "b_admin", permissions: [] });
      loadAdminTeam();
    } catch (err) { setAddError(err.message || "Failed to add admin."); }
    finally { setAddingAdmin(false); }
  };

  // ── Remove admin ────────────────────────────────────────────────────────────
  const handleRemoveAdmin = async (adminId, adminRole) => {
    if (adminRole === "ceo_owner") { alert("Cannot remove CEO/Owner."); return; }
    if (!window.confirm("Remove this team member?")) return;
    await supabase.from("admin_team").update({ status: "inactive" }).eq("id", adminId);
    loadAdminTeam();
  };

  // ── Freeze ──────────────────────────────────────────────────────────────────
  const handleFreeze = async (regionId, freeze) => {
    const newStatus = { ...freezeStatus, [regionId]: freeze };
    setFreezeStatus(newStatus);
    try {
      await supabase.from("platform_settings").upsert({
        key: "freeze_status", value: newStatus,
        updated_at: new Date().toISOString(), updated_by: currentUserId,
      });
    } catch (e) { console.error("Freeze:", e); }
  };

  // ── Invite codes ────────────────────────────────────────────────────────────
  const generateInviteCode = async () => {
    const code = "XEEVIA" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("invite_codes").insert({
      code, type: "standard", max_uses: 100, uses_count: 0, status: "active", created_by: currentUserId,
    });
    if (!error) loadInviteCodes();
  };

  // ── Save role edit ──────────────────────────────────────────────────────────
  const saveRoleEdit = (roleKey, updated) => {
    setRoles((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], ...updated } }));
    setShowEditRole(null);
  };

  // ── Nav sections ────────────────────────────────────────────────────────────
  const sections = [
    { id: "overview",  icon: BarChart3, label: "Overview" },
    { id: "team",      icon: Shield,    label: "Admin Team",          show: canManageTeam },
    { id: "roles",     icon: Crown,     label: "Roles & Permissions", show: userRole === "ceo_owner" || userRole === "a_admin" },
    { id: "freeze",    icon: Lock,      label: "Platform Freeze",     show: canFreeze },
    { id: "invites",   icon: Gift,      label: "Invite Codes",        show: hasPermission("invites") },
    { id: "analytics", icon: Activity,  label: "Analytics",           show: hasPermission("analytics") },
    { id: "system",    icon: Server,    label: "System",              show: hasPermission("system") },
    { id: "settings",  icon: Settings,  label: "Settings" },
  ].filter((s) => s.show !== false);

  // ── Renderers ───────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="page-subtitle">Real-time metrics and platform health</p>
        </div>
        <div className="header-actions">
          {userRole === "ceo_owner" && (
            <button className="btn-secondary" onClick={seedPresetAdmins}><UserPlus size={16} /> Seed Preset Admins</button>
          )}
          <button className="btn-primary" onClick={loadStats}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>
      <div className="metrics-grid">
        <div className="metric-card featured">
          <div className="metric-header">
            <div className="metric-icon primary"><Users size={24} /></div>
            <span className="metric-trend positive"><ArrowUp size={14} /> Active</span>
          </div>
          <div className="metric-value">{stats.totalUsers.toLocaleString()}</div>
          <div className="metric-label">Total Users</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><div className="metric-icon info"><FileText size={20} /></div></div>
          <div className="metric-value">{stats.totalPosts.toLocaleString()}</div>
          <div className="metric-label">Total Posts</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><div className="metric-icon warning"><Flag size={20} /></div></div>
          <div className="metric-value">{stats.pendingReports}</div>
          <div className="metric-label">Pending Reports</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><div className="metric-icon success"><Activity size={20} /></div></div>
          <div className="metric-value">{stats.platformHealth}%</div>
          <div className="metric-label">Platform Health</div>
        </div>
      </div>
      <div className="section-group">
        <div className="section-header">
          <h2 className="section-title">Platform Health</h2>
          <span className="status-badge success"><CheckCircle size={14} /> All Systems Operational</span>
        </div>
        <div className="health-grid">
          {[
            { label: "Server Status", value: `${stats.platformHealth}%`, fill: stats.platformHealth },
            { label: "Database",      value: "97.2%",  fill: 97.2 },
            { label: "API Response",  value: "45ms",   fill: 95 },
            { label: "CDN",           value: "99.8%",  fill: 99.8 },
          ].map((h) => (
            <div className="health-card" key={h.label}>
              <div className="health-header"><Server size={16} /><span>{h.label}</span></div>
              <div className="health-value success">{h.value}</div>
              <div className="health-bar"><div className="health-fill success" style={{ width: `${h.fill}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Team</h1>
          <p className="page-subtitle">Manage roles, permissions and team members</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={seedPresetAdmins}><UserPlus size={16} /> Seed Presets</button>
          {canManageTeam && (
            <button className="btn-primary" onClick={() => setShowAddAdmin(true)}><Plus size={16} /> Add Member</button>
          )}
        </div>
      </div>
      <div className="data-table">
        <div className="table-header">
          <h3 className="table-title">Team Members ({adminTeam.length})</h3>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search team..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-content">
          {loadingTeam ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}><Loader2 size={24} className="spin" /></div>
          ) : (
            <table>
              <thead>
                <tr><th>Member</th><th>Role</th><th>Permissions</th><th>Status</th><th>Last Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {adminTeam.filter((a) => !searchQuery || a.email?.includes(searchQuery) || a.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((admin) => {
                  const roleDef  = roles[admin.role] || {};
                  const RoleIcon = roleDef.icon || Shield;
                  return (
                    <tr key={admin.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar" style={{ background: roleDef.color ? `${roleDef.color}30` : "#27272a" }}>
                            <span style={{ color: roleDef.color }}>{(admin.full_name || "A").charAt(0)}</span>
                          </div>
                          <div className="user-info">
                            <span className="user-name">{admin.full_name}</span>
                            <span className="user-email">{admin.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-badge" style={{ background: `${roleDef.color}20`, color: roleDef.color }}>
                          <RoleIcon size={12} /> {roleDef.label || admin.role}
                        </span>
                      </td>
                      <td>
                        <div className="permissions-cell">
                          {admin.permissions?.includes("all") ? (
                            <span className="permission-badge all">All Access</span>
                          ) : (
                            admin.permissions?.slice(0, 3).map((p) => <span key={p} className="permission-badge">{p}</span>)
                          )}
                          {admin.permissions?.length > 3 && <span className="permission-more">+{admin.permissions.length - 3}</span>}
                        </div>
                      </td>
                      <td><span className={`status-indicator ${admin.status === "active" ? "active" : "offline"}`}><span className="status-dot" /> {admin.status}</span></td>
                      <td><span className="time-text">{admin.last_active ? new Date(admin.last_active).toLocaleDateString() : "—"}</span></td>
                      <td>
                        <div className="action-buttons">
                          {admin.role !== "ceo_owner" && canManageTeam && (
                            <button className="btn-icon danger" onClick={() => handleRemoveAdmin(admin.id, admin.role)} title="Remove"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddAdmin(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Team Member</h2>
              <button className="modal-close" onClick={() => setShowAddAdmin(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddAdmin}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input type="email" className="form-input" placeholder="admin@xeevia.app" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input type="text" className="form-input" placeholder="Full name" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value, permissions: [] })}>
                    {Object.entries(roles).filter(([key]) => key !== "ceo_owner" || userRole === "ceo_owner").map(([key, def]) => (
                      <option key={key} value={key}>{def.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Override Permissions (optional)</label>
                  <div className="permission-checkboxes">
                    {ALL_PERMISSIONS.map((p) => (
                      <label key={p.id} className="checkbox-label">
                        <input type="checkbox" checked={newAdmin.permissions.includes(p.id)} onChange={(e) => {
                          const perms = e.target.checked ? [...newAdmin.permissions, p.id] : newAdmin.permissions.filter((x) => x !== p.id);
                          setNewAdmin({ ...newAdmin, permissions: perms });
                        }} />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {addError && <div className="gate-error" style={{ marginTop: 8 }}><AlertCircle size={16} /><span>{addError}</span></div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddAdmin(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addingAdmin}>
                  {addingAdmin ? <><Loader2 size={16} className="spin" /> Adding...</> : <><UserPlus size={16} /> Add Member</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderRoles = () => (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Roles & Permissions</h1><p className="page-subtitle">Customize role names, colors and permissions</p></div>
      </div>
      <div className="roles-grid">
        {Object.entries(roles).map(([key, role]) => {
          const RoleIcon = role.icon;
          return (
            <div className="role-card" key={key} style={{ borderColor: `${role.color}40` }}>
              <div className="role-card-header">
                <div className="role-icon-wrap" style={{ background: `${role.color}20`, color: role.color }}><RoleIcon size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div className="role-name" style={{ color: role.color }}>{role.label}</div>
                  <div className="role-level">Level {role.level}</div>
                </div>
                {userRole === "ceo_owner" && (
                  <button className="btn-icon" onClick={() => setShowEditRole({ key, ...role })}><Edit2 size={14} /></button>
                )}
              </div>
              <p className="role-desc">{role.description}</p>
              <div className="role-perms">
                {role.permissions.includes("all") ? (
                  <span className="permission-badge all">All Permissions</span>
                ) : (
                  role.permissions.map((p) => <span key={p} className="permission-badge">{p}</span>)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showEditRole && (
        <div className="modal-overlay" onClick={() => setShowEditRole(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Role: {showEditRole.label}</h2>
              <button className="modal-close" onClick={() => setShowEditRole(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Role Name</label>
                <input className="form-input" value={showEditRole.label} onChange={(e) => setShowEditRole({ ...showEditRole, label: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" value={showEditRole.color} onChange={(e) => setShowEditRole({ ...showEditRole, color: e.target.value })} style={{ width: "60px", height: "40px", border: "none", background: "none", cursor: "pointer" }} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={showEditRole.description} onChange={(e) => setShowEditRole({ ...showEditRole, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Permissions</label>
                <div className="permission-checkboxes">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.id} className="checkbox-label">
                      <input type="checkbox" checked={showEditRole.permissions?.includes("all") || showEditRole.permissions?.includes(p.id)} onChange={(e) => {
                        const curr = showEditRole.permissions?.filter((x) => x !== "all") || [];
                        const updated = e.target.checked ? [...curr, p.id] : curr.filter((x) => x !== p.id);
                        setShowEditRole({ ...showEditRole, permissions: updated });
                      }} />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditRole(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => saveRoleEdit(showEditRole.key, showEditRole)}><Save size={16} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFreeze = () => (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Platform Freeze Control</h1><p className="page-subtitle">Freeze platform access by region during incidents</p></div>
      </div>
      <div className="freeze-warning"><AlertTriangle size={20} /><span>Freezing a region blocks all user access from that area. Use only during confirmed security incidents.</span></div>
      <div className="freeze-grid">
        {REGIONS.map((region) => {
          const frozen = freezeStatus[region.id] === true;
          return (
            <div key={region.id} className={`freeze-card ${frozen ? "frozen" : ""}`}>
              <div className="freeze-card-header">
                <span className="freeze-region-label">{region.label}</span>
                <span className={`status-badge ${frozen ? "error" : "success"}`}>{frozen ? "🔒 Frozen" : "✅ Active"}</span>
              </div>
              {region.id !== "all" && <div className="freeze-countries">{(COUNTRY_GROUPS[region.id] || []).join(", ")}</div>}
              <div className="freeze-actions">
                <button className={`freeze-btn ${frozen ? "unfreeze" : "freeze"}`} onClick={() => handleFreeze(region.id, !frozen)}>
                  {frozen ? <><CheckCircle size={14} /> Unfreeze</> : <><Lock size={14} /> Freeze</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderInvites = () => (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Invite Codes</h1><p className="page-subtitle">Generate and manage platform access codes</p></div>
        <button className="btn-primary" onClick={generateInviteCode}><Plus size={16} /> Generate Code</button>
      </div>
      <div className="data-table">
        <div className="table-content">
          <table>
            <thead><tr><th>Code</th><th>Type</th><th>Usage</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              {inviteCodes.map((ic) => (
                <tr key={ic.id}>
                  <td><code className="code-text">{ic.code}</code></td>
                  <td><span className={`type-badge ${ic.type}`}>{ic.type?.toUpperCase()}</span></td>
                  <td>
                    <div className="usage-cell">
                      <span>{ic.uses_count || 0} / {ic.max_uses}</span>
                      <div className="usage-bar"><div className="usage-fill" style={{ width: `${Math.min(((ic.uses_count || 0) / ic.max_uses) * 100, 100)}%` }} /></div>
                    </div>
                  </td>
                  <td><span className={`status-badge ${ic.status}`}>{ic.status}</span></td>
                  <td><span className="date-text">{ic.expires_at ? new Date(ic.expires_at).toLocaleDateString() : "Never"}</span></td>
                  <td>
                    <button className="btn-icon danger" onClick={async () => {
                      await supabase.from("invite_codes").update({ status: "inactive" }).eq("id", ic.id);
                      loadInviteCodes();
                    }} title="Deactivate"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "overview": return renderOverview();
      case "team":     return renderTeam();
      case "roles":    return renderRoles();
      case "freeze":   return renderFreeze();
      case "invites":  return renderInvites();
      default: return (
        <div className="placeholder-section">
          <div className="placeholder-icon"><Settings size={48} /></div>
          <h2>{sections.find((s) => s.id === activeSection)?.label}</h2>
          <p>This section is under development</p>
        </div>
      );
    }
  };

  const currentRole = roles[userRole];

  return (
    <div className="admin-dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon"><Shield size={22} /></div>
            <span className="logo-text">Xeevia Admin</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Dashboard</div>
            {sections.map((s) => (
              <button key={s.id} className={`nav-item ${activeSection === s.id ? "active" : ""}`} onClick={() => setActiveSection(s.id)}>
                <s.icon size={18} />
                <span className="nav-label">{s.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="admin-profile">
            <div className="admin-avatar" style={{ background: currentRole?.color ? `${currentRole.color}30` : "#27272a" }}>
              <span style={{ color: currentRole?.color }}>{(adminData?.email || "A").charAt(0).toUpperCase()}</span>
            </div>
            <div className="admin-info">
              <div className="admin-name">{adminData?.full_name || "Admin"}</div>
              <div className="admin-role" style={{ color: currentRole?.color }}>{currentRole?.label || adminData?.role}</div>
            </div>
          </div>
          <button className="btn-secondary" style={{ width: "100%", marginTop: "8px", fontSize: "0.8rem" }} onClick={onClose}>
            <X size={14} /> Close Dashboard
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left"><h2 className="current-section">{sections.find((s) => s.id === activeSection)?.label}</h2></div>
          <div className="header-right"><button className="header-icon-btn"><Bell size={18} /></button></div>
        </header>
        <div className="dashboard-content">{renderSection()}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;