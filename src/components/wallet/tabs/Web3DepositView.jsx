import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Loader,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  createWeb3DepositChallenge,
  getWeb3DepositQuote,
  verifyWeb3WalletDeposit,
} from "../../../services/wallet/web3WalletDepositService";

const NETWORKS = {
  EVM: [
    { id: "ethereum", name: "Ethereum", chainId: 1 },
    { id: "polygon", name: "Polygon", chainId: 137 },
    { id: "base", name: "Base", chainId: 8453 },
    { id: "arbitrum", name: "Arbitrum One", chainId: 42161 },
    { id: "optimism", name: "Optimism", chainId: 10 },
    { id: "bnb", name: "BNB Smart Chain", chainId: 56 },
    { id: "avalanche", name: "Avalanche", chainId: 43114 },
    { id: "zksync", name: "zkSync Era", chainId: 324 },
    { id: "fantom", name: "Fantom", chainId: 250 },
  ],
  SOLANA: [{ id: "solana", name: "Solana" }],
  CARDANO: [{ id: "cardano", name: "Cardano" }],
};

const ASSETS = {
  EVM: ["USDC", "USDT"],
  SOLANA: ["USDC", "USDT"],
  CARDANO: ["ADA"],
};

const STYLES = `
.w3d { color: rgba(255,255,255,.92); padding: 8px 0 24px; }
.w3d-head { margin: 0 0 16px; }
.w3d-title { margin: 0; font-size: 19px; line-height: 1.25; font-weight: 800; color: #f7f8f6; }
.w3d-description { margin: 6px 0 0; color: rgba(255,255,255,.58); font-size: 13px; line-height: 1.55; }
.w3d-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.w3d-field { min-width: 0; }
.w3d-amount-panel { margin-bottom: 14px; padding: 14px; border: 1px solid rgba(163,230,53,.17); border-radius: 14px; background: linear-gradient(135deg,rgba(163,230,53,.055),rgba(255,255,255,.018)); }
.w3d-amount-row { display: grid; grid-template-columns: minmax(0,1fr) 32px minmax(0,1fr); align-items: end; gap: 9px; }
.w3d-amount-label { display: block; margin-bottom: 7px; color: rgba(255,255,255,.5); font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.w3d-amount-box { display: flex; align-items: center; min-width: 0; min-height: 56px; padding: 0 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 11px; background: rgba(0,0,0,.2); }
.w3d-amount-box:focus-within { border-color: rgba(163,230,53,.58); box-shadow: 0 0 0 3px rgba(163,230,53,.08); }
.w3d-amount-box output,.w3d-amount-box input { min-width: 0; width: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: #f4f4f5; font: 700 clamp(17px,4vw,24px) ui-monospace,SFMono-Regular,Menlo,monospace; }
.w3d-amount-box output { color: #a3e635; }
.w3d-amount-unit { flex: 0 0 auto; margin-left: 7px; color: rgba(255,255,255,.44); font: 700 9px ui-monospace,SFMono-Regular,Menlo,monospace; }
.w3d-amount-arrow { display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 13px; border: 1px solid rgba(255,255,255,.1); border-radius: 50%; color: #a3e635; }
.w3d-quick { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; margin-top: 10px; }
.w3d-quick button { min-height: 34px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.025); color: rgba(255,255,255,.6); font: 700 10px ui-monospace,SFMono-Regular,Menlo,monospace; cursor: pointer; }
.w3d-quick button:hover,.w3d-quick button.active { border-color: rgba(163,230,53,.4); background: rgba(163,230,53,.07); color: #bef264; }
.w3d-amount-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 9px; color: rgba(255,255,255,.46); font-size: 10px; line-height: 1.5; }
.w3d-minimum { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px 16px; margin: 0 0 14px; padding: 15px; border: 1px solid rgba(163,230,53,.25); border-radius: 14px; background: radial-gradient(ellipse at 0 0,rgba(163,230,53,.1),transparent 58%),linear-gradient(120deg,rgba(163,230,53,.055),rgba(255,255,255,.025) 72%); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); }
.w3d-minimum-copy { min-width: 0; }
.w3d-minimum-label { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.72); font-size: 10px; font-weight: 800; letter-spacing: .1em; line-height: 1.4; text-transform: uppercase; }
.w3d-minimum-balance { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; margin-top: 5px; }
.w3d-minimum-balance strong { color: #f5f8ef; font: 800 clamp(20px,4vw,25px)/1.15 ui-sans-serif,system-ui,sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -.035em; }
.w3d-minimum-balance span { color: rgba(255,255,255,.47); font: 700 10px ui-monospace,SFMono-Regular,Menlo,monospace; }
.w3d-minimum-equivalent { margin-top: 5px; color: #bef264; font-size: 11px; font-weight: 650; line-height: 1.45; }
.w3d-minimum-asset-card { min-width: 82px; padding: 9px 11px; border: 1px solid rgba(190,242,100,.18); border-radius: 10px; background: rgba(0,0,0,.24); text-align: right; }
.w3d-minimum-asset-label { display: block; margin-bottom: 4px; color: rgba(255,255,255,.44); font-size: 8px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.w3d-minimum-asset { color: #d9f99d; font: 800 15px ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
.w3d-minimum-estimate { grid-column: 1 / -1; width: 100%; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.64); font-size: 10px; line-height: 1.55; }
.w3d-minimum-estimate strong { color: #bef264; font-weight: 700; }
.w3d-minimum-unavailable { color: #fbbf24; }
.w3d-minimum-error { margin-top: 3px; color: #fbbf24; font-size: 11px; line-height: 1.5; }
.w3d-market-trend { display: flex; align-items: center; gap: 5px; margin-top: 7px; color: rgba(255,255,255,.55); font-size: 10px; line-height: 1.4; }
.w3d-market-trend.up { color: #86efac; }
.w3d-market-trend.down { color: #fca5a5; }
.w3d-label { display: block; margin: 0 0 7px; color: rgba(255,255,255,.55); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.w3d-select,.w3d-input { box-sizing: border-box; width: 100%; min-height: 46px; border: 1px solid rgba(255,255,255,.13); border-radius: 11px; background: rgba(255,255,255,.045); color: #f6f7f4; padding: 0 12px; font: inherit; outline: none; }
.w3d-select:focus,.w3d-input:focus { border-color: rgba(163,230,53,.62); box-shadow: 0 0 0 3px rgba(163,230,53,.09); }
.w3d-select option { background: #171b18; color: #fff; }
.w3d-note { display: flex; gap: 9px; align-items: flex-start; margin: 14px 0; padding: 11px 12px; border: 1px solid rgba(163,230,53,.16); border-radius: 11px; background: rgba(163,230,53,.045); color: rgba(255,255,255,.68); font-size: 12px; line-height: 1.5; }
.w3d-note svg { flex: 0 0 auto; color: #a3e635; margin-top: 1px; }
.w3d-address { min-width: 0; margin: 12px 0; padding: 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 11px; background: rgba(255,255,255,.025); }
.w3d-address-label { color: rgba(255,255,255,.48); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.w3d-address-row { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
.w3d-address-value { min-width: 0; overflow-wrap: anywhere; color: rgba(255,255,255,.88); font: 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
.w3d-copy-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; background: rgba(255,255,255,.05); color: rgba(255,255,255,.7); cursor: pointer; }
.w3d-copy-btn:hover { border-color: rgba(163,230,53,.45); color: #a3e635; }
.w3d-cta { display: inline-flex; width: 100%; min-height: 46px; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 11px; background: linear-gradient(110deg,#bef264,#84cc16); color: #10140b; font-size: 13px; font-weight: 800; cursor: pointer; }
.w3d-cta:disabled { opacity: .55; cursor: not-allowed; }
.w3d-error,.w3d-pending,.w3d-success { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 11px 12px; border-radius: 10px; font-size: 12px; line-height: 1.5; }
.w3d-error { border: 1px solid rgba(248,113,113,.24); background: rgba(248,113,113,.07); color: #fca5a5; }
.w3d-pending { border: 1px solid rgba(250,204,21,.2); background: rgba(250,204,21,.06); color: #fde68a; }
.w3d-success { border: 1px solid rgba(52,211,153,.22); background: rgba(52,211,153,.07); color: #6ee7b7; }
.w3d-error svg,.w3d-pending svg,.w3d-success svg { flex: 0 0 auto; margin-top: 1px; }
.w3d-success strong { color: #a7f3d0; }
.w3d-tx { margin-top: 16px; }
.w3d-tx .w3d-input { font: 12px ui-monospace,SFMono-Regular,Menlo,monospace; }
.w3d-asset { color: #a3e635; font-weight: 800; }
.w3d-secondary-action { display: inline-flex; align-items: center; gap: 7px; margin-top: 8px; padding: 7px 0; border: 0; background: transparent; color: rgba(255,255,255,.7); font: inherit; font-size: 12px; cursor: pointer; }
.w3d-secondary-action:hover { color: #a3e635; }
.w3d-spinner { animation: w3d-spin .9s linear infinite; }
@keyframes w3d-spin { to { transform: rotate(360deg); } }
@media(max-width:440px) { .w3d-grid { grid-template-columns: 1fr; gap: 12px; } .w3d-minimum { grid-template-columns: minmax(0,1fr) auto; gap: 10px; padding: 12px; } .w3d-minimum-asset-card { min-width: 72px; padding: 8px; } .w3d-minimum-asset { font-size: 13px; } }
`;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toHexString(bytes) {
  return bytesToHex(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

function getCardanoWallets() {
  if (typeof window === "undefined" || !window.cardano) return [];
  return Object.entries(window.cardano)
    .filter(([, wallet]) => typeof wallet?.enable === "function")
    .map(([id, wallet]) => ({ id, wallet }));
}

export default function Web3DepositView({ onRefresh }) {
  const [chainType, setChainType] = useState("EVM");
  const [chain, setChain] = useState("base");
  const [asset, setAsset] = useState("USDC");
  const [cardanoWalletId, setCardanoWalletId] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [marketQuote, setMarketQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [proof, setProof] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [result, setResult] = useState(null);

  const networks = NETWORKS[chainType];
  const cardanoWallets = useMemo(() => getCardanoWallets(), []);
  const usdNgnRate = marketQuote?.unitPriceUsd > 0 && marketQuote?.unitPriceNgn > 0
    ? marketQuote.unitPriceNgn / marketQuote.unitPriceUsd
    : null;
  const minimumNairaAmount = usdNgnRate ? Math.ceil(usdNgnRate / 100) * 100 : null;
  const minimumUsdAmount = minimumNairaAmount && usdNgnRate
    ? minimumNairaAmount / usdNgnRate
    : null;
  const requestedNairaAmount = Number.parseFloat(requestedAmount);
  const requestedUsdAmount = usdNgnRate && Number.isFinite(requestedNairaAmount)
    ? Math.ceil((requestedNairaAmount / usdNgnRate) * 100 - 1e-8) / 100
    : Number.NaN;
  const estimatedEp = Number.isFinite(requestedUsdAmount) && requestedUsdAmount > 0
    ? Math.floor(requestedUsdAmount * 100)
    : 0;
  const estimatedAssetAmount = Number.isFinite(requestedUsdAmount) && marketQuote?.unitPriceUsd > 0
    ? (requestedUsdAmount / marketQuote.unitPriceUsd)
    : null;
  const minimumAssetAmount = minimumUsdAmount && marketQuote?.unitPriceUsd > 0
    ? Math.ceil((minimumUsdAmount / marketQuote.unitPriceUsd) * 1_000_000) / 1_000_000
    : null;
  const amountIsValid = Number.isFinite(requestedUsdAmount)
    && minimumNairaAmount !== null
    && requestedNairaAmount >= minimumNairaAmount
    && requestedUsdAmount >= 1
    && requestedUsdAmount <= 1_000_000
    && Math.abs(requestedUsdAmount * 100 - Math.round(requestedUsdAmount * 100)) < 1e-8;

  React.useEffect(() => {
    let active = true;
    setMarketQuote(null);
    setQuoteLoading(true);
    setQuoteError("");
    getWeb3DepositQuote({ chainType, chain, asset })
      .then((quote) => {
        const unitPriceUsd = Number(quote?.unitPriceUsd);
        const unitPriceNgn = Number(quote?.unitPriceNgn);
        const priceChange24hPercent = Number(quote?.priceChange24hPercent);
        const quotedAt = Date.parse(quote?.quotedAt);
        const quoteAge = Date.now() - quotedAt;
        if (
          !Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0 ||
          !Number.isFinite(unitPriceNgn) || unitPriceNgn <= 0 ||
          !Number.isFinite(priceChange24hPercent) ||
          !Number.isFinite(quotedAt) || quoteAge < -5 * 60 * 1000 ||
          quoteAge > 24 * 60 * 60 * 1000
        ) {
          throw new Error("A fresh USD/NGN market quote is unavailable.");
        }
        if (active) setMarketQuote({ unitPriceUsd, unitPriceNgn, priceChange24hPercent, quotedAt });
      })
      .catch((quoteRequestError) => {
        if (!active) return;
        setMarketQuote(null);
        setQuoteError(quoteRequestError?.message || "Live market quote is unavailable.");
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => { active = false; };
  }, [chainType, chain, asset]);

  const changeChainType = (nextType) => {
    setChainType(nextType);
    setChain(NETWORKS[nextType][0].id);
    setAsset(ASSETS[nextType][0]);
    setProof(null);
    setTxHash("");
    setPending("");
    setError("");
    setResult(null);
  };

  const changeAmount = (value) => {
    setRequestedAmount(value);
    setProof(null);
    setTxHash("");
    setPending("");
    setError("");
  };

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("Could not copy to clipboard. Select and copy the address manually.");
    }
  };

  const connectAndSign = async () => {
    setError("");
    setPending("");
    setBusy(true);
    try {
      let walletAddress;
      let sign;

      if (chainType === "EVM") {
        const provider = window.ethereum;
        if (!provider?.request) {
          throw new Error("Open this page in a browser with an EVM wallet, such as MetaMask.");
        }
        const selectedNetwork = NETWORKS.EVM.find((item) => item.id === chain);
        const expectedChainId = `0x${selectedNetwork.chainId.toString(16)}`;
        let currentChainId = await provider.request({ method: "eth_chainId" });
        if (String(currentChainId).toLowerCase() !== expectedChainId) {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: expectedChainId }],
          });
          currentChainId = await provider.request({ method: "eth_chainId" });
        }
        if (String(currentChainId).toLowerCase() !== expectedChainId) {
          throw new Error(`Switch your wallet to ${selectedNetwork.name} and try again.`);
        }
        const accounts = await provider.request({ method: "eth_requestAccounts" });
        walletAddress = accounts?.[0];
        if (!walletAddress) throw new Error("No EVM account was returned by your wallet.");
        sign = async (message) => provider.request({
          method: "personal_sign",
          params: [message, walletAddress],
        });
      } else if (chainType === "SOLANA") {
        const provider = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
        if (!provider?.connect || !provider?.signMessage) {
          throw new Error("Open this page in a browser with Phantom or another compatible Solana wallet.");
        }
        const connection = await provider.connect();
        walletAddress = connection?.publicKey?.toString() ?? provider.publicKey?.toString();
        if (!walletAddress) throw new Error("No Solana account was returned by your wallet.");
        sign = async (message) => {
          const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
          return { signature: toHexString(signed.signature) };
        };
      } else {
        const selectedWallet = cardanoWallets.find((item) => item.id === cardanoWalletId)
          ?? cardanoWallets[0];
        if (!selectedWallet) throw new Error("No CIP-30 Cardano wallet was found in this browser.");
        const api = await selectedWallet.wallet.enable();
        const usedAddresses = await api.getUsedAddresses();
        walletAddress = usedAddresses?.[0]
          ?? (typeof api.getChangeAddress === "function" ? await api.getChangeAddress() : null);
        if (typeof walletAddress !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(walletAddress)) {
          throw new Error("The Cardano wallet did not return a valid mainnet address.");
        }
        sign = async (message) => {
          const messageHex = bytesToHex(new TextEncoder().encode(message));
          const signed = await api.signData(walletAddress, messageHex);
          if (!signed?.signature || !signed?.key) {
            throw new Error("The Cardano wallet returned an invalid signature.");
          }
          return { cardanoSignature: signed.signature, cardanoKey: signed.key };
        };
      }

      const challenge = await createWeb3DepositChallenge({
        chainType,
        chain,
        asset,
        walletAddress,
        requestedUsdAmount,
      });
      const signedProof = await sign(challenge.message);
      setProof({
        ...signedProof,
        challengeId: challenge.challengeId,
        walletAddress,
        treasuryAddress: challenge.treasuryAddress,
        tokenAddress: challenge.tokenAddress,
        expiresAt: challenge.expiresAt,
      });
    } catch (requestError) {
      setError(requestError?.message || "Could not connect and verify the wallet.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!proof) {
      setError("Connect and sign with the sending wallet first.");
      return;
    }
    if (!txHash.trim()) {
      setError("Enter the on-chain transaction hash.");
      return;
    }
    setBusy(true);
    setError("");
    setPending("");
    try {
      const verified = await verifyWeb3WalletDeposit({
        challengeId: proof.challengeId,
        chainType,
        chain,
        asset,
        walletAddress: proof.walletAddress,
        signature: proof.signature,
        cardanoKey: proof.cardanoKey,
        cardanoSignature: proof.cardanoSignature,
        txHash: txHash.trim(),
      });
      if (verified.status === "pending") {
        setPending(verified.message || "Waiting for finality. Try verifying again shortly.");
      } else {
        setResult(verified);
        onRefresh?.();
      }
    } catch (requestError) {
      setError(requestError?.message || "Could not verify this deposit.");
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setProof(null);
    setTxHash("");
    setPending("");
    setError("");
    setResult(null);
  };

  return (
    <section className="w3d">
      <style>{STYLES}</style>
      {result ? (
        <div className="w3d-success">
          <CheckCircle size={17} />
          <div>
            <strong>{result.alreadyCredited ? "Deposit already credited" : "Deposit verified"}</strong>
            <div>+{Number(result.epCredited).toLocaleString()} EP added to your wallet.</div>
            <div>Transaction: {result.txHash}</div>
            <button className="w3d-secondary-action" onClick={startOver} type="button">Make another deposit</button>
          </div>
        </div>
      ) : (
        <>
          <div className="w3d-amount-panel">
            <div className="w3d-amount-row">
              <label>
                <span className="w3d-amount-label">You Pay</span>
                <span className="w3d-amount-box">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={minimumNairaAmount ?? undefined}
                    max={usdNgnRate ? (usdNgnRate * 1_000_000).toFixed(2) : undefined}
                    step="1"
                    value={requestedAmount}
                    disabled={quoteLoading || !marketQuote}
                    onChange={(event) => changeAmount(event.target.value)}
                    placeholder="0"
                    aria-label="Amount to pay in Nigerian naira"
                  />
                  <span className="w3d-amount-unit">NGN</span>
                </span>
              </label>
              <span className="w3d-amount-arrow" aria-hidden="true">→</span>
              <div>
                <span className="w3d-amount-label">You Get</span>
                <span className="w3d-amount-box">
                  <output aria-label="Estimated Engagement Points">{estimatedEp.toLocaleString()}</output>
                  <span className="w3d-amount-unit">EP</span>
                </span>
              </div>
            </div>
            <div className="w3d-quick" aria-label="Quick deposit amounts">
              {[500, 1000, 2000, 5000].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={Number(requestedAmount) === amount ? "active" : ""}
                  onClick={() => changeAmount(String(amount))}
                >
                  ₦{amount >= 1000 ? `${amount / 1000}k` : amount}
                </button>
              ))}
            </div>
            <div className="w3d-amount-foot">
              <span>
                {quoteLoading
                  ? "Fetching live market rate…"
                  : usdNgnRate
                    ? `1 USD ≈ ₦${usdNgnRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : "Live market rate unavailable"}
              </span>
              <span>100 EP / USD</span>
            </div>
          </div>

          <div className="w3d-minimum" aria-live="polite">
            <div className="w3d-minimum-copy">
              <div className="w3d-minimum-label">Minimum crypto deposit</div>
              <div className="w3d-minimum-balance">
                <strong aria-label="Minimum deposit in Nigerian naira">
                  {quoteLoading
                    ? "Loading…"
                    : minimumNairaAmount
                      ? `₦${minimumNairaAmount.toLocaleString()}`
                      : "Unavailable"}
                </strong>
                <span>NGN</span>
              </div>
              <div className="w3d-minimum-equivalent">
                {minimumUsdAmount ? `≈ $${minimumUsdAmount.toFixed(2)} USD · rounded up to ₦100` : "$1 USD minimum"}
              </div>
              {quoteError && (
                <div className="w3d-minimum-error" role="status">{quoteError}</div>
              )}
              {marketQuote && (
                <div className={`w3d-market-trend ${marketQuote.priceChange24hPercent > 0 ? "up" : marketQuote.priceChange24hPercent < 0 ? "down" : ""}`}>
                  {marketQuote.priceChange24hPercent > 0
                    ? <TrendingUp size={13} aria-hidden="true" />
                    : marketQuote.priceChange24hPercent < 0
                      ? <TrendingDown size={13} aria-hidden="true" />
                      : null}
                  <span>
                    {asset} {marketQuote.priceChange24hPercent > 0 ? "up" : marketQuote.priceChange24hPercent < 0 ? "down" : "unchanged"}{" "}
                    {Math.abs(marketQuote.priceChange24hPercent).toFixed(2)}% vs USD in 24h · quoted {new Date(marketQuote.quotedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
            <div className="w3d-minimum-asset-card">
              <span className="w3d-minimum-asset-label">Minimum amount</span>
              <div className={`w3d-minimum-asset${!minimumAssetAmount && !quoteLoading ? " w3d-minimum-unavailable" : ""}`}>
                {quoteLoading
                  ? "Calculating…"
                  : minimumAssetAmount
                    ? `${minimumAssetAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${asset}`
                    : "Price unavailable"}
              </div>
            </div>
            <div className="w3d-minimum-estimate">
              {estimatedAssetAmount
                ? <>Estimated for your amount: <strong>≈ {estimatedAssetAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset}</strong></>
                : "Enter an amount to estimate the crypto needed."}
              {" "}Estimate only; final EP uses the confirmed transfer.
            </div>
          </div>
          {!amountIsValid && requestedAmount && (
            <div className="w3d-minimum-label" role="status" style={{ margin: "-8px 0 12px" }}>
              {minimumNairaAmount
                ? `Enter at least ₦${minimumNairaAmount.toLocaleString()} to meet the live $1 minimum.`
                : "A live quote is required before entering a deposit amount."}
            </div>
          )}

          <div className="w3d-grid">
            <label className="w3d-field">
              <span className="w3d-label">Network family</span>
              <select
                className="w3d-select"
                value={chainType}
                onChange={(event) => changeChainType(event.target.value)}
              >
                <option value="EVM">EVM networks</option>
                <option value="SOLANA">Solana</option>
                <option value="CARDANO">Cardano</option>
              </select>
            </label>
            <label className="w3d-field">
              <span className="w3d-label">Network</span>
              <select
                className="w3d-select"
                value={chain}
                onChange={(event) => {
                  setChain(event.target.value);
                  setProof(null);
                  setPending("");
                  setError("");
                }}
              >
                {networks.map((networkOption) => (
                  <option key={networkOption.id} value={networkOption.id}>{networkOption.name}</option>
                ))}
              </select>
            </label>
            <label className="w3d-field">
              <span className="w3d-label">Asset</span>
              <select
                className="w3d-select"
                value={asset}
                onChange={(event) => {
                  setAsset(event.target.value);
                  setProof(null);
                  setPending("");
                  setError("");
                }}
              >
                {ASSETS[chainType].map((assetOption) => (
                  <option key={assetOption} value={assetOption}>{assetOption}</option>
                ))}
              </select>
            </label>
            {chainType === "CARDANO" && cardanoWallets.length > 1 && (
              <label className="w3d-field">
                <span className="w3d-label">Cardano wallet</span>
                <select
                  className="w3d-select"
                  value={cardanoWalletId}
                  onChange={(event) => setCardanoWalletId(event.target.value)}
                >
                  <option value="">Choose wallet</option>
                  {cardanoWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>{wallet.id}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="w3d-note">
            <ShieldCheck size={16} />
            <span>
              {quoteLoading || !marketQuote
                ? "Waiting for a fresh market quote. Deposits are disabled until pricing is available."
                : <>
              Send only <strong>{asset}</strong> on <strong>{networks.find((item) => item.id === chain)?.name}</strong>.
              Send at least <strong>${amountIsValid ? requestedUsdAmount.toFixed(2) : "1.00"} USD equivalent</strong>
              (about ₦{amountIsValid ? requestedNairaAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : minimumNairaAmount?.toLocaleString() ?? "—"}).
              The final EP credit is calculated from the confirmed transaction amount. Your wallet signs a one-time ownership proof; it does not approve or send funds.
                </>}
            </span>
          </div>

          {!proof ? (
          <button className="w3d-cta" disabled={busy || quoteLoading || !marketQuote || !amountIsValid} onClick={connectAndSign} type="button">
            {busy ? <Loader size={16} className="w3d-spinner" /> : <Wallet size={16} />}
            {busy ? "Connecting wallet…" : quoteLoading ? "Loading live quote…" : !marketQuote ? "Live quote unavailable" : !amountIsValid ? "Enter deposit amount first" : "Connect wallet & show deposit address"}
            </button>
          ) : (
            <>
              <div className="w3d-note">
                <ShieldCheck size={16} />
                <span>
                  Your requested deposit is <strong>₦{requestedNairaAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} (about ${requestedUsdAmount.toFixed(2)})</strong>.
                  The confirmed transaction must meet or exceed this amount.
                </span>
              </div>
              <button className="w3d-back" onClick={() => changeAmount(requestedAmount)} type="button">
                Change deposit amount
              </button>
              <div className="w3d-address">
                <div className="w3d-address-label">Send {asset} on {networks.find((item) => item.id === chain)?.name} to</div>
                <div className="w3d-address-row">
                  <div className="w3d-address-value">{proof.treasuryAddress}</div>
                  <button
                    className="w3d-copy-btn"
                    aria-label="Copy deposit address"
                    onClick={() => copy("treasury", proof.treasuryAddress)}
                    type="button"
                  >
                    {copied === "treasury" ? <CheckCircle size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
              {proof.tokenAddress && (
                <div className="w3d-address">
                  <div className="w3d-address-label">{asset} token contract / mint</div>
                  <div className="w3d-address-row">
                    <div className="w3d-address-value">{proof.tokenAddress}</div>
                    <button
                      className="w3d-copy-btn"
                      aria-label={`Copy ${asset} token address`}
                      onClick={() => copy("token", proof.tokenAddress)}
                      type="button"
                    >
                      {copied === "token" ? <CheckCircle size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              )}
              <div className="w3d-note">
                <AlertCircle size={16} />
                <span>
                  The wallet proof expires at {new Date(proof.expiresAt).toLocaleTimeString()}.
                  If it expires before you send, reconnect to create a fresh proof.
                </span>
              </div>
              <label className="w3d-field w3d-tx">
                <span className="w3d-label">Transaction hash / signature</span>
                <input
                  className="w3d-input"
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck="false"
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  placeholder={chainType === "EVM" ? "0x…" : "Paste transaction hash"}
                />
              </label>
              <button className="w3d-cta" disabled={busy || !txHash.trim()} onClick={verify} type="button">
                {busy ? <Loader size={16} className="w3d-spinner" /> : <ShieldCheck size={16} />}
                {busy ? "Verifying on-chain…" : "Verify deposit & credit EP"}
              </button>
            </>
          )}
        </>
      )}

      {pending && <div className="w3d-pending"><AlertCircle size={15} />{pending}</div>}
      {error && <div className="w3d-error"><AlertCircle size={15} />{error}</div>}
    </section>
  );
}
