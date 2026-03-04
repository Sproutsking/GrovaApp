// ============================================================================
// services/xrc/rootChainService.js
// XRC v2 — Root Chain (Layer 1) management
//
// The root chain is a lightweight index table with ONE ROW per stream.
// Each row tracks:
//   - current_head_hash: hash of the most recent record in that stream
//   - last_record_id: UUID of the most recent record
//   - record_count: total number of records in the stream
//
// O(1) head lookups — keyed by stream_type (primary key).
// Updates are fire-and-forget async so they never block the write path.
// ============================================================================

import { computeGenesisHash } from "./hashing.js";
import { STREAM_TYPES } from "./streamRegistry.js";

export function createRootChainService(supabase) {
  /**
   * Get the current head hash for a stream.
   * Returns genesis hash if stream has no records yet.
   */
  async function getStreamHead(streamType) {
    try {
      const { data, error } = await supabase
        .from("xrc_root_chain")
        .select("current_head_hash, last_record_id, record_count")
        .eq("stream_type", streamType)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Stream not yet initialized — return genesis hash
        const genesis = await computeGenesisHash(streamType);
        return { hash: genesis, recordId: null, count: 0, isGenesis: true };
      }

      return {
        hash: data.current_head_hash,
        recordId: data.last_record_id,
        count: data.record_count || 0,
        isGenesis: false,
      };
    } catch (err) {
      // On any error, fall back to genesis hash — write must not block
      console.error("[XRC RootChain] getStreamHead error:", err);
      const genesis = await computeGenesisHash(streamType);
      return { hash: genesis, recordId: null, count: 0, isGenesis: true };
    }
  }

  /**
   * Update the root chain head for a stream.
   * Fire-and-forget — does NOT block the write path.
   * Uses upsert on stream_type (primary key) for idempotency.
   */
  async function updateStreamHead(streamType, newHash, newRecordId) {
    try {
      const now = new Date().toISOString();
      await supabase.from("xrc_root_chain").upsert(
        {
          stream_type: streamType,
          current_head_hash: newHash,
          last_record_id: newRecordId,
          last_updated_at: now,
        },
        { onConflict: "stream_type" },
      );
      // record_count increment handled by DB trigger / RPC
    } catch (err) {
      // Non-fatal — root chain is a convenience index
      console.error("[XRC RootChain] updateStreamHead error:", err);
    }
  }

  /**
   * Get all stream heads — useful for the Oracle explorer.
   */
  async function getAllStreamHeads() {
    try {
      const { data, error } = await supabase
        .from("xrc_root_chain")
        .select("*")
        .order("last_updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[XRC RootChain] getAllStreamHeads error:", err);
      return [];
    }
  }

  /**
   * Get chain statistics for all streams.
   */
  async function getChainStats() {
    try {
      const heads = await getAllStreamHeads();
      const total = heads.reduce((sum, h) => sum + (h.record_count || 0), 0);
      return {
        streams: heads.length,
        totalRecords: total,
        heads,
        lastActivity: heads[0]?.last_updated_at || null,
      };
    } catch (err) {
      return { streams: 0, totalRecords: 0, heads: [], lastActivity: null };
    }
  }

  return { getStreamHead, updateStreamHead, getAllStreamHeads, getChainStats };
}