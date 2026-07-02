import { supabase } from "../config/supabase";

class EvidenceService {
  async saveEvidenceItems(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const rows = items.map((item) => ({
      id: item.id,
      provider: item.provider || "unknown",
      profile_id: item.profileId || null,
      connection_id: item.connectionId || null,
      evidence_type: item.type || "profile",
      entity_type: item.entityType || "person",
      external_id: item.externalId || null,
      title: item.title || null,
      summary: item.summary || null,
      description: item.description || null,
      url: item.url || null,
      source: item.source || "connector",
      verified: item.verified === true,
      confidence: item.confidence || "medium",
      metadata: item.metadata || {},
      raw: item.raw || null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("evidence_items")
      .upsert(rows, { onConflict: ["id"] })
      .select();

    if (error) throw error;
    return data || [];
  }

  async saveEvidenceEdges(edges = []) {
    if (!Array.isArray(edges) || edges.length === 0) return [];

    const rows = edges.map((edge) => ({
      id: edge.id || `${edge.sourceId}:${edge.targetId}:${edge.relation}`,
      source_id: edge.sourceId,
      target_id: edge.targetId,
      relation: edge.relation || "related_to",
      metadata: edge.metadata || {},
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("evidence_edges")
      .upsert(rows, { onConflict: ["id"] })
      .select();

    if (error) throw error;
    return data || [];
  }

  async getEvidenceForProfile(profileId, options = {}) {
    const query = supabase
      .from("evidence_items")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (options.limit) query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async searchEvidence(profileId, queryText = "", options = {}) {
    const query = supabase
      .from("evidence_items")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (queryText && queryText.trim()) {
      const term = `%${queryText.trim()}%`;
      query.or(
        `title.ilike.${term},summary.ilike.${term},description.ilike.${term},provider.ilike.${term},evidence_type.ilike.${term}`
      );
    }

    if (options.limit) query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getEvidenceEdgesForItemIds(itemIds = [], options = {}) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return [];

    const sourceEdges = await supabase
      .from("evidence_edges")
      .select("*")
      .in("source_id", itemIds)
      .order("created_at", { ascending: false });

    if (sourceEdges.error) throw sourceEdges.error;

    const targetEdges = await supabase
      .from("evidence_edges")
      .select("*")
      .in("target_id", itemIds)
      .order("created_at", { ascending: false });

    if (targetEdges.error) throw targetEdges.error;

    const merged = [...(sourceEdges.data || []), ...(targetEdges.data || [])];
    const unique = [];
    const seen = new Set();
    merged.forEach((edge) => {
      if (!edge || !edge.id) return;
      if (!seen.has(edge.id)) {
        seen.add(edge.id);
        unique.push(edge);
      }
    });

    if (options.limit) return unique.slice(0, options.limit);
    return unique;
  }

  async getEvidenceGraph(profileId, options = {}) {
    const items = await this.getEvidenceForProfile(profileId, options);
    if (!items.length) return { items: [], edges: [] };

    const itemIds = items.map((item) => item.id).filter(Boolean);
    const edges = await this.getEvidenceEdgesForItemIds(itemIds, options);
    return { items, edges };
  }

  async searchEvidenceGraph(profileId, queryText = "", options = {}) {
    const items = await this.searchEvidence(profileId, queryText, options);
    if (!items.length) return { items: [], edges: [] };

    const itemIds = items.map((item) => item.id).filter(Boolean);
    const edges = await this.getEvidenceEdgesForItemIds(itemIds, options);
    return { items, edges };
  }
}

const evidenceService = new EvidenceService();
export default evidenceService;
