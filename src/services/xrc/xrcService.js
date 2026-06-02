// ============================================================================
// services/xrc/xrcService.js
// XRC v2 — Core Service (Chain of Chains) — PERFECT EDITION
//
// USAGE:
//   import { createXRCService } from './services/xrc'
//   const xrc = createXRCService(supabase)
//
//   // Wrap any existing service call:
//   const post = await xrc.xrcWrapper("XCRC", { event: "post_created", post_id: postId, ... }, userId, () =>
//     supabase.from("posts").insert(data).single()
//   )
//
//   // Oracle search — handles any input:
//   const result = await xrc.smartSearch("https://xeevia.com/post/abc-123")
//   const result = await xrc.smartSearch("abc-123-def-456")  // UUID
//   const result = await xrc.smartSearch("post_created")     // event type
//   const result = await xrc.smartSearch("wallet_deposit")   // event type
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
import { shouldRecord, logSkip, logWrite, getEnvironment } from "./xrcGuard.js";
import {
  STREAM_TYPES,
  STREAM_REGISTRY,
  validateXWRCPayload,
} from "./streamRegistry.js";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const STRICT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Extract UUID from any string (URL, plain ID, mixed text)
function extractUUID(raw) {
  const m = raw.match(UUID_RE);
  return m ? m[0] : null;
}

// Detect what kind of content a URL/string is about
function detectContentType(raw) {
  if (/\/post\//i.test(raw) || /[?&]post_?id=/i.test(raw)) return "post";
  if (/\/reel\//i.test(raw) || /[?&]reel_?id=/i.test(raw)) return "reel";
  if (/\/story\//i.test(raw) || /[?&]story_?id=/i.test(raw)) return "story";
  if (/\/transaction\//i.test(raw) || /[?&]tx_?id=/i.test(raw))
    return "transaction";
  if (
    /\/user\//i.test(raw) ||
    /\/profile\//i.test(raw) ||
    /[?&]user_?id=/i.test(raw)
  )
    return "user";
  if (/\/wallet\//i.test(raw)) return "wallet";
  return null;
}

export function createXRCService(supabase) {
  const rootChain = createRootChainService(supabase);
  const verification = createVerificationService(supabase);

  // ──────────────────────────────────────────────────────────────────────────
  // CORE WRITE PATH
  // ──────────────────────────────────────────────────────────────────────────
  async function writeRecord(streamType, payload, actorId) {
    if (!shouldRecord(actorId)) {
      logSkip(streamType, payload?.event, "dev mode or invalid actor");
      return { success: false, skipped: true, reason: "dev-mode" };
    }

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
      const head = await rootChain.getStreamHead(streamType);
      const previousHash = head.hash;
      const recordHash = await computeRecordHash({
        previousHash,
        payload,
        timestampMs,
        actorId,
      });

      const { error: insertError } = await supabase.from("xrc_records").insert({
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

      rootChain
        .updateStreamHead(streamType, recordHash, recordId)
        .catch((e) => console.error("[XRC] Root chain update error:", e));

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
  async function xrcWrapper(streamType, payload, actorId, dbCallback) {
    if (shouldRecord(actorId)) {
      writeRecord(streamType, payload, actorId).catch((e) =>
        console.error("[XRC] Background write error:", e),
      );
    } else {
      logSkip(streamType, payload?.event, "dev mode");
    }
    return dbCallback();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SMART SEARCH — Oracle's primary entry point
  //
  // Accepts literally anything:
  //   • Full URL:         https://xeevia.com/post/abc-123-def  → content timeline
  //   • UUID:             abc-123-def-456                       → tries all strategies
  //   • Event type:       post_created, token_transfer, etc     → recent events of type
  //   • Actor search:     (UUID that resolves to actor_id)      → actor history
  //   • Hash:             (64-char hex)                         → record by hash
  //   • Keywords:         "wallet deposit", "story"             → payload text search
  //
  // Returns: { records, total, strategy, contentType, isTimeline }
  // ──────────────────────────────────────────────────────────────────────────
  async function smartSearch(rawInput, options = {}) {
    if (!rawInput?.trim()) return { records: [], total: 0, strategy: "empty" };

    const raw = rawInput.trim();
    const { limit = 100 } = options;

    // ── Detect UUID in input (handles full URLs too) ───────────────────
    const extractedUUID = extractUUID(raw);
    const contentType = detectContentType(raw);
    const isExactUUID = STRICT_UUID_RE.test(raw);

    // ── Strategy A: UUID detected ─────────────────────────────────────
    if (extractedUUID) {
      // Run all UUID strategies in parallel
      const [byRecordId, byHash, byContentId, byActorId] = await Promise.all([
        // 1. Exact record ID
        supabase
          .from("xrc_records")
          .select("*")
          .eq("record_id", extractedUUID)
          .limit(1)
          .then((r) => r.data || [])
          .catch(() => []),

        // 2. Record hash (64 hex chars) — only if input looks like a hash
        raw.length === 64 && /^[0-9a-f]+$/i.test(raw)
          ? supabase
              .from("xrc_records")
              .select("*")
              .eq("record_hash", raw)
              .limit(1)
              .then((r) => r.data || [])
              .catch(() => [])
          : Promise.resolve([]),

        // 3. Content ID — searches all payload fields (GIN-indexed)
        verification
          .searchByContentId(extractedUUID, { limit })
          .then((r) => r.records)
          .catch(() => []),

        // 4. Actor ID — all records for this user
        supabase
          .from("xrc_records")
          .select("*")
          .eq("actor_id", extractedUUID)
          .order("timestamp", { ascending: false })
          .limit(limit)
          .then((r) => r.data || [])
          .catch(() => []),
      ]);

      // Determine primary result type and best strategy label
      let strategy = "uuid_search";
      let isTimeline = false;
      let primaryRecords = [];

      if (byRecordId.length > 0) {
        // Exact record found — use network view
        strategy = "record_id";
        primaryRecords = byRecordId;
      } else if (byHash.length > 0) {
        strategy = "record_hash";
        primaryRecords = byHash;
      } else if (byContentId.length > 0) {
        // It's a content ID — show full timeline
        strategy = "content_timeline";
        isTimeline = true;
        primaryRecords = byContentId; // already sorted oldest→newest
      } else if (byActorId.length > 0) {
        strategy = "actor_history";
        primaryRecords = byActorId;
      }

      // Merge everything for the "also related" sidebar
      const seen = new Set(primaryRecords.map((r) => r.record_id));
      const allRelated = [];
      for (const batch of [byActorId, byContentId]) {
        for (const rec of batch) {
          if (!seen.has(rec.record_id)) {
            seen.add(rec.record_id);
            allRelated.push(rec);
          }
        }
      }

      return {
        records: primaryRecords,
        allRelated,
        total: primaryRecords.length,
        strategy,
        contentType,
        isTimeline,
        extractedUUID,
      };
    }

    // ── Strategy B: 64-char hex hash ─────────────────────────────────
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      const result = await verification.searchByHash(raw);
      if (result.record) {
        return { records: [result.record], total: 1, strategy: "hash" };
      }
    }

    // ── Strategy C: Event type keyword (most common non-UUID search) ──
    const evResult = await supabase
      .from("xrc_records")
      .select("*")
      .contains("payload", { event: raw })
      .order("timestamp", { ascending: false })
      .limit(limit)
      .then((r) => ({ data: r.data || [], error: r.error }))
      .catch(() => ({ data: [], error: null }));

    if (evResult.data.length > 0) {
      return {
        records: evResult.data,
        total: evResult.data.length,
        strategy: "event_type",
        contentType: null,
        isTimeline: false,
      };
    }

    // ── Strategy D: Generic text search in payload ────────────────────
    const { data: recentRecs } = await supabase
      .from("xrc_records")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200)
      .catch(() => ({ data: [] }));

    const lower = raw.toLowerCase();
    const textMatches = (recentRecs || [])
      .filter(
        (r) =>
          JSON.stringify(r.payload).toLowerCase().includes(lower) ||
          r.actor_id?.toLowerCase().includes(lower),
      )
      .slice(0, limit);

    return {
      records: textMatches,
      total: textMatches.length,
      strategy: textMatches.length > 0 ? "text_search" : "no_results",
      contentType: null,
      isTimeline: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VERIFICATION API (passthroughs)
  // ──────────────────────────────────────────────────────────────────────────
  const verifyRecord = (id) => verification.verifyRecord(id);
  const validateChain = (st, limit) => verification.validateChain(st, limit);
  const traceHistory = (id, depth) => verification.traceHistory(id, depth);
  const searchRecords = (params) => verification.searchRecords(params);
  const searchByContentId = (id, opts) =>
    verification.searchByContentId(id, opts);
  const searchByActor = (id, opts) => verification.searchByActor(id, opts);
  const searchByHash = (hash) => verification.searchByHash(hash);
  const getActorHistory = (id, limit) =>
    verification.getActorHistory(id, limit);
  const getRecentActivity = (limit) => verification.getRecentActivity(limit);

  // ──────────────────────────────────────────────────────────────────────────
  // ROOT CHAIN API (passthroughs)
  // ──────────────────────────────────────────────────────────────────────────
  const getStreamHead = (st) => rootChain.getStreamHead(st);
  const getAllStreamHeads = () => rootChain.getAllStreamHeads();
  const getChainStats = () => rootChain.getChainStats();

  return {
    // Write
    writeRecord,
    xrcWrapper,

    // Smart search (Oracle primary)
    smartSearch,

    // Verification
    verifyRecord,
    validateChain,
    traceHistory,
    searchRecords,
    searchByContentId,
    searchByActor,
    searchByHash,
    getActorHistory,
    getRecentActivity,

    // Root Chain
    getStreamHead,
    getAllStreamHeads,
    getChainStats,

    // Constants
    STREAM_TYPES,
    STREAM_REGISTRY,
    getEnvironment,
  };
}

// ── Pre-built event payloads ──────────────────────────────────────────────
export const XRC_EVENTS = {
  // XCRC — Content
  postCreated: (postId, userId, preview) => ({
    event: "post_created",
    content_type: "post",
    content_id: postId,
    post_id: postId,
    user_id: userId,
    preview: (preview || "").slice(0, 100),
  }),
  postEdited: (postId, userId, fields) => ({
    event: "post_edited",
    content_type: "post",
    content_id: postId,
    post_id: postId,
    user_id: userId,
    edited_fields: fields,
  }),
  postDeleted: (postId, userId) => ({
    event: "post_deleted",
    content_type: "post",
    content_id: postId,
    post_id: postId,
    user_id: userId,
  }),
  reelCreated: (reelId, userId) => ({
    event: "reel_created",
    content_type: "reel",
    content_id: reelId,
    reel_id: reelId,
    user_id: userId,
  }),
  reelDeleted: (reelId, userId) => ({
    event: "reel_deleted",
    content_type: "reel",
    content_id: reelId,
    reel_id: reelId,
    user_id: userId,
  }),
  storyCreated: (storyId, userId, title) => ({
    event: "story_created",
    content_type: "story",
    content_id: storyId,
    story_id: storyId,
    user_id: userId,
    title,
  }),
  storyDeleted: (storyId, userId) => ({
    event: "story_deleted",
    content_type: "story",
    content_id: storyId,
    story_id: storyId,
    user_id: userId,
  }),

  // XERC — Engagement
  postLiked: (postId, userId) => ({
    event: "post_liked",
    content_type: "post",
    content_id: postId,
    post_id: postId,
    user_id: userId,
  }),
  postUnliked: (postId, userId) => ({
    event: "post_unliked",
    content_type: "post",
    content_id: postId,
    post_id: postId,
    user_id: userId,
  }),
  commentAdded: (contentId, type, userId, commentId) => ({
    event: "comment_added",
    content_type: type,
    content_id: contentId,
    comment_id: commentId,
    user_id: userId,
  }),
  storyUnlocked: (storyId, userId) => ({
    event: "story_unlocked",
    content_type: "story",
    content_id: storyId,
    story_id: storyId,
    user_id: userId,
  }),
  shared: (contentId, type, userId) => ({
    event: "content_shared",
    content_type: type,
    content_id: contentId,
    user_id: userId,
  }),
  followAdded: (followerId, followingId) => ({
    event: "follow_added",
    follower_id: followerId,
    following_id: followingId,
  }),
  followRemoved: (followerId, followingId) => ({
    event: "follow_removed",
    follower_id: followerId,
    following_id: followingId,
  }),

  // XTRC — Transactions
  tokenTransfer: (fromId, toId, amount, currency, txId) => ({
    event: "token_transfer",
    from_user_id: fromId,
    to_user_id: toId,
    amount_tokens: amount,
    currency,
    transaction_id: txId,
  }),

  // XWRC — Wallet
  walletDeposit: (userId, before, after, delta, currency) => ({
    event: "wallet_deposit",
    user_id: userId,
    token_balance_before: before,
    token_balance_after: after,
    token_delta: delta,
    currency,
  }),
  walletWithdrawal: (userId, before, after, delta) => ({
    event: "wallet_withdrawal",
    user_id: userId,
    token_balance_before: before,
    token_balance_after: after,
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

  // XSRC — System
  platformAction: (action, adminId, details) => ({
    event: action,
    admin_id: adminId,
    ...details,
  }),
};
