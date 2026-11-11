import { supabase } from "../config/supabase";

async function invokeDeposit(body) {
  const { data, error } = await supabase.functions.invoke("web3-wallet-deposit", {
    body,
  });

  if (error) {
    const context = error.context;
    if (context instanceof Response) {
      let payload = null;
      try {
        payload = await context.clone().json();
      } catch {}
      if (typeof payload?.error === "string") throw new Error(payload.error);
    }
    throw new Error(error.message || "Web3 deposit request failed.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Web3 deposit service returned an invalid response.");
  }
  if (typeof data.error === "string") {
    throw new Error(data.error);
  }
  return data;
}

export function createWeb3DepositChallenge({
  chainType,
  chain,
  asset,
  walletAddress,
  requestedUsdAmount,
}) {
  return invokeDeposit({
    action: "challenge",
    chainType,
    chain,
    asset,
    walletAddress,
    requestedUsdAmount,
  });
}

export function getWeb3DepositQuote({ chainType, chain, asset }) {
  return invokeDeposit({
    action: "quote",
    chainType,
    chain,
    asset,
  });
}

export function verifyWeb3WalletDeposit({
  challengeId,
  chainType,
  chain,
  asset,
  walletAddress,
  signature,
  cardanoKey,
  cardanoSignature,
  txHash,
}) {
  return invokeDeposit({
    action: "verify",
    challengeId,
    chainType,
    chain,
    asset,
    walletAddress,
    signature,
    cardanoKey,
    cardanoSignature,
    txHash,
  });
}
