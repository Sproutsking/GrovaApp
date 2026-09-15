import { supabase } from "../config/supabase";
import { getConnector, listConnectors } from "./connectorRegistry";
import { normalizeConnectorPayload } from "./evidenceNormalizer";
import evidenceService from "./evidenceService";
import { registerDefaultConnectors } from "./connectors";

registerDefaultConnectors();

const buildConnectionProof = (connection, userId) => ({
  id: `connection:${connection.id}:identity`,
  provider: connection.provider,
  type: "profile",
  source: "connection",
  entityType: "person",
  externalId: connection.platform_user_id,
  title: `${connection.provider} identity`,
  summary: connection.connected_via === "profile_link"
    ? "Public profile link supplied by the account owner."
    : "External identity connected to this Xeevia account.",
  verified: false,
  confidence: connection.connected_via === "profile_link" ? "low" : "medium",
  profileId: userId,
  connectionId: connection.id,
  url: connection.connected_via === "profile_link" ? connection.platform_user_id : null,
  metadata: {
    proofType: "social",
    verificationLevel: "standard",
    connectionId: connection.id,
    platformUserId: connection.platform_user_id,
    connectedVia: connection.connected_via || "unknown",
  },
});

async function saveConnectionProof(connection, userId) {
  const [evidenceItem] = await evidenceService.saveEvidenceItems([
    buildConnectionProof(connection, userId),
  ]);
  return { connection, evidenceItems: evidenceItem ? [evidenceItem] : [], evidenceEdges: [] };
}

export async function syncConnectorEvidence(provider, context = {}) {
  const connector = getConnector(provider);

  const result = await connector.sync(context);
  const normalized = normalizeConnectorPayload({
    provider,
    profile: result.profile?.error ? null : result.profile,
    activity: Array.isArray(result.activity)
      ? result.activity
      : result.activity?.error ? [] : [result.activity],
    metadata: context,
  });

  return {
    provider,
    connection: result.connection,
    profile: normalized.profile,
    activity: normalized.activity,
    raw: result,
  };
}

export async function syncUserConnectorEvidence(userId, provider) {
  if (!userId) throw new Error("userId is required");
  if (!provider) throw new Error("provider is required");

  const connector = getConnector(provider);

  const { data: connection, error: connErr } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("auth_status", "active")
    .maybeSingle();

  if (connErr) throw connErr;
  if (!connection) throw new Error(`No active connection found for ${provider}`);

  if (!connector) return saveConnectionProof(connection, userId);

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("tokens")
    .select("encrypted_token, refresh_token, expires_at, revoked")
    .eq("connection_id", connection.id)
    .eq("revoked", false)
    .maybeSingle();

  if (tokenErr) throw tokenErr;
  if (!tokenRow) return saveConnectionProof(connection, userId);

  const context = {
    username: connection.platform_user_id,
    profileId: connection.platform_user_id,
    profileUrl: connection.connected_via === "profile_link" ? connection.platform_user_id : null,
    accessToken: tokenRow.encrypted_token,
    userId,
    connectionId: connection.id,
    connection,
  };

  const result = await connector.sync(context);
  const normalized = normalizeConnectorPayload({
    provider,
    profile: result.profile?.error ? null : result.profile,
    activity: Array.isArray(result.activity)
      ? result.activity
      : result.activity?.error ? [] : [result.activity],
    metadata: { ...context, fetchedAt: new Date().toISOString() },
  });

  const itemsToSave = [];

  if (normalized.profile) {
    itemsToSave.push({
      ...normalized.profile,
      profileId: userId,
      connectionId: connection.id,
    });
  }

  if (normalized.activity?.length) {
    normalized.activity.forEach((item) => {
      itemsToSave.push({
        ...item,
        profileId: userId,
        connectionId: connection.id,
      });
    });
  }

  const evidenceItems = await evidenceService.saveEvidenceItems(itemsToSave);

  const profileItem = evidenceItems.find((item) => item.evidence_type === "profile");
  const edges = [];

  evidenceItems
    .filter((item) => item.evidence_type === "activity")
    .forEach((activityItem) => {
      if (!profileItem) return;
      edges.push({
        id: `${profileItem.id}:${activityItem.id}:generated`,
        sourceId: profileItem.id,
        targetId: activityItem.id,
        relation: "generated",
        metadata: {
          provider,
          connectionId: connection.id,
          platformUserId: connection.platform_user_id,
        },
      });
    });

  const evidenceEdges = edges.length
    ? await evidenceService.saveEvidenceEdges(edges)
    : [];

  return {
    provider,
    connection,
    profile: normalized.profile,
    activity: normalized.activity,
    evidenceItems,
    evidenceEdges,
    raw: result,
  };
}

export async function syncAllUserConnectorEvidence(userId) {
  if (!userId) throw new Error("userId is required");

  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .eq("auth_status", "active");

  if (error) throw error;

  const results = await Promise.allSettled(
    (connections || []).map((connection) => syncUserConnectorEvidence(userId, connection.provider))
  );

  return {
    connections: connections || [],
    results,
    failures: results.filter((result) => result.status === "rejected"),
  };
}

export function getRegisteredConnectors() {
  return listConnectors();
}
