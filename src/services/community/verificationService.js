import { supabase } from "../config/supabase";
import { getVerificationChannelIds, METHOD_ORDER, normalizeVerificationConfig, toPublicPanel } from "../../components/Community/verification/verificationConfig";

function normalizeVerificationData(invoice) {
  const result = invoice || { configured: false };
  return result;
}

const PANEL_CACHE_TTL_MS = 90_000;
const MAX_CACHED_PANELS = 100;
const panelCache = new Map();
const panelRequests = new Map();
const panelRevisions = new Map();
const panelCacheKey = (communityId, userId) => JSON.stringify([String(communityId), String(userId)]);

const verificationService = {
  getPanel(communityId, { userId, force = false } = {}) {
    if (!userId) return this.loadPanel(communityId);

    const key = panelCacheKey(communityId, userId);
    const cached = panelCache.get(key);
    if (!force && cached && Date.now() - cached.cachedAt < PANEL_CACHE_TTL_MS) {
      return Promise.resolve(cached.panel);
    }
    if (!force && panelRequests.has(key)) return panelRequests.get(key);

    const revision = panelRevisions.get(String(communityId)) || 0;
    const request = this.loadPanel(communityId)
      .then((panel) => {
        if ((panelRevisions.get(String(communityId)) || 0) === revision) {
          if (!panelCache.has(key) && panelCache.size >= MAX_CACHED_PANELS) {
            panelCache.delete(panelCache.keys().next().value);
          }
          panelCache.set(key, { panel, cachedAt: Date.now() });
        }
        return panel;
      })
      .finally(() => {
        if (panelRequests.get(key) === request) panelRequests.delete(key);
      });
    panelRequests.set(key, request);
    return request;
  },

  invalidatePanel(communityId, userId) {
    const communityKey = String(communityId);
    panelRevisions.set(communityKey, (panelRevisions.get(communityKey) || 0) + 1);
    const keys = userId
      ? [panelCacheKey(communityId, userId)]
      : [...new Set([...panelCache.keys(), ...panelRequests.keys()])].filter((key) => JSON.parse(key)[0] === communityKey);
    keys.forEach((key) => {
      panelCache.delete(key);
      panelRequests.delete(key);
    });
  },

  async loadPanel(communityId) {
    try {
      const [panelResult, settingsResult] = await Promise.all([
        supabase.rpc("get_verification_panel", { p_community_id: communityId }),
        supabase.from("community_tool_settings").select("channel_id").eq("community_id", communityId).eq("tool_type", "verification").maybeSingle(),
      ]);
      const { data, error } = panelResult;
      if (error) throw error;
      if (settingsResult.error) throw settingsResult.error;
      if (!data?.configured) return { configured: false };

      const config = {
        ...normalizeVerificationConfig(data.config),
        _pictureChallengeReady: Boolean(data.picture_challenge_ready),
      };
      const roleIds = [...new Set([
        ...(config.roleGrant.enabled ? config.roleGrant.roleIds : []),
        ...METHOD_ORDER.map((method) => config.methods[method]?.roleId).filter(Boolean),
      ])];
      let roles = [];
      if (roleIds.length) {
        const [rolesResult, defaultRoleResult] = await Promise.all([
          supabase
          .from("community_roles")
          .select("id,name,color,icon,position,is_default,permissions")
          .eq("community_id", communityId)
          .in("id", roleIds),
          supabase
            .from("community_roles")
            .select("id,name,color,icon,position,is_default,permissions")
            .eq("community_id", communityId)
            .eq("is_default", true)
            .limit(1),
        ]);
        if (rolesResult.error) throw rolesResult.error;
        if (defaultRoleResult.error) throw defaultRoleResult.error;
        roles = [
          ...(rolesResult.data || []),
          ...(defaultRoleResult.data || []).filter((role) => !(rolesResult.data || []).some((chosen) => chosen.id === role.id)),
        ];
      } else {
        const { data: defaultRoles, error: defaultRoleError } = await supabase
          .from("community_roles")
          .select("id,name,color,icon,position,is_default,permissions")
          .eq("community_id", communityId)
          .eq("is_default", true)
          .limit(1);
        if (defaultRoleError) throw defaultRoleError;
        roles = defaultRoles || [];
      }
      const roleMap = new Map(roles.map((role) => [role.id, role]));
      const panel = toPublicPanel(config, roleMap, { targetLabel: data.picture_target_label || "" });
      const completions = Array.isArray(data.completions) ? data.completions : [];
      return normalizeVerificationData({
        ...panel,
        configured: Boolean(data.configured),
        channelIds: getVerificationChannelIds(config, settingsResult.data?.channel_id),
        state: {
          completed: completions
            .filter((item) => item.status === "completed" || item.status === "rules_accepted")
            .map((item) => item.method),
          pending: completions
            .filter((item) => item.status === "role_selection_pending")
            .map((item) => item.method),
          rulesAccepted: completions.some((item) =>
            item.method === "rules" && ["rules_accepted", "completed"].includes(item.status),
          ),
        },
      });
    } catch (error) {
      console.error("Verification panel load failed:", error);
      throw error;
    }
  },

  async complete(communityId, method, payload = {}) {
    try {
      const { data, error } = method === "reaction"
        ? await supabase.rpc("complete_community_reaction_verification", {
          p_community_id: communityId,
          p_answer: payload?.answer ?? null,
          p_role_id: payload?.roleId ?? null,
        })
        : await supabase.rpc("complete_community_verification", {
          p_community_id: communityId,
          p_method: method,
          p_answer: payload?.answer ?? null,
          p_accepted: Boolean(payload?.accepted),
          p_role_id: payload?.roleId ?? null,
        });
      if (error) throw error;
      return data || { success: false, error: "Verification failed." };
    } catch (error) {
      console.error("Verification completion failed:", error);
      throw error;
    }
  },
};

export default verificationService;
