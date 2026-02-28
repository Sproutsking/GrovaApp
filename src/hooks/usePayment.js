// ============================================================================
// src/hooks/usePayment.js — v4 PERFECTION
// ============================================================================
//
//  THE BRAIN of the payment flow. Connects PaywallGate UI to paymentService.
//
//  STATE MACHINE:
//   idle → creating → redirecting → (browser goes to Paystack)
//   idle → creating → verifying → completed
//   idle → creating → verifying → pending_confirmations (Web3 slow)
//   any  → error (user sees ErrBox, can retry)
//
//  KEY DESIGN:
//  - initiatePayment() is the ONLY entry point for all providers
//  - applyCode() handles FREE invite codes (price=0 via edge fn)
//  - reset() returns to idle — allows retry
//  - No state is leaked between payment attempts
//
//  THE 401 ROOT CAUSE (not in this file but for context):
//  The edge function returns 401 because SUPABASE_SERVICE_ROLE_KEY is not
//  set in Supabase Dashboard → Edge Functions → Secrets.
//  paymentService.getAuthHeaders() sends a valid frontend JWT.
//  The edge function calls auth.getUser(token) using the service-role client.
//  If service-role key is missing, that client is misconfigured → every
//  auth.getUser() returns "Invalid JWT" regardless of token validity.
//
//  Fix: Supabase Dashboard → Edge Functions → each fn → Secrets → Add:
//    SUPABASE_URL              = https://<ref>.supabase.co
//    SUPABASE_SERVICE_ROLE_KEY = <from Project Settings → API → service_role>
//    PAYSTACK_SECRET_KEY       = sk_live_... or sk_test_...
//    PAYSTACK_WEBHOOK_SECRET   = <from Paystack Webhooks settings>
//
// ============================================================================

import { useCallback, useReducer } from "react";
import {
  createPaystackTransaction,
  verifyWeb3Payment,
  clearIdempotencyKey,
  applyInviteCode,
} from "../services/auth/paymentService";

// ── State machine ─────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  status:      "idle",        // idle | creating | redirecting | verifying | completed | pending_confirmations | error
  loading:     false,
  error:       null,
  pendingInfo: null,          // { confirmations, required, estimatedWaitSeconds } for Web3
};

function reducer(state, action) {
  switch (action.type) {
    case "START":
      return { ...INITIAL_STATE, status: "creating", loading: true, error: null };
    case "REDIRECTING":
      return { ...state, status: "redirecting", loading: true };
    case "VERIFYING":
      return { ...state, status: "verifying", loading: true };
    case "SUCCESS":
      return { ...INITIAL_STATE, status: "completed" };
    case "PENDING":
      return { ...INITIAL_STATE, status: "pending_confirmations", pendingInfo: action.payload };
    case "ERROR":
      return { ...INITIAL_STATE, status: "error", error: action.payload };
    case "RESET":
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ── usePayment ────────────────────────────────────────────────────────────────
export function usePayment() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── initiatePayment ─────────────────────────────────────────────────────────
  // provider: "paystack" | "web3"
  // All other fields are provider-specific.
  const initiatePayment = useCallback(async ({
    productId,
    provider,
    amountOverrideCents = null,
    // Web3-specific
    chainType     = null,
    chain         = null,
    txHash        = null,
    walletAddress = null,
    // Callbacks
    onSuccess     = null,
  }) => {
    if (!productId) {
      dispatch({ type: "ERROR", payload: "No product selected. Please refresh the page." });
      return;
    }

    dispatch({ type: "START" });

    try {
      if (provider === "paystack") {
        // ── Paystack ──────────────────────────────────────────────────────────
        dispatch({ type: "REDIRECTING" });

        const { authorization_url, reference, already_completed } =
          await createPaystackTransaction({
            productId,
            callbackUrl:         window.location.origin + window.location.pathname,
            amountOverrideCents,
          });

        if (already_completed) {
          dispatch({ type: "SUCCESS" });
          return;
        }

        if (!authorization_url) {
          throw new Error("Payment provider did not return a checkout URL. Please try again.");
        }

        // Redirect to Paystack checkout
        window.location.href = authorization_url;
        // Don't dispatch anything — browser is navigating away

      } else if (provider === "web3") {
        // ── Web3 ──────────────────────────────────────────────────────────────
        if (!chainType || !chain || !txHash || !walletAddress) {
          throw new Error("All Web3 fields are required.");
        }

        dispatch({ type: "VERIFYING" });

        const result = await verifyWeb3Payment({
          productId,
          chainType,
          chain,
          txHash,
          walletAddress,
          amountOverrideCents,
        });

        if (result?.status === "pending_confirmations") {
          dispatch({
            type: "PENDING",
            payload: {
              confirmations:        result.confirmations        ?? 0,
              required:             result.required             ?? 12,
              estimatedWaitSeconds: result.estimatedWaitSeconds ?? 60,
            },
          });
          return;
        }

        dispatch({ type: "SUCCESS" });
        clearIdempotencyKey(productId);

        if (typeof onSuccess === "function") {
          try { await onSuccess(result); }
          catch (e) { console.warn("[usePayment] onSuccess threw (non-fatal):", e?.message); }
        }

      } else {
        throw new Error(`Unknown payment provider: ${provider}`);
      }

    } catch (err) {
      const msg = err?.message ?? "An unexpected error occurred. Please try again.";
      console.error("[usePayment] Payment error:", msg);
      dispatch({ type: "ERROR", payload: msg });
    }
  }, []);

  // ── applyCode ───────────────────────────────────────────────────────────────
  // For FREE invite codes only (price=0). Paid codes go through initiatePayment.
  const applyCode = useCallback(async ({ code, userId, products, onSuccess }) => {
    return applyInviteCode({ code, userId, products, onSuccess });
  }, []);

  // ── reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    initiatePayment,
    applyCode,
    reset,
  };
}