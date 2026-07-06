// ============================================================================
// services/xrc/verificationService.js
// XRC v2 — Chain Verification Engine (Layer 4)
//
// Verification is NEVER called during writes.
// It runs ON-DEMAND only — for audits, explorer queries, admin panels.
//
// Verification modes:
//   verifyRecord(recordId)     → single record hash check
//   validateChain(streamType)  → full chain traversal
//   traceHistory(recordId)     → walk backwards to genesis
//   compareRecords(id1, id2)   → show diff between two records
// ============================================================================

import { verifyRecordHash } from "./hashing.js";

export const VERIFICATION_STATUS = {
  VALID: "valid",
  MODIFIED: "modified",     // hash doesn't match — data was tampered
  BROKEN_CHAIN: "broken_chain", // previous_hash doesn't link correctly
  MISSING: "missing",       // record not found
  GENESIS: "genesis",       // this is the genesis record
};

export function createVerificationService(supabase) {
  /**
   * Verify a single record's hash integrity.
   */
  async function verifyRecord(recordId) {
    try {
      const { data: record, error } = await supabase
        .from("xrc_records")
        .select("*")
        .eq("record_id", recordId)
        .maybeSingle();

      if (error) throw error;
      if (!record) return { status: VERIFICATION_STATUS.MISSING, record: null };

      const hashOk = await verifyRecordHash(record);

      if (!hashOk) {
        return {
          status: VERIFICATION_STATUS.MODIFIED,
          record,
          message: "Record hash does not match its data — tampering detected",
        };
      }

      return { status: VERIFICATION_STATUS.VALID, record };
    } catch (err) {
      console.error("[XRC Verify] verifyRecord error:", err);
      return { status: VERIFICATION_STATUS.MISSING, record: null, error: err.message };
    }
  }

  /**
   * Validate entire chain for a stream — traverses all records in order.
   * Returns summary with per-record results for any invalid records.
   */
  async function validateChain(streamType, limit = 500) {
    try {
      const { data: records, error } = await supabase
        .from("xrc_records")
        .select("*")
        .eq("stream_type", streamType)
        .order("timestamp", { ascending: true })
        .limit(limit);

      if (error) throw error;
      if (!records || records.length === 0) {
        return {
          streamType,
          valid: true,
          recordCount: 0,
          invalidRecords: [],
          message: "Stream is empty",
        };
      }

      const invalidRecords = [];
      let previousHash = records[0].previous_hash; // genesis hash for first record

      for (const record of records) {
        // Check hash integrity
        const hashOk = await verifyRecordHash(record);
        if (!hashOk) {
          invalidRecords.push({
            recordId: record.record_id,
            status: VERIFICATION_STATUS.MODIFIED,
            timestamp: record.timestamp,
            event: record.payload?.event,
          });
          continue;
        }

        // Check chain linkage
        if (record.previous_hash !== previousHash) {
          invalidRecords.push({
            recordId: record.record_id,
            status: VERIFICATION_STATUS.BROKEN_CHAIN,
            timestamp: record.timestamp,
            expected: previousHash,
            got: record.previous_hash,
          });
        }

        previousHash = record.record_hash;
      }

      return {
        streamType,
        valid: invalidRecords.length === 0,
        recordCount: records.length,
        invalidRecords,
        checkedUpTo: records[records.length - 1]?.record_id,
        message:
          invalidRecords.length === 0
            ? `Chain is intact — ${records.length} records verified`
            : `${invalidRecords.length} integrity violations found`,
      };
    } catch (err) {
      console.error("[XRC Verify] validateChain error:", err);
      return { streamType, valid: false, error: err.message };
    }
  }

  /**
   * Walk backwards through chain links to genesis.
   * Returns the record and its ancestors up to maxDepth.
   */
  async function traceHistory(recordId, maxDepth = 20) {
    const chain = [];

    try {
      let currentId = recordId;

      for (let i = 0; i < maxDepth; i++) {
        const { data: record, error } = await supabase
          .from("xrc_records")
          .select("*")
          .eq("record_id", currentId)
          .maybeSingle();

        if (error || !record) break;

        const hashOk = await verifyRecordHash(record);
        chain.push({ ...record, _hashValid: hashOk, _depth: i });

        // Find parent record by its hash
        const { data: parent } = await supabase
          .from("xrc_records")
          .select("record_id")
          .eq("record_hash", record.previous_hash)
          .maybeSingle();

        if (!parent) break; // reached genesis or broken link
        currentId = parent.record_id;
      }

      return {
        chain,
        depth: chain.length,
        reachedGenesis: chain.length < maxDepth,
      };
    } catch (err) {
      console.error("[XRC Verify] traceHistory error:", err);
      return { chain, depth: chain.length, error: err.message };
    }
  }

  /**
   * Search XRC records by various criteria — for the Oracle explorer.
   */
  async function searchRecords({
    streamType,
    actorId,
    eventType,
    fromTimestamp,
    toTimestamp,
    limit = 50,
    offset = 0,
    searchTerm,
  }) {
    try {
      let query = supabase
        .from("xrc_records")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (streamType) query = query.eq("stream_type", streamType);
      if (actorId) query = query.eq("actor_id", actorId);
      if (fromTimestamp) query = query.gte("timestamp", fromTimestamp);
      if (toTimestamp) query = query.lte("timestamp", toTimestamp);
      if (eventType) query = query.contains("payload", { event: eventType });

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];

      // Client-side text search in payload if term provided
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        results = results.filter((r) =>
          JSON.stringify(r.payload).toLowerCase().includes(lower),
        );
      }

      return { records: results, total: results.length };
    } catch (err) {
      console.error("[XRC Verify] searchRecords error:", err);
      return { records: [], total: 0, error: err.message };
    }
  }

  /**
   * Get records for a specific actor (user).
   */
  async function getActorHistory(actorId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from("xrc_records")
        .select("*")
        .eq("actor_id", actorId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Get the most recent records across all streams — for live feed.
   */
  async function getRecentActivity(limit = 20) {
    try {
      const { data, error } = await supabase
        .from("xrc_records")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  }

  return {
    verifyRecord,
    validateChain,
    traceHistory,
    searchRecords,
    getActorHistory,
    getRecentActivity,
    VERIFICATION_STATUS,
  };
}