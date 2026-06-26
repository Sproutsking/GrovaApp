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

/**
 * Compute hash of a record.
 * Excludes 'hash' and 'signature' fields from computation.
 */
export async function computeRecordHash(record) {
  if (!record) throw new Error("Record is required for hash computation");

  // Create copy without hash/signature fields
  const { hash: _, signature: __, ...dataToHash } = record;

  return computeHash({
    record_id: record.record_id,
    stream_type: record.stream_type,
    user_id: record.user_id,
    event_type: record.event_type,
    payload: dataToHash.payload || null,
    previous_hash: record.previous_hash || null,
    created_at: record.created_at,
    version: record.version || 1,
  });
}

/**
 * Verify a record's stored hash matches its computed hash.
 */
export async function verifyRecordHash(record) {
  if (!record) return false;
  if (!record.hash) return false;

  try {
    const computed = await computeRecordHash(record);
    return computed === record.hash;
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
  return record.previous_hash === previousRecord.hash;
}

export default {
  computeHash,
  computeRecordHash,
  verifyRecordHash,
  computeGenesisHash,
  verifyChainContinuity,
};
