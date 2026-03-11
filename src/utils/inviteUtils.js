// =============================================================================
// src/utils/inviteUtils.js
// =============================================================================
//
// SINGLE SOURCE OF TRUTH for evaluating invite codes on the client side.
//
// WHY THIS EXISTS
//   invite_codes has two price fields: entry_price (default 1.00) and
//   price_override (nullable). Before this file, each component had its own
//   inline logic to decide if an invite was "free", leading to inconsistencies
//   that caused the PaywallGate to show a payment modal for free-invite users,
//   or vice-versa.
//
// RULES
//   effectivePrice = price_override ?? entry_price
//   A free invite is one where effectivePrice === 0
//   An invalid invite is one that is expired, inactive, or at max uses
// =============================================================================

// ---------------------------------------------------------------------------
// isFreeInvite(invite)
//   Returns true if the invite code grants free entry.
//
//   @param {object} invite  — row from invite_codes table
//   @returns {boolean}
// ---------------------------------------------------------------------------
export function isFreeInvite(invite) {
  if (!invite) return false;
  const effective = getEffectivePrice(invite);
  return effective === 0;
}

// ---------------------------------------------------------------------------
// getEffectivePrice(invite)
//   Returns the actual price a user pays for this invite, as a number.
//   price_override takes precedence over entry_price when it is not null.
//
//   @param {object} invite  — row from invite_codes table
//   @returns {number}
// ---------------------------------------------------------------------------
export function getEffectivePrice(invite) {
  if (!invite) return 0;
  const raw =
    invite.price_override !== null && invite.price_override !== undefined
      ? invite.price_override
      : invite.entry_price;
  return Number(raw ?? 0);
}

// ---------------------------------------------------------------------------
// isInviteValid(invite)
//   Returns { valid: boolean, reason: string|null }
//   Checks: status, expiry, usage cap.
//
//   @param {object} invite  — row from invite_codes table
//   @returns {{ valid: boolean, reason: string|null }}
// ---------------------------------------------------------------------------
export function isInviteValid(invite) {
  if (!invite) return { valid: false, reason: "INVALID_CODE" };

  if (invite.status !== "active") {
    return { valid: false, reason: "CODE_INACTIVE" };
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { valid: false, reason: "CODE_EXPIRED" };
  }

  if (
    invite.max_uses !== null &&
    invite.max_uses !== undefined &&
    invite.uses_count >= invite.max_uses
  ) {
    return { valid: false, reason: "CODE_MAX_USES" };
  }

  return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// getInviteTier(invite)
//   Returns the subscription tier this invite grants.
//   Defaults to 'standard' for unknown types.
//
//   @param {object} invite  — row from invite_codes table
//   @returns {'whitelist'|'standard'|'vip'|'admin'|'free'}
// ---------------------------------------------------------------------------
export function getInviteTier(invite) {
  if (!invite) return "standard";
  if (invite.type === "vip") return "vip";
  if (invite.type === "admin") return "standard"; // admin invite doesn't set tier
  if (invite.type === "whitelist") return "whitelist";
  // standard type: effective price 0 → free tier in DB
  if (isFreeInvite(invite)) return "free";
  return "standard";
}

// ---------------------------------------------------------------------------
// getInviteErrorMessage(reason)
//   Returns a user-friendly message for an invalid invite reason code.
//
//   @param {string} reason
//   @returns {string}
// ---------------------------------------------------------------------------
export function getInviteErrorMessage(reason) {
  const messages = {
    INVALID_CODE: "This invite code is not recognised.",
    CODE_INACTIVE: "This invite code is no longer active.",
    CODE_EXPIRED: "This invite link has expired.",
    CODE_MAX_USES: "This invite link has reached its maximum number of uses.",
  };
  return messages[reason] ?? "This invite code cannot be used.";
}

// ---------------------------------------------------------------------------
// getPendingInviteCode()
//   Reads the code stored by the invite landing page from sessionStorage.
//   Returns null if not present.
//
//   @returns {string|null}
// ---------------------------------------------------------------------------
export function getPendingInviteCode() {
  try {
    return sessionStorage.getItem("pendingInviteCode") ?? null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// clearPendingInviteCode()
//   Clears the stored invite code after it has been used.
// ---------------------------------------------------------------------------
export function clearPendingInviteCode() {
  try {
    sessionStorage.removeItem("pendingInviteCode");
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// storePendingInviteCode(code)
//   Stores an invite code for use after registration / login.
//
//   @param {string} code
// ---------------------------------------------------------------------------
export function storePendingInviteCode(code) {
  try {
    sessionStorage.setItem("pendingInviteCode", code);
  } catch (_) {}
}
