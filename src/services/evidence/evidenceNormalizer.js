function makeId(prefix, value) {
  const base = value ? String(value) : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${base}`.replace(/\s+/g, "-").toLowerCase();
}

export function createEvidenceItem(payload = {}) {
  return {
    id: payload.id || makeId(payload.provider || "evidence", payload.externalId || payload.title || payload.source),
    provider: payload.provider || "unknown",
    type: payload.type || "profile",
    source: payload.source || "connector",
    entityType: payload.entityType || "person",
    externalId: payload.externalId || null,
    title: payload.title || null,
    summary: payload.summary || null,
    description: payload.description || null,
    url: payload.url || null,
    verified: Boolean(payload.verified),
    confidence: payload.confidence || "medium",
    createdAt: payload.createdAt || null,
    metadata: payload.metadata || {},
    raw: payload.raw || null,
  };
}

export function normalizeProfileEvidence({ provider, profile, metadata = {} }) {
  if (!profile) return null;

  const username = profile.username || profile.login || profile.handle || profile.id;
  return createEvidenceItem({
    provider,
    type: "profile",
    source: "profile",
    entityType: "person",
    externalId: profile.id || username,
    title: profile.name || username,
    summary: profile.bio || profile.description || null,
    description: profile.bio || profile.description || null,
    url: profile.url || profile.html_url || null,
    verified: Boolean(profile.verified || profile.verified_at),
    confidence: profile.confidence || "high",
    createdAt: profile.created_at || profile.createdAt || null,
    metadata: {
      ...metadata,
      username,
      avatarUrl: profile.avatar_url || profile.avatarUrl || profile.profile_image_url || null,
      location: profile.location || null,
    },
    raw: profile,
  });
}

export function normalizeActivityEvidence({ provider, activity, metadata = {} }) {
  if (!activity) return null;

  const title = activity.title || activity.type || activity.event || activity.name || "Activity";
  const summary = activity.text || activity.body || activity.summary || activity.message || null;

  return createEvidenceItem({
    provider,
    type: "activity",
    source: "activity",
    entityType: activity.entityType || "content",
    externalId: activity.id || activity.event_id || activity.node_id || title,
    title,
    summary,
    description: summary,
    url: activity.url || activity.html_url || null,
    verified: Boolean(activity.verified),
    confidence: activity.confidence || "medium",
    createdAt: activity.created_at || activity.createdAt || activity.timestamp || null,
    metadata: {
      ...metadata,
      kind: activity.kind || activity.type || null,
    },
    raw: activity,
  });
}

export function normalizeConnectorPayload({ provider, profile, activity, metadata = {} }) {
  const normalizedProfile = profile ? normalizeProfileEvidence({ provider, profile, metadata }) : null;
  const normalizedActivity = Array.isArray(activity)
    ? activity.map((item) => normalizeActivityEvidence({ provider, activity: item, metadata })).filter(Boolean)
    : [];

  return {
    provider,
    profile: normalizedProfile,
    activity: normalizedActivity,
  };
}
