import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Copy,
  Loader,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  createWeb3DepositChallenge,
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
.w3d-back { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 14px; padding: 7px 0; border: 0; background: transparent; color: rgba(255,255,255,.63); font: inherit; font-size: 12px; cursor: pointer; }
.w3d-back:hover { color: #a3e635; }
.w3d-spinner { animation: w3d-spin .9s linear infinite; }
@keyframes w3d-spin { to { transform: rotate(360deg); } }
@media(max-width:440px) { .w3d-grid { grid-template-columns: 1fr; gap: 12px; } }
`;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/i, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
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

export default function Web3DepositView({ onBack, onRefresh }) {
  const [chainType, setChainType] = useState("EVM");
  const [chain, setChain] = useState("base");
  const [asset, setAsset] = useState("USDC");
  const [cardanoWalletId, setCardanoWalletId] = useState("");
  const [proof, setProof] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [result, setResult] = useState(null);

  const networks = NETWORKS[chainType];
  const cardanoWallets = useMemo(() => getCardanoWallets(), []);

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
      <button className="w3d-back" onClick={onBack} type="button">
        <ArrowLeft size={14} />
        Back to deposit methods
      </button>

      <div className="w3d-head">
        <h2 className="w3d-title">Deposit with crypto</h2>
        <p className="w3d-description">
          Send a supported asset, then verify its on-chain transaction to credit your EP balance.
          <span className="w3d-asset"> USDT is supported.</span>
        </p>
      </div>

      {result ? (
        <div className="w3d-success">
          <CheckCircle size={17} />
          <div>
            <strong>{result.alreadyCredited ? "Deposit already credited" : "Deposit verified"}</strong>
            <div>+{Number(result.epCredited).toLocaleString()} EP added to your wallet.</div>
            <div>Transaction: {result.txHash}</div>
            <button className="w3d-back" onClick={startOver} type="button">Make another deposit</button>
          </div>
        </div>
      ) : (
        <>
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
              Send only <strong>{asset}</strong> on <strong>{networks.find((item) => item.id === chain)?.name}</strong>.
              Minimum deposit is $1 equivalent. Your wallet signs a one-time ownership proof; it does not approve or send funds.
            </span>
          </div>

          {!proof ? (
            <button className="w3d-cta" disabled={busy} onClick={connectAndSign} type="button">
              {busy ? <Loader size={16} className="w3d-spinner" /> : <Wallet size={16} />}
              {busy ? "Connecting wallet…" : "Connect wallet & show deposit address"}
            </button>
          ) : (
            <>
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
