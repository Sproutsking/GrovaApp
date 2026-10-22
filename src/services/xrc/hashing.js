// ============================================================================
// services/xrc/hashing.js
// XRC v2 — Cryptographic Hashing (Layer 3.5)
//
// Handles:
//   - computeRecordHash(record): SHA-256 hash of record data
//   - verifyRecordHash(record): verify stored hash matches recomputed hash
//   - computeGenesisHash(streamType): deterministic genesis hash per stream
//
// Uses Web Crypto API (Node.js 15+ and all modern browsers).
// ============================================================================

/**
 * Compute SHA-256 hash of a JSON object.
 * Returns hex string.
 */
export async function computeHash(data) {
  try {
    const encoder = new TextEncoder();
    const jsonStr = JSON.stringify(data);
    const msgBuffer = encoder.encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  } catch (err) {
    console.error("[XRC Hashing] computeHash failed:", err);
    throw new Error(`Failed to compute hash: ${err.message}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

/**
 * Compute the v3 hash from the fields persisted in xrc_records.
 */
export async function computeRecordHash(record) {
  if (!record) throw new Error("Record is required for hash computation");
  const required = ["record_id", "stream_type", "previous_hash", "actor_id", "timestamp", "created_at"];
  const missing = required.filter((key) => record[key] == null);
  if (missing.length || record.version !== 3) {
    throw new Error(`A complete v3 XRC record is required to compute its hash${missing.length ? `; missing ${missing.join(", ")}` : ""}`);
  }

  return computeHash({
    record_id: record.record_id,
    stream_type: record.stream_type,
    previous_hash: record.previous_hash,
    actor_id: record.actor_id,
    payload: canonicalize(record.payload ?? {}),
    timestamp: record.timestamp,
    version: record.version,
    created_at: record.created_at,
  });
}

/**
 * Verify a record's stored hash matches its computed hash.
 */
export async function verifyRecordHash(record) {
  if (!record) return false;
  if (record.version !== 3 || !record.record_hash) return false;

  try {
    const computed = await computeRecordHash(record);
    return computed === record.record_hash;
  } catch (err) {
    console.error("[XRC Hashing] verifyRecordHash failed:", err);
    return false;
  }
}

/**
 * Compute genesis hash for a stream type.
 * Deterministic based on stream type alone.
 */
export async function computeGenesisHash(streamType) {
  if (!streamType) throw new Error("Stream type is required for genesis hash");

  return computeHash({
    event: "genesis",
    stream_type: streamType,
    version: 1,
  });
}

/**
 * Helper to verify chain continuity.
 * Returns true if record.previous_hash is either:
 *   - The genesis hash (if first record)
 *   - Matches the previous record's hash (if chained)
 */
export async function verifyChainContinuity(record, previousRecord) {
  if (!record) return false;
  if (!record.stream_type) return false;

  // If no previous record, must link to genesis
  if (!previousRecord) {
    const genesis = await computeGenesisHash(record.stream_type);
    return record.previous_hash === genesis;
  }

  // Otherwise must link to previous record's hash
  return record.previous_hash === previousRecord.record_hash;
}

export default {
  computeHash,
  computeRecordHash,
  verifyRecordHash,
  computeGenesisHash,
  verifyChainContinuity,
};
