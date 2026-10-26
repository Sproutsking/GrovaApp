import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Bot, Check, ChevronRight, Crown, ShieldCheck, Ticket, UserPlus, Users2, Radio, Sparkles } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";

import { X } from "lucide-react";
import VerificationToolDashboard from "../../verification/VerificationToolDashboard";
import WelcomeToolDashboard from "../../verification/WelcomeToolDashboard";
import RulesVerificationDashboard from "../../verification/RulesVerificationDashboard";
import ModerationToolDashboard from "../../moderation/ModerationToolDashboard";
import { SOCIAL_UPDATE_PROVIDER_IDS } from "../../../../services/community/socialUpdatesService";
import { getInboundReadyPlatforms } from "../../../../services/community/platformCapabilities";
import { challengeIsReady, isMethodReady, isVerificationConfigEnabled, METHOD_ORDER, moveRoleAboveDefault, normalizeVerificationConfig } from "../../verification/verificationConfig";
import SocialUpdatesDashboard from "../../updates/SocialUpdatesDashboard";
import BotsDashboard from "../../bots/BotsDashboard";
import TicketToolDashboard from "../../tools/TicketToolDashboard";
import { useAccountLinking } from "../../../../contexts/AccountLinkingContext";
const TOOL_CATALOG = [
  { type: "verification", label: "Verification", description: "Gate access with role-based checks, rules, and identity verification.", icon: ShieldCheck },
  { type: "rules", label: "Rules", description: "Publish and manage community rules, with optional verification gating.", icon: Check },
  { type: "social_updates", label: "Social updates", description: "Deliver connected updates to selected channels.", icon: Radio },
  { type: "bots", label: "Bots", description: "Route posts to Discord servers and Telegram chats.", icon: Bot },
  { type: "tickets", label: "Tickets", description: "Give members a private support entry point.", icon: Ticket },
  { type: "welcome", label: "Welcome", description: "Show a polished introduction in a selected channel.", icon: Sparkles },
  { type: "moderation", label: "Moderation", description: "Automate safety, strikes, actions, and case history.", icon: ShieldCheck },
];

export default function ToolsSection({ communityId, userId, channels = [], canManage = false, canManageRoles = false, onCreateRole, onReorderRoles, onUpdateRole, onDeleteRole, onManageRole, onOpenInvite, onOpenUpgrade, onOpenModeration, onCreateChannel }) {
  const { openAccountLink } = useAccountLinking();
  const [rows, setRows] = useState([]);
  const [communityRoles, setCommunityRoles] = useState([]);
  const [accessRules, setAccessRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dashboardDataLoading, setDashboardDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceConnected, setSourceConnected] = useState(false);
  const [linkedSources, setLinkedSources] = useState([]);
  const [sourceProvider, setSourceProvider] = useState("x");
  const [sourceError, setSourceError] = useState("");
  const [dashboardTool, setDashboardTool] = useState(null);
  const [welcomeDashboardOpen, setWelcomeDashboardOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [focusedVerificationMode, setFocusedVerificationMode] = useState(null);

  useEffect(() => {
    let active = true;
    if (!communityId) {
      setDashboardDataLoading(false);
      return undefined;
    }
    setDashboardDataLoading(true);
    Promise.all([
      supabase.from("community_tool_settings").select("*").eq("community_id", communityId),
      supabase.from("community_roles").select("id,name,color,icon,position,is_default,permissions").eq("community_id", communityId).order("position", { ascending: true }),
      supabase.from("community_access_rules").select("target_type,target_id,role_id,can_view,can_send").eq("community_id", communityId),
      supabase.from("community_channel_categories").select("id,name").eq("community_id", communityId),
    ]).then(([settingsResult, rolesResult, accessResult, categoriesResult]) => {
      if (!active) return;
      const dataError = [settingsResult, rolesResult, accessResult, categoriesResult].find((result) => result.error)?.error;
      if (dataError) setError(dataError.message);
      setRows(settingsResult.data || []);
      setCommunityRoles(rolesResult.data || []);
      setAccessRules(accessResult.data || []);
      setCategories(categoriesResult.data || []);
      setDashboardDataLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError.message || "Could not load community tool settings.");
      setDashboardDataLoading(false);
    });
    setSourceConnected(false);
    setLinkedSources([]);
    supabase.from("community_social_connections").select("id").eq("community_id", communityId).eq("provider", "xeevia").maybeSingle()
      .then(({ data, error: sourceLoadError }) => {
        if (!active) return;
        if (sourceLoadError) setSourceError(sourceLoadError.message);
        else setSourceConnected(Boolean(data));
      });
    if (userId) supabase.from("connections").select("provider, platform_user_id, auth_status").eq("user_id", userId).eq("auth_status", "active")
      .then(({ data, error: linkedLoadError }) => {
        if (!active) return;
        if (linkedLoadError) setSourceError(linkedLoadError.message);
        else setLinkedSources((data || []).filter((source) => SOCIAL_UPDATE_PROVIDER_IDS.includes(source.provider)));
      });
    return () => { active = false; };
  }, [communityId, userId]);

  const getRow = (type) => rows.find((row) => row.tool_type === type) || { tool_type: type, enabled: false, config: {} };
  const selectedIds = (type) => {
    const row = getRow(type);
    const configured = row.config?.channel_ids;
    if (Array.isArray(configured)) return new Set(configured);
    return row.channel_id ? new Set([row.channel_id]) : new Set();
  };

  const createVerificationRole = async (name) => {
    if (!canManageRoles || !onCreateRole || !onReorderRoles) {
      throw new Error("You need Roles & Permissions access to create a verification role.");
    }
    const createdRole = await onCreateRole({ name, color: "#667eea", icon: "♟", permissions: {} });
    if (!createdRole?.id) throw new Error("The role was created but could not be loaded.");
    const { data: currentRoles, error: rolesError } = await supabase
      .from("community_roles")
      .select("id,community_id,name,color,icon,position,is_default,permissions")
      .eq("community_id", communityId)
      .order("position", { ascending: true });
    if (rolesError) throw rolesError;
    const orderedRoles = currentRoles || [];
    const createdIndex = orderedRoles.findIndex((role) => role.id === createdRole.id);
    const defaultIndex = orderedRoles.findIndex((role) => role.is_default);
    if (createdIndex >= 0 && defaultIndex >= 0 && createdIndex > defaultIndex) {
      const [newRole] = orderedRoles.splice(createdIndex, 1);
      orderedRoles.splice(defaultIndex, 0, newRole);
      await onReorderRoles(orderedRoles);
    }
    const { data: refreshedRoles, error: refreshError } = await supabase
      .from("community_roles")
      .select("id,community_id,name,color,icon,position,is_default,permissions")
      .eq("community_id", communityId)
      .order("position", { ascending: true });
    if (refreshError) throw refreshError;
    const updatedRoles = refreshedRoles || [];
    setCommunityRoles(updatedRoles);
    return updatedRoles.find((role) => role.id === createdRole.id) || createdRole;
  };

  const updateVerificationRole = async (roleId, updates) => {
    if (!canManageRoles || !onUpdateRole) {
      throw new Error("You need Roles & Permissions access to update this role.");
    }
    await onUpdateRole(roleId, updates);
    const { data: updatedRoles, error: refreshError } = await supabase
      .from("community_roles")
      .select("id,name,color,icon,position,is_default,permissions")
      .eq("community_id", communityId)
      .order("position", { ascending: true });
    if (refreshError) throw refreshError;
    setCommunityRoles(updatedRoles || []);
    return (updatedRoles || []).find((role) => role.id === roleId);
  };

  const deleteVerificationRole = async (roleId) => {
    if (!canManageRoles || !onDeleteRole) {
      throw new Error("You need Roles & Permissions access to delete this role.");
    }
    await onDeleteRole(roleId);
    const { data: updatedRoles, error: refreshError } = await supabase
      .from("community_roles")
      .select("id,name,color,icon,position,is_default,permissions")
      .eq("community_id", communityId)
      .order("position", { ascending: true });
    if (refreshError) throw refreshError;
    setCommunityRoles(updatedRoles || []);
  };

  const promoteVerificationRole = async (roleId) => {
    if (!canManageRoles || !onReorderRoles) {
      throw new Error("You need Roles & Permissions access to change role order.");
    }
    const reorderedRoles = moveRoleAboveDefault(communityRoles, roleId);
    if (!reorderedRoles) throw new Error("This role cannot be moved above the default member role.");
    await onReorderRoles(reorderedRoles);
    const { data: updatedRoles, error: refreshError } = await supabase
      .from("community_roles")
      .select("id,name,color,icon,position,is_default,permissions")
      .eq("community_id", communityId)
      .order("position", { ascending: true });
    if (refreshError) throw refreshError;
    setCommunityRoles(updatedRoles || []);
    const promotedRole = (updatedRoles || []).find((role) => role.id === roleId);
    if (!promotedRole) throw new Error("Role order changed but the role could not be reloaded.");
    return promotedRole;
  };

  const connectXeevia = async () => {
    if (!canManage) return;
    setSourceError("");
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const authenticatedUserId = user?.user?.id;
      if (!authenticatedUserId) throw new Error("Sign in before connecting Xeevia updates.");
      const { error: connectionError } = await supabase.from("community_social_connections").upsert({ community_id: communityId, connected_by: authenticatedUserId, provider: "xeevia", provider_account_id: authenticatedUserId, display_name: "Xeevia account", status: "active", scopes: ["internal:posts"], updated_at: new Date().toISOString() }, { onConflict: "community_id,provider,provider_account_id" });
      if (connectionError) throw connectionError;
      setSourceConnected(true);
    } catch (connectionError) {
      setSourceError(connectionError.message || "Could not connect Xeevia updates.");
    }
  };

  const linkSocialSource = async () => {
    if (!canManage) return;
    setSourceError("");
    try {
      if (!userId) throw new Error("Sign in before linking a social account.");
      if (!sourceProvider) throw new Error("Choose a platform to link.");
      const result = await openAccountLink({ userId, platform: sourceProvider, purpose: "community-social-updates" });
      if (result?.cancelled) return;
      const { data, error: queryError } = await supabase.from("connections")
        .select("provider, platform_user_id, auth_status")
        .eq("user_id", userId)
        .eq("auth_status", "active");
      if (queryError) throw queryError;
      setLinkedSources((data || []).filter((source) => SOCIAL_UPDATE_PROVIDER_IDS.includes(source.provider)));
      setSourceError("");
    } catch (linkError) {
      setSourceError(linkError?.message || "The account could not be linked.");
    }
  };

  const toggleChannel = async (type, channelId) => {
    if (!canManage) return;
    const row = getRow(type);
    const nextIds = selectedIds(type);
    if (nextIds.has(channelId)) nextIds.delete(channelId); else nextIds.add(channelId);
    const ids = [...nextIds];
    const nextRow = {
      community_id: communityId,
      tool_type: type,
      enabled: ids.length > 0 || (type === "verification" && isVerificationConfigEnabled(row.config)),
      channel_id: ids[0] || null,
      config: { ...(row.config || {}), channel_ids: ids },
      updated_at: new Date().toISOString(),
    };
    setError("");
    const previousRows = rows;
    setRows((current) => [...current.filter((item) => item.tool_type !== type), { ...row, ...nextRow }]);
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) { setRows(previousRows); setError(saveError.message); return; }
    const { error: clearError } = await supabase.from("community_channels").update({ tool_type: null, updated_at: new Date().toISOString() }).eq("community_id", communityId).eq("tool_type", type);
    if (clearError) { setRows(previousRows); setError(clearError.message); return; }
    if (ids.length) {
      const { error: markerError } = await supabase.from("community_channels").update({ tool_type: type, updated_at: new Date().toISOString() }).in("id", ids);
      if (markerError) { setRows(previousRows); setError(markerError.message); }
    }
  };

  const openDashboard = (tool) => {
    if (dashboardDataLoading) return;
    if (tool.type === "verification") {
      setFocusedVerificationMode(null);
      setDashboardTool({ ...tool, type: "verification" });
      return;
    }
    if (tool.type === "social_updates") {
      setDashboardTool(tool);
      return;
    }
    if (tool.type === "bots") {
      setDashboardTool(tool);
      return;
    }
    if (tool.type === "welcome") {
      setWelcomeDashboardOpen(true);
      return;
    }
    const row = getRow(tool.type);
    setDashboardTool(tool);
    setDraft({ ...(row.config || {}), mode: row.config?.mode || tool.modes?.[0]?.id || "default" });
  };

  const saveDashboard = async (configOverride) => {
    if (!canManage || !dashboardTool) return false;
    const row = getRow(dashboardTool.type);
    const settingsOverride = configOverride && typeof configOverride.preventDefault !== "function" ? configOverride : null;
    const nextRow = { ...row, community_id: communityId, tool_type: dashboardTool.type, enabled: Boolean(row.enabled || selectedIds(dashboardTool.type).size), channel_id: row.channel_id || null, config: { ...(row.config || {}), ...draft, ...(settingsOverride || {}) }, updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) { setError(saveError.message); return false; }
    setRows((current) => [...current.filter((item) => item.tool_type !== dashboardTool.type), nextRow]);
    setDraft(nextRow.config);
    setError("");
    return true;
  };

  const saveVerificationConfig = async (config) => {
    if (!canManage || !dashboardTool) return;
    const row = getRow("verification");
    const nextConfig = normalizeVerificationConfig(config);
    const nextRow = {
      ...row,
      community_id: communityId,
      tool_type: "verification",
      enabled: Boolean(selectedIds("verification").size || isVerificationConfigEnabled(nextConfig)),
      channel_id: row.channel_id || null,
      config: nextConfig,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) throw saveError;
    setRows((current) => [...current.filter((item) => item.tool_type !== "verification"), nextRow]);
    setFocusedVerificationMode(null);
  };

  const saveRulesConfig = async ({ rulesMethod, roleGrant, experience, ...rulesGate }) => {
    const current = normalizeVerificationConfig(getRow("verification").config);
    await saveVerificationConfig({
      ...current,
      ...(experience || {}),
      rulesGate,
      roleGrant,
      rulesEnabled: Boolean(rulesGate.enabled),
      methods: { ...current.methods, rules: rulesMethod },
    });
  };

  const saveModerationConfig = async (config) => {
    if (!canManage || !dashboardTool) return;
    const row = getRow("moderation");
    const nextRow = { ...row, community_id: communityId, tool_type: "moderation", enabled: config.enabled !== false, channel_id: row.channel_id || null, config, updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) throw saveError;
    setRows((current) => [...current.filter((item) => item.tool_type !== "moderation"), nextRow]);
  };

  const saveWelcomeConfig = async (config) => {
    if (!canManage) return;
    const row = getRow("welcome");
    const nextConfig = { ...config, introChannelId: row.config?.introChannelId || config.introChannelId || "" };
    const nextRow = { ...row, community_id: communityId, tool_type: "welcome", enabled: Boolean(row.enabled || selectedIds("welcome").size), channel_id: row.channel_id || null, config: nextConfig, updated_at: new Date().toISOString() };
    const previousRows = rows;
    setRows((current) => [...current.filter((item) => item.tool_type !== "welcome"), nextRow]);
    setError("");
    window.dispatchEvent(new CustomEvent("community:welcome-settings-updated", { detail: { communityId, config: nextConfig } }));
    const { error: saveError } = await supabase.from("community_tool_settings").upsert(nextRow, { onConflict: "community_id,tool_type" });
    if (saveError) {
      setRows(previousRows);
      setError(saveError.message);
    }
  };

  const navigation = [
    { label: "Invite people", description: "Create or manage invite links.", icon: UserPlus, onClick: onOpenInvite },
    { label: "Customize community", description: "Shape your community identity, tools, and controls.", icon: Crown, onClick: onOpenUpgrade },
    { label: "Roles & moderation", description: "Manage roles, permissions, and member access.", icon: Users2, onClick: onOpenModeration },
  ];

  return (
    <section className="community-tools-section">
      <div className="tools-intro"><strong>Community tools</strong><span>{dashboardDataLoading ? "Loading saved tool settings…" : "Choose a tool, then send its member-facing panel to one or more channels."}</span></div>
      {navigation.map((item) => (
        <button type="button" className="community-tool-card" key={item.label} onClick={item.onClick}>
          <span className="community-tool-icon"><item.icon size={17} /></span><span className="community-tool-copy"><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={15} />
        </button>
      ))}
      {TOOL_CATALOG.map((tool) => {
        const selected = selectedIds(tool.type);
        const verificationConfig = normalizeVerificationConfig(getRow("verification").config);
        const verificationActive = isVerificationConfigEnabled(verificationConfig);
        const verificationRoleMap = new Map(communityRoles.map((role) => [role.id, role]));
        const verificationCheckReady = METHOD_ORDER.some((method) =>
          isMethodReady(method, verificationConfig.methods[method], verificationRoleMap, verificationConfig.methods, verificationConfig),
        );
        const hasRulesRoute = Boolean(
          verificationConfig.rulesGate.enabled
          && verificationConfig.rulesGate.rulesChannelId
          && (verificationConfig.rulesGate.flow !== "rules_then_verify" || verificationConfig.rulesGate.verificationChannelId),
        );
        const verificationReady = verificationCheckReady && (selected.size > 0 || hasRulesRoute);
        const rulesActive = verificationConfig.rulesGate.enabled;
        const rulesSaved = Boolean(getRow("verification").config?.methods?.rules?.items?.some((rule) => rule.title?.trim()));
        return (
          <button type="button" className="community-tool-card" key={tool.type} disabled={dashboardDataLoading} onClick={() => openDashboard(tool)}>
            <span className="community-tool-icon"><tool.icon size={17} /></span>
            <span className="community-tool-copy">
              <strong>{tool.label}</strong>
              <small>{tool.type === "verification"
                ? verificationReady
                  ? "Ready · checks, channels, and access roles are configured."
                  : verificationActive || selected.size
                    ? "Needs setup · review channels, checks, and eligible roles."
                    : "Configure entry channels, checks, and member access roles."
                : tool.type === "rules" ? tool.description : tool.description}</small>
            </span>
            <em>{tool.type === "verification"
              ? verificationReady ? "Ready" : verificationActive || selected.size ? "Needs setup" : "Set up"
              : tool.type === "rules" ? rulesActive ? "On" : rulesSaved ? "Draft" : "Set up"
                : selected.size ? `${selected.size} channel${selected.size > 1 ? "s" : ""}` : "Off"}</em>
            <ChevronRight size={15} />
          </button>
        );
      })}
      {error && <p className="community-tools-error">{error}</p>}
      {dashboardTool && dashboardTool.type === "social_updates" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay" style={{ zIndex: 100002 }}>
          <section className="tool-dashboard">
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>Social updates</h2>
                <p>Connect sources, route activity, and run a real inbound sync.</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close social updates dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <SocialUpdatesDashboard
                communityId={communityId}
                userId={userId}
                channels={channels}
                linkedSources={linkedSources}
                canManage={canManage}
                onCreateChannel={onCreateChannel}
                sourceConnected={sourceConnected}
                onConnectXeevia={connectXeevia}
                sourceProvider={sourceProvider}
                onSourceProviderChange={setSourceProvider}
                availableProviders={getInboundReadyPlatforms().filter((provider) => provider !== "xeevia" && SOCIAL_UPDATE_PROVIDER_IDS.includes(provider))}
                onLinkSocialSource={linkSocialSource}
                sourceError={sourceError}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && dashboardTool.type === "bots" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay" style={{ zIndex: 100002 }}>
          <section className="tool-dashboard">
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>Bots</h2>
                <p>Connect Discord and Telegram destinations for outbound posts.</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close bots dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body"><BotsDashboard communityId={communityId} userId={userId} canManage={canManage} /></div>
          </section>
        </div>,
        document.body,
      )}
      {welcomeDashboardOpen && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay">
          <section className="tool-dashboard">
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>Welcome experience</h2>
                <p>Design the first impression members see when they arrive.</p>
              </div>
              <button type="button" onClick={() => setWelcomeDashboardOpen(false)} aria-label="Close welcome dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <div className="tool-dashboard-block">
                <strong>Welcome card channel</strong>
                <p className="tool-dashboard-help">Select or create the channel where every welcome card will be posted.</p>
                <select disabled={!canManage} value={getRow("welcome").channel_id || ""} onChange={(event) => toggleChannel("welcome", event.target.value)}>
                  <option value="">Select a channel</option>
                  {channels.filter((channel) => channel.type !== "voice").map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
                <button type="button" disabled={!canManage} className="welcome-create-channel" onClick={onCreateChannel}>+ Create a channel first</button>
              </div>
              <div className="tool-dashboard-block">
                <strong>Member introduction destination</strong>
                <p className="tool-dashboard-help">Choose the channel opened by “Introduce yourself”.</p>
                <select
                  disabled={!canManage}
                  value={getRow("welcome").config?.introChannelId || ""}
                  onChange={(event) => setRows((current) => [...current.filter((item) => item.tool_type !== "welcome"), {
                    ...getRow("welcome"),
                    config: { ...(getRow("welcome").config || {}), introChannelId: event.target.value },
                  }])}
                >
                  <option value="">Select a channel</option>
                  {channels.filter((channel) => channel.type !== "voice").map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <WelcomeToolDashboard value={getRow("welcome").config} communityName="your community" channels={channels} disabled={!canManage} onSave={saveWelcomeConfig} />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && dashboardTool.type === "verification" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay verification-dashboard-overlay" style={{ zIndex: 100002 }}>
          <section className="tool-dashboard tool-dashboard-verification" onClick={(event) => event.stopPropagation()}>
            <header style={{ borderBottom: "none" }}>
              <div>
                <span className="tool-dashboard-kicker">Community access setup</span>
                <h2>{focusedVerificationMode === "quick" ? "Quick verify" : focusedVerificationMode === "picture" ? "Picture check" : focusedVerificationMode === "reaction" ? "Reaction check" : focusedVerificationMode === "rules_gate" ? "Rules gate" : focusedVerificationMode === "role_grant" ? "Reward roles" : "Verification"}</h2>
                <p>{focusedVerificationMode ? "Configure this step, save, then return to the setup overview." : "Connect the channel, check, and role so members can complete verification and reach the right channels."}</p>
              </div>
              <div className="tool-dashboard-header-actions">
                {focusedVerificationMode && <button type="button" className="tool-dashboard-back" onClick={() => setFocusedVerificationMode(null)}>Back to setup</button>}
                <button type="button" onClick={() => { setDashboardTool(null); setFocusedVerificationMode(null); }} aria-label="Close verification dashboard"><X size={18} /></button>
              </div>
            </header>
            <div className={`tool-dashboard-body${focusedVerificationMode ? " verification-focused-body" : ""}`}>
              <VerificationToolDashboard
                key={focusedVerificationMode || "verification-root"}
                value={getRow("verification").config}
                focusMode={focusedVerificationMode}
                channels={channels}
                roles={communityRoles}
                communityId={communityId}
                canManageRoles={canManageRoles}
                categories={categories}
                accessRules={accessRules}
                selectedChannelIds={[...selectedIds("verification")]}
                onToggleChannel={(channelId) => toggleChannel("verification", channelId)}
                channelError={error}
                disabled={!canManage}
                onCreateRole={canManageRoles ? createVerificationRole : undefined}
                onUpdateRole={canManageRoles ? updateVerificationRole : undefined}
                onPromoteRole={canManageRoles ? promoteVerificationRole : undefined}
                onManageRole={canManageRoles ? onManageRole : undefined}
                onDeleteRole={canManageRoles ? deleteVerificationRole : undefined}
                onSave={saveVerificationConfig}
                onModeSelect={(mode) => setFocusedVerificationMode(mode)}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && dashboardTool.type === "rules" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay" style={{ zIndex: 100002 }}>
          <section className="tool-dashboard" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tools</span>
                <h2>Rules</h2>
                <p>Set community rules on their own, or use them as a verification gate.</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close rules dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <RulesVerificationDashboard
                key="community-rules-dashboard"
                communityId={communityId}
                value={normalizeVerificationConfig(getRow("verification").config).rulesGate}
                experienceConfig={normalizeVerificationConfig(getRow("verification").config)}
                rulesMethod={normalizeVerificationConfig(getRow("verification").config).methods.rules}
                methods={normalizeVerificationConfig(getRow("verification").config).methods}
                roleGrant={normalizeVerificationConfig(getRow("verification").config).roleGrant}
                roles={communityRoles}
                pictureReady={challengeIsReady(normalizeVerificationConfig(getRow("verification").config))}
                channels={channels}
                categories={categories}
                accessRules={accessRules}
                disabled={!canManage}
                onCreateRole={canManageRoles ? createVerificationRole : undefined}
                onUpdateRole={canManageRoles ? updateVerificationRole : undefined}
                onPromoteRole={canManageRoles ? promoteVerificationRole : undefined}
                onManageRole={canManageRoles ? onManageRole : undefined}
                onDeleteRole={canManageRoles ? deleteVerificationRole : undefined}
                canManageRoles={canManageRoles}
                standalone
                onSave={saveRulesConfig}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && dashboardTool.type === "moderation" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay" style={{ zIndex: 100002 }}>
          <section className="tool-dashboard">
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>Moderation</h2>
                <p>Build a live safety system for this community.</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close moderation dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <ModerationToolDashboard communityId={communityId} value={getRow("moderation").config} disabled={!canManage} onSave={saveModerationConfig} />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && dashboardTool.type === "tickets" && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay">
          <section className="tool-dashboard tool-dashboard-ticket" style={{ width: "min(1040px, 100%)", maxHeight: "min(900px, calc(100vh - 36px))" }}>
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>Tickets</h2>
                <p>Configure the support entry point and preview what members will see.</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close tickets dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <TicketToolDashboard
                value={getRow("tickets").config}
                channels={channels}
                selectedChannelIds={[...selectedIds("tickets")]}
                disabled={!canManage}
                onToggleChannel={(channelId) => toggleChannel("tickets", channelId)}
                onSave={saveDashboard}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
      {dashboardTool && !["social_updates", "bots", "tickets", "verification", "rules", "moderation"].includes(dashboardTool.type) && ReactDOM.createPortal(
        <div className="tool-dashboard-overlay">
          <section className="tool-dashboard">
            <header>
              <div>
                <span className="tool-dashboard-kicker">Community tool dashboard</span>
                <h2>{dashboardTool.label}</h2>
                <p>{dashboardTool.description}</p>
              </div>
              <button type="button" onClick={() => setDashboardTool(null)} aria-label="Close tool dashboard"><X size={18} /></button>
            </header>
            <div className="tool-dashboard-body">
              <div className="tool-dashboard-block">
                <strong>Tool type</strong>
                <div className="tool-mode-grid">
                  {(dashboardTool.modes || [{ id: "default", label: "Standard", description: "Use the standard configuration for this tool." }]).map((mode) => (
                    <button type="button" key={mode.id} className={`tool-mode-card${draft.mode === mode.id ? " selected" : ""}`} onClick={() => setDraft((current) => ({ ...current, mode: mode.id }))}>
                      <span>{draft.mode === mode.id ? <Check size={14} /> : null}</span>
                      <b>{mode.label}</b><small>{mode.description}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="tool-dashboard-block">
                <strong>Member-facing channels</strong>
                <p className="tool-dashboard-help">Choose where this tool is available. Selecting a channel opens it in the channel list without changing your existing channel arrangement.</p>
                <div className="tool-channel-grid">
                  {channels.filter((channel) => channel.type !== "voice").map((channel) => (
                    <button type="button" disabled={!canManage} className={`community-tool-channel${selectedIds(dashboardTool.type).has(channel.id) ? " selected" : ""}`} key={channel.id} onClick={() => toggleChannel(dashboardTool.type, channel.id)}>
                      <i>{selectedIds(dashboardTool.type).has(channel.id) ? <Check size={12} /> : null}</i>#{channel.name}
                    </button>
                  ))}
                </div>
              </div>
              {dashboardTool.type === "welcome" && (
                <div className="tool-dashboard-block">
                  <strong>Welcome content</strong>
                  <input disabled={!canManage} value={draft.title || "Welcome to our community"} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Welcome title" maxLength={150} />
                  <textarea disabled={!canManage} value={draft.description || "Introduce yourself and join the conversation."} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Welcome description" rows={4} maxLength={500} />
                </div>
              )}
            </div>
            <footer>
              <button type="button" className="tool-dashboard-cancel" onClick={() => setDashboardTool(null)}>Cancel</button>
              <button type="button" className="tool-dashboard-save" disabled={!canManage} onClick={saveDashboard}>Save tool setup</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
      <style>{`
        .community-tools-section{padding:10px;display:flex;flex-direction:column;gap:7px}.tools-intro{display:flex;flex-direction:column;gap:4px;padding:5px 3px 9px}.tools-intro strong{color:var(--text);font-size:16px}.tools-intro span{color:var(--text-secondary);font-size:11px;line-height:1.5}.community-tool-card{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer;font:inherit}.community-tool-card:hover{border-color:var(--accent-border);background:var(--surface-strong)}.community-tool-icon{width:34px;height:34px;display:grid;place-items:center;flex-shrink:0;border-radius:9px;background:var(--accent-bg);color:var(--accent)}.community-tool-copy{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.community-tool-copy strong{font-size:12px}.community-tool-copy small{color:var(--text-secondary);font-size:10px;line-height:1.3}.community-tool-card em{font-style:normal;color:var(--accent);font-size:10px;font-weight:800}.community-tool-group.open>.community-tool-card svg:last-child{transform:rotate(90deg)}.community-tool-picker{display:flex;flex-direction:column;gap:3px;padding:8px 9px 9px;margin-top:-2px;border:1px solid var(--accent-border);border-top:0;border-radius:0 0 10px 10px;background:rgba(0,0,0,.18)}.community-tool-picker>span{padding:2px 3px 5px;color:var(--text-secondary);font-size:10px}.community-tool-picker-help{margin:3px;color:var(--text-secondary);font-size:10px;line-height:1.45}.community-verification-configure{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin-top:5px;padding:9px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-bg);color:var(--accent);font:800 11px inherit;cursor:pointer}.community-verification-configure:disabled{opacity:.5;cursor:not-allowed}.community-tool-channel{display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font:600 12px inherit;text-align:left;cursor:pointer}.community-tool-channel:hover,.community-tool-channel.selected{background:var(--accent-bg);color:var(--accent)}.community-tool-channel i{width:15px;height:15px;display:grid;place-items:center;border:1px solid var(--accent-border);border-radius:4px;font-style:normal}.community-tools-error{margin:4px 2px;color:var(--danger);font-size:11px}
      `}</style>
      <style>{`.tool-dashboard-overlay{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.58);backdrop-filter:blur(8px)}.tool-dashboard{width:min(680px,100%);max-height:min(760px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;background:var(--surface-strong);border:1px solid var(--accent-border);border-radius:16px;box-shadow:0 24px 90px rgba(0,0,0,.65)}.tool-dashboard header,.tool-dashboard footer{display:flex;align-items:center;gap:12px;padding:16px 18px;border-color:var(--surface-border)}.tool-dashboard header{justify-content:space-between;border-bottom:1px solid var(--surface-border)}.tool-dashboard header h2{margin:3px 0;font-size:20px;color:var(--text)}.tool-dashboard header p,.tool-dashboard-help{margin:0;color:var(--text-secondary);font-size:11px;line-height:1.5}.tool-dashboard header button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:var(--surface);color:var(--text-secondary);cursor:pointer}.tool-dashboard-header-actions{display:flex;align-items:center;gap:7px;flex-shrink:0}.tool-dashboard header .tool-dashboard-back{width:auto;padding:0 9px;color:var(--accent);font-size:10px;font-weight:800}.tool-dashboard-body{overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}.tool-dashboard-kicker{color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.tool-dashboard-block{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(0,0,0,.12)}.tool-dashboard-block strong{font-size:12px;color:var(--text)}.tool-mode-grid,.tool-channel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.tool-mode-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}.tool-mode-card.selected{border-color:var(--accent-border-strong);background:var(--accent-bg)}.tool-mode-card span{color:var(--accent);height:14px}.tool-mode-card b{font-size:11px}.tool-mode-card small{color:var(--text-secondary);font-size:10px;line-height:1.4}.tool-dashboard-block input,.tool-dashboard-block textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit}.tool-dashboard footer{justify-content:flex-end;border-top:1px solid var(--surface-border)}.tool-dashboard-cancel,.tool-dashboard-save{padding:10px 14px;border-radius:8px;font:800 11px inherit;cursor:pointer}.tool-dashboard-cancel{border:1px solid var(--surface-border);background:var(--surface);color:var(--text-secondary)}.tool-dashboard-save{border:1px solid var(--accent-border);background:var(--accent-bg);color:var(--accent)}@media(max-width:700px){.tool-dashboard-overlay{align-items:stretch;padding:0}.tool-dashboard{width:100%;height:100dvh;max-height:none;border:0;border-radius:0}.tool-dashboard header{padding:18px 16px}.tool-dashboard-body{padding:14px 16px}.tool-dashboard footer{padding:14px 16px}.tool-dashboard-save,.tool-dashboard-cancel{flex:1;padding:12px}}`}</style>
      <style>{`.tool-dashboard-overlay{align-items:stretch!important;justify-content:stretch!important;padding:0!important;background:var(--app-background,#0b0d0e)!important;backdrop-filter:none!important}.tool-dashboard{width:100%!important;height:100dvh!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important}.tool-dashboard-body{flex:1;min-height:0}.tool-dashboard header,.tool-dashboard footer{flex-shrink:0}`}</style>
      <style>{`.tool-dashboard-overlay.verification-dashboard-overlay{align-items:center!important;justify-content:center!important;padding:18px!important;background:rgba(0,0,0,.58)!important;backdrop-filter:blur(8px)!important}.tool-dashboard-overlay.verification-dashboard-overlay .tool-dashboard-verification{width:min(1160px,calc(100vw - 36px))!important;height:auto!important;max-height:min(760px,calc(100dvh - 36px))!important;border:1px solid var(--accent-border)!important;border-radius:12px!important;box-shadow:0 24px 90px rgba(0,0,0,.65)!important}.tool-dashboard-verification .tool-dashboard-body{overflow:auto;overscroll-behavior:contain;padding:12px 16px}.tool-dashboard-verification .verification-focused-body{overflow:hidden!important;padding:10px 16px}.tool-dashboard-verification .verification-focused-workspace{flex:0 0 auto!important}@media(max-width:900px){.tool-dashboard-overlay.verification-dashboard-overlay{padding:10px!important}.tool-dashboard-overlay.verification-dashboard-overlay .tool-dashboard-verification{width:100%!important;height:calc(100dvh - 20px)!important;max-height:calc(100dvh - 20px)!important}.tool-dashboard-verification .tool-dashboard-body{padding:10px}.tool-dashboard-verification .verification-focused-body{overflow:auto!important}.tool-dashboard-verification .verification-focused-workspace{flex:0 0 auto!important}}`}</style>
    </section>
  );
}
