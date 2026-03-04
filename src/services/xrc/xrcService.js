// ============================================================================
// services/xrc/xrcService.js
// XRC v2 — Core Service (Chain of Chains)
//
// This is the primary integration point for the entire XRC system.
//
// USAGE:
//   import { createXRCService } from './services/xrc'
//   const xrc = createXRCService(supabase)
//
//   // Wrap any existing service call:
//   const post = await xrc.xrcWrapper("XCRC", { event: "post_created", ... }, userId, () =>
//     supabase.from("posts").insert(data).single()
//   )
//
// SAFETY CONTRACTS:
//   ✓ Never breaks existing service return values
//   ✓ Never blocks writes (XRC failure = log + continue)
//   ✓ Never forces verification during write
//   ✓ Never modifies existing database tables
//   ✓ Dev-mode aware — silent in development, active in production
//   ✓ Returns original callback result unchanged
// ============================================================================

import { computeRecordHash, computeGenesisHash } from "./hashing.js";
import { createRootChainService } from "./rootChainService.js";
import { createVerificationService } from "./verificationService.js";
import {
  shouldRecord,
  logSkip,
  logWrite,
  getEnvironment,
} from "./xrcGuard.js";
import {
  STREAM_TYPES,
  STREAM_REGISTRY,
  validateXWRCPayload,
} from "./streamRegistry.js";

// Polyfill for environments without crypto.randomUUID
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createXRCService(supabase) {
  const rootChain = createRootChainService(supabase);
  const verification = createVerificationService(supabase);

  // ──────────────────────────────────────────────────────────────────────────
  // CORE WRITE PATH
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Write a record to a stream chain.
   *
   * @param {string} streamType - One of STREAM_TYPES
   * @param {object} payload    - Event data (must include `event` key)
   * @param {string} actorId    - UUID of the user performing the action
   * @returns {Promise<{success, recordId, hash, skipped}>}
   */
  async function writeRecord(streamType, payload, actorId) {
    // ── Guard: dev-mode skip ─────────────────────────────────────────────
    if (!shouldRecord(actorId)) {
      logSkip(streamType, payload?.event, "dev mode or invalid actor");
      return { success: false, skipped: true, reason: "dev-mode" };
    }

    // ── Guard: XWRC special validation ──────────────────────────────────
    if (streamType === STREAM_TYPES.XWRC) {
      const xwrcCheck = validateXWRCPayload(payload);
      if (!xwrcCheck.valid) {
        console.warn("[XRC] XWRC payload validation failed:", xwrcCheck.error);
        return { success: false, skipped: true, reason: xwrcCheck.error };
      }
    }

    try {
      const timestampMs = Date.now();
      const recordId = generateUUID();

      // ── Get current stream head (O(1) lookup) ──────────────────────────
      const head = await rootChain.getStreamHead(streamType);
      const previousHash = head.hash;

      // ── Compute this record's hash ─────────────────────────────────────
      const recordHash = await computeRecordHash({
        previousHash,
        payload,
        timestampMs,
        actorId,
      });

      // ── Insert record ──────────────────────────────────────────────────
      const { error: insertError } = await supabase
        .from("xrc_records")
        .insert({
          record_id: recordId,
          stream_type: streamType,
          previous_hash: previousHash,
          record_hash: recordHash,
          actor_id: actorId,
          payload,
          timestamp: timestampMs,
          version: 2,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // ── Fire-and-forget root chain update ──────────────────────────────
      rootChain.updateStreamHead(streamType, recordHash, recordId).catch((e) =>
        console.error("[XRC] Root chain update error:", e),
      );

      logWrite(streamType, payload?.event, recordId);

      return { success: true, recordId, hash: recordHash, skipped: false };
    } catch (err) {
      console.error("[XRC] writeRecord error:", err);
      return { success: false, error: err.message, skipped: false };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // WRAPPER — PRIMARY INTEGRATION PATTERN
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Wrap any existing database operation with XRC recording.
   *
   * The callback ALWAYS executes — XRC failure never blocks the original op.
   * Return value of callback is passed through unchanged.
   *
   * @param {string}   streamType  - One of STREAM_TYPES
   * @param {object}   payload     - XRC event payload
   * @param {string}   actorId     - User UUID
   * @param {Function} dbCallback  - Async function returning the original result
   * @returns {Promise<*>} The exact return value of dbCallback
   */
  async function xrcWrapper(streamType, payload, actorId, dbCallback) {
    // XRC write is fire-and-forget — never awaited before callback
    if (shouldRecord(actorId)) {
      writeRecord(streamType, payload, actorId).catch((e) =>
        console.error("[XRC] Background write error:", e),
      );
    } else {
      logSkip(streamType, payload?.event, "dev mode");
    }

    // Always execute original operation and return its result
    return dbCallback();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VERIFICATION API (passthrough)
  // ──────────────────────────────────────────────────────────────────────────

  async function verifyRecord(recordId) {
    return verification.verifyRecord(recordId);
  }

  async function validateChain(streamType, limit) {
    return verification.validateChain(streamType, limit);
  }

  async function traceHistory(recordId, maxDepth) {
    return verification.traceHistory(recordId, maxDepth);
  }

  async function searchRecords(params) {
    return verification.searchRecords(params);
  }

  async function getActorHistory(actorId, limit) {
    return verification.getActorHistory(actorId, limit);
  }

  async function getRecentActivity(limit) {
    return verification.getRecentActivity(limit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROOT CHAIN API (passthrough)
  // ──────────────────────────────────────────────────────────────────────────

  async function getStreamHead(streamType) {
    return rootChain.getStreamHead(streamType);
  }

  async function getAllStreamHeads() {
    return rootChain.getAllStreamHeads();
  }

  async function getChainStats() {
    return rootChain.getChainStats();
  }

  return {
    // Write
    writeRecord,
    xrcWrapper,

    // Verification
    verifyRecord,
    validateChain,
    traceHistory,
    searchRecords,
    getActorHistory,
    getRecentActivity,

    // Root Chain
    getStreamHead,
    getAllStreamHeads,
    getChainStats,

    // Constants
    STREAM_TYPES,
    STREAM_REGISTRY,

    // Meta
    getEnvironment,
  };
}

// ── Convenience: pre-built event payloads for common actions ─────────────────

export const XRC_EVENTS = {
  // XCRC — Content
  postCreated: (postId, userId, preview) => ({
    event: "post_created",
    content_type: "post",
    content_id: postId,
    user_id: userId,
    preview: (preview || "").slice(0, 100),
  }),
  postDeleted: (postId, userId) => ({
    event: "post_deleted",
    content_type: "post",
    content_id: postId,
    user_id: userId,
  }),
  reelCreated: (reelId, userId) => ({
    event: "reel_created",
    content_type: "reel",
    content_id: reelId,
    user_id: userId,
  }),
  storyCreated: (storyId, userId, title) => ({
    event: "story_created",
    content_type: "story",
    content_id: storyId,
    user_id: userId,
    title,
  }),

  // XERC — Engagement
  postLiked: (postId, userId) => ({
    event: "post_liked",
    content_type: "post",
    content_id: postId,
    user_id: userId,
  }),
  postUnliked: (postId, userId) => ({
    event: "post_unliked",
    content_type: "post",
    content_id: postId,
    user_id: userId,
  }),
  commentAdded: (contentId, contentType, userId, commentId) => ({
    event: "comment_added",
    content_type: contentType,
    content_id: contentId,
    comment_id: commentId,
    user_id: userId,
  }),
  shared: (contentId, contentType, userId) => ({
    event: "content_shared",
    content_type: contentType,
    content_id: contentId,
    user_id: userId,
  }),

  // XTRC — Transactions
  tokenTransfer: (fromUserId, toUserId, amount, currency, txId) => ({
    event: "token_transfer",
    from_user_id: fromUserId,
    to_user_id: toUserId,
    amount_tokens: amount,
    currency,
    transaction_id: txId,
  }),

  // XWRC — Wallet state transitions
  walletDeposit: (userId, balanceBefore, balanceAfter, delta, currency) => ({
    event: "wallet_deposit",
    user_id: userId,
    token_balance_before: balanceBefore,
    token_balance_after: balanceAfter,
    token_delta: delta,
    currency,
  }),
  walletWithdrawal: (userId, balanceBefore, balanceAfter, delta) => ({
    event: "wallet_withdrawal",
    user_id: userId,
    token_balance_before: balanceBefore,
    token_balance_after: balanceAfter,
    token_delta: delta,
  }),

  // XARC — Account
  accountCreated: (userId, username) => ({
    event: "account_created",
    user_id: userId,
    username,
  }),
  profileUpdated: (userId, fields) => ({
    event: "profile_updated",
    user_id: userId,
    updated_fields: fields,
  }),

  // XPRC — Permissions
  roleAssigned: (userId, role, grantedBy) => ({
    event: "role_assigned",
    user_id: userId,
    role,
    granted_by: grantedBy,
  }),
};