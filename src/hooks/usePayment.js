// src/hooks/usePayment.js
// ============================================================================
// usePayment — Full lifecycle hook for Paystack + Web3 payments.
//
// PAYWALL NEVER-AGAIN GUARANTEE:
//   Payment sets profile.account_activated = true via Edge Function.
//   AuthContext reads this field from the DB on every auth state change.
//   PaywallGate checks profile.account_activated before rendering.
//   Once true — paywall is gone permanently until subscription lapses.
// ============================================================================

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getOrCreateIdempotencyKey,
  clearIdempotencyKey,
  createPaystackTransaction,
  verifyWeb3Payment,
  applyInviteCode,
} from "../services/auth/paymentService";
import { supabase } from "../services/config/supabase";

export function usePayment() {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [status,      setStatus]      = useState("idle");
  const [pendingInfo, setPendingInfo] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safe = useCallback((fn) => {
    if (mountedRef.current) fn();
  }, []);

  const reset = useCallback(() => {
    safe(() => {
      setLoading(false);
      setError(null);
      setStatus("idle");
      setPendingInfo(null);
    });
  }, [safe]);

  const initiatePayment = useCallback(async ({
    productId,
    provider,
    chainType,
    chain,
    txHash,
    walletAddress,
    tokenAddress = null,
    onSuccess,
  }) => {
    safe(() => {
      setLoading(true);
      setError(null);
      setStatus("creating");
      setPendingInfo(null);
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Not authenticated. Please sign in.");

      const idempotencyKey = getOrCreateIdempotencyKey(productId);

      // ── Paystack ──────────────────────────────────────────────────────────
      if (provider === "paystack") {
        const result = await createPaystackTransaction({ productId, idempotencyKey });

        if (result.already_completed) {
          clearIdempotencyKey(productId);
          safe(() => { setLoading(false); setStatus("completed"); });
          onSuccess?.();
          return;
        }

        await supabase.from("payment_intents")
          .update({ status: "redirected" })
          .eq("idempotency_key", idempotencyKey);

        safe(() => setStatus("redirecting"));

        sessionStorage.setItem("xv_pending_product", productId);
        sessionStorage.setItem("xv_pending_ref",     result.reference ?? "");

        window.location.href = result.authorization_url;
        return;
      }

      // ── Web3 ──────────────────────────────────────────────────────────────
      if (provider === "web3") {
        if (!chainType || !chain || !txHash || !walletAddress) {
          throw new Error("Web3 requires: chainType, chain, txHash, walletAddress");
        }
        if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          throw new Error("Invalid transaction hash. Must be 0x followed by 64 hex characters.");
        }
        if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
          throw new Error("Invalid wallet address. Must be 0x followed by 40 hex characters.");
        }

        safe(() => setStatus("verifying"));

        const result = await verifyWeb3Payment({
          chainType,
          chain,
          txHash,
          productId,
          idempotencyKey,
          claimedSenderWallet:  walletAddress,
          expectedTokenAddress: tokenAddress,
        });

        if (result.already_verified || result.status === "confirmed") {
          clearIdempotencyKey(productId);
          safe(() => { setLoading(false); setStatus("completed"); });
          onSuccess?.();
          return;
        }

        if (result.status === "pending_confirmations") {
          safe(() => {
            setLoading(false);
            setStatus("pending_confirmations");
            setPendingInfo({
              confirmations:        result.confirmations,
              required:             result.required,
              estimatedWaitSeconds: result.estimatedWaitSeconds ?? 60,
            });
          });
          return;
        }

        throw new Error("Unexpected response from verification server.");
      }

      throw new Error(`Unsupported payment provider: "${provider}"`);

    } catch (e) {
      safe(() => {
        setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
        setStatus("failed");
        setLoading(false);
      });
    }
  }, [safe]);

  const applyCode = useCallback(async ({ code, userId, products, onSuccess }) => {
    safe(() => { setLoading(true); setError(null); });
    try {
      await applyInviteCode({ code, userId, products });
      safe(() => { setLoading(false); setStatus("completed"); });
      onSuccess?.();
    } catch (e) {
      safe(() => {
        setError(e instanceof Error ? e.message : "Invalid code");
        setLoading(false);
      });
    }
  }, [safe]);

  return { loading, error, status, pendingInfo, initiatePayment, applyCode, reset };
}

export default usePayment;