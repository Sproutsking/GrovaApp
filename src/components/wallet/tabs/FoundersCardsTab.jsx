import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Coins,
  CreditCard,
  Crown,
  LoaderCircle,
  Zap,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { foundersCardService } from "../../../services/foundersCardService";
import {
  createPaystackTransaction,
  requestWalletPayment,
  verifyWeb3Payment,
} from "../../../services/auth/paymentService";

const TIER_ORDER = ["Silver", "Gold", "Diamond", "VIP"];
const SUPPLY_PAGE_SIZE = 24;

const TIER_SKINS = {
  Silver: { accent: "#d1d5db", glow: "rgba(203,213,225,.2)", backdrop: "linear-gradient(140deg,#262d38,#101318 54%,#313845)" },
  Gold: { accent: "#f4c767", glow: "rgba(244,199,103,.22)", backdrop: "linear-gradient(140deg,#3d2c12,#130e08 54%,#4b3516)" },
  Diamond: { accent: "#a9c5ff", glow: "rgba(134,164,255,.24)", backdrop: "linear-gradient(140deg,#1d2b4d,#090c17 54%,#30214f)" },
  VIP: { accent: "#f0d18a", glow: "rgba(220,174,76,.24)", backdrop: "linear-gradient(140deg,#382b12,#080807 54%,#30220c)" },
};

const CRYPTO_OPTIONS = {
  polygon: {
    label: "Polygon",
    chainId: 137,
    token: "USDC",
    tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
  },
  base: {
    label: "Base",
    chainId: 8453,
    token: "USDC",
    tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913",
    decimals: 6,
  },
  arbitrum: {
    label: "Arbitrum",
    chainId: 42161,
    token: "USDC",
    tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
  },
  optimism: {
    label: "Optimism",
    chainId: 10,
    token: "USDC",
    tokenAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
  },
};

function formatPrice(tier) {
  if (!tier?.price_currency) return "Price not confirmed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: tier.price_currency,
    minimumFractionDigits: 2,
  }).format(Number(tier.list_price));
}

function getTierSkin(tier) {
  return TIER_SKINS[tier] || TIER_SKINS.Silver;
}

function FoundersCardPreview({ tier, serialDisplay, status, onClick, selected = false }) {
  const skin = getTierSkin(tier);
  const content = (
    <>
      <span className="fc-preview-brand">XEEVIA · FOUNDERS</span>
      <span className="fc-preview-gem"><Crown size={24} strokeWidth={1.4} /></span>
      <span className="fc-preview-tier">{tier}</span>
      <span className="fc-preview-serial">{serialDisplay}</span>
      {status === "owned" && <span className="fc-preview-status">ISSUED</span>}
      {status === "reserved" && <span className="fc-preview-status">RESERVED</span>}
      {status === "pending" && <span className="fc-preview-status">PENDING</span>}
    </>
  );
  const className = `fc-preview ${status || "available"}${selected ? " selected" : ""}`;
  const accessibleName = `${tier} card ${serialDisplay}, ${status || "available"}`;
  const style = { "--fc-accent": skin.accent, "--fc-glow": skin.glow, "--fc-backdrop": skin.backdrop };

  if (!onClick) {
    return (
      <div className={className} role="img" aria-label={accessibleName} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={`${tier} ${serialDisplay} · ${status || "available"}`}
      aria-label={accessibleName}
      style={style}
    >
      {content}
    </button>
  );
}

function AssetRow({ tier, cards, onClick }) {
  const skin = getTierSkin(tier);
  return (
    <button type="button" className="fc-asset-row" onClick={onClick} style={{ "--fc-accent": skin.accent }}>
      <span className="fc-asset-icon"><Crown size={19} /></span>
      <span className="fc-asset-copy">
        <strong>Xeevia Founders · {tier}</strong>
        <small>{cards.length} individually numbered {cards.length === 1 ? "card" : "cards"}</small>
      </span>
      <span className="fc-asset-balance">{cards.length}</span>
      <ChevronRight size={17} className="fc-muted-icon" />
    </button>
  );
}

function WalletBalanceAsset({ icon: Icon, label, amount, unit, accent }) {
  return (
    <div className="fc-asset-row fc-balance-row" style={{ "--fc-accent": accent }}>
      <span className="fc-asset-icon"><Icon size={19} /></span>
      <span className="fc-asset-copy"><strong>{label}</strong></span>
      <span className="fc-asset-balance">{Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {unit}</span>
    </div>
  );
}

export default function FoundersCardsTab({ setActiveTab, initialScreen = "collection", balance }) {
  const [catalog, setCatalog] = useState({ tiers: [], cards: [] });
  const [ownedCards, setOwnedCards] = useState([]);
  const [screen, setScreen] = useState(initialScreen);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [purchasePanelOpen, setPurchasePanelOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [supplyPage, setSupplyPage] = useState(0);
  const [provider, setProvider] = useState("paystack");
  const [chain, setChain] = useState("polygon");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [liveUpdateError, setLiveUpdateError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderId, setOrderId] = useState("");
  const [pendingCrypto, setPendingCrypto] = useState(null);
  const reloadSequence = useRef(0);
  const buyButtonRef = useRef(null);
  const buyDialogRef = useRef(null);

  useEffect(() => {
    if (!purchasePanelOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = buyButtonRef.current;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPurchasePanelOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...(buyDialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) || [])];
      if (!focusable.length) {
        event.preventDefault();
        buyDialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    buyDialogRef.current?.querySelector(".fc-buy-close")?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [purchasePanelOpen]);

  useEffect(() => {
    setPurchasePanelOpen(false);
  }, [screen, selectedTier]);

  const reload = useCallback(async (showLoading = false) => {
    const sequence = ++reloadSequence.current;
    if (showLoading) {
      setLoading(true);
      setError("");
    }
    try {
      const [nextCatalog, nextOwned] = await Promise.all([
        foundersCardService.getCatalog(),
        foundersCardService.getMyCards(),
      ]);
      if (sequence !== reloadSequence.current) return;
      setCatalog(nextCatalog || { tiers: [], cards: [] });
      setOwnedCards(Array.isArray(nextOwned) ? nextOwned : []);
    } catch (loadError) {
      if (sequence === reloadSequence.current) {
        setError(loadError.message || "Could not load founders cards.");
      }
    } finally {
      if (sequence === reloadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(true);
  }, [reload]);

  useEffect(() => {
    const unsubscribe = foundersCardService.subscribeToCatalogUpdates(
      () => reload(),
      (status) => {
        if (status === "SUBSCRIBED") {
          setLiveUpdateError("");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLiveUpdateError("Live collection updates are unavailable. Refresh to check the latest prices and sales.");
        }
      },
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [reload]);

  useEffect(() => {
    setSelectedTier(null);
    setScreen(initialScreen);
  }, [initialScreen]);

  useEffect(() => {
    const callbackOrderId = new URLSearchParams(window.location.search).get("founders_order_id");
    if (callbackOrderId) setOrderId(callbackOrderId);
  }, []);

  useEffect(() => {
    if (!orderId) return undefined;
    let active = true;
    let timer;
    let attempts = 0;
    const check = async () => {
      try {
        const order = await foundersCardService.getOrder(orderId);
        if (!active) return;
        if (order.status === "paid") {
          setNotice("Payment confirmed. Your founders card is now in your wallet.");
          setOrderId("");
          setPendingCrypto(null);
          await reload();
          return;
        }
        if (order.status === "expired" || order.status === "cancelled") {
          setNotice("This card reservation expired and no card was issued. If you already paid, contact support with your order or transaction reference.");
          setOrderId("");
          return;
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not check the purchase status.");
      }
      attempts += 1;
      if (active && attempts < 30) timer = window.setTimeout(check, 4000);
    };
    check();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderId, reload]);

  const tier = useMemo(
    () => (catalog.tiers || []).find((item) => item.tier === selectedTier) || null,
    [catalog.tiers, selectedTier],
  );
  const tierCards = useMemo(
    () => (catalog.cards || [])
      .filter((card) => card.tier === selectedTier)
      .sort((left, right) => Number(left.serial) - Number(right.serial)),
    [catalog.cards, selectedTier],
  );
  const ownedInTier = useMemo(
    () => ownedCards.filter((card) => card.tier === selectedTier),
    [ownedCards, selectedTier],
  );
  const firstAvailable = tierCards.find((card) => card.status === "available");
  const totalSupply = (catalog.tiers || []).reduce((total, item) => total + Number(item.supply || 0), 0);
  const registryReady = totalSupply > 0 && (catalog.cards || []).length === totalSupply;
  const tierSupply = Number(tier?.supply || 0);
  const supplyCards = useMemo(
    () => registryReady
      ? tierCards
      : Array.from({ length: tierSupply }, (_, index) => ({
        tier: selectedTier,
        serial: index + 1,
        supply: tierSupply,
        serial_display: `#${String(index + 1).padStart(6, "0")}/${String(tierSupply).padStart(4, "0")}`,
        status: "pending",
      })),
    [registryReady, selectedTier, tierCards, tierSupply],
  );
  const supplyPageCount = Math.max(1, Math.ceil(supplyCards.length / SUPPLY_PAGE_SIZE));
  const visibleSupplyCards = supplyCards.slice(
    supplyPage * SUPPLY_PAGE_SIZE,
    (supplyPage + 1) * SUPPLY_PAGE_SIZE,
  );
  const purchaseLimit = Math.min(Number(tier?.max_per_user || 0), Number(tier?.available || 0));
  const canPurchase = Boolean(
    registryReady &&
    tier?.sale_enabled &&
    tier?.price_currency === "USD" &&
    firstAvailable &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    quantity <= purchaseLimit,
  );

  const openMarketplaceTier = (tierName) => {
    setSelectedTier(tierName);
    setSupplyPage(0);
    setQuantity(1);
    setProvider("paystack");
    setPendingCrypto(null);
    setScreen("market-tier");
  };

  const startPurchase = async () => {
    if (!canPurchase) return;
    setProcessing(true);
    setError("");
    setNotice("");
    try {
      const order = await foundersCardService.reservePurchase(selectedTier, quantity, provider);
      setOrderId(order.order_id);
      if (provider === "paystack") {
        const result = await createPaystackTransaction({ foundersOrderId: order.order_id });
        if (result.already_completed) {
          setNotice("This purchase has already been completed.");
          await reload();
          return;
        }
        if (!result.authorization_url) throw new Error("Paystack did not return a checkout link.");
        window.location.assign(result.authorization_url);
        return;
      }

      const selectedCrypto = CRYPTO_OPTIONS[chain];
      const result = await requestWalletPayment({
        foundersOrderId: order.order_id,
        amountUSD: Number(order.total_price),
        chainId: selectedCrypto.chainId,
        chainName: chain,
        tokenAddress: selectedCrypto.tokenAddress,
        tokenDecimals: selectedCrypto.decimals,
        onStep: (step) => setNotice(step.message),
      });
      if (result.pending) {
        setPendingCrypto({
          orderId: order.order_id,
          txHash: result.txHash,
          senderWallet: result.senderWallet,
          chainName: result.chainName,
        });
        setNotice(result.message || "Transaction submitted. Waiting for network confirmation.");
      } else if (result.refundRequired) {
        setNotice(result.message || "Payment was verified after the reservation expired. Contact support with the transaction hash for a manual refund.");
        setOrderId("");
        setPendingCrypto(null);
      } else if (result.success) {
        setNotice("Crypto payment confirmed. Your founders card is now in your wallet.");
        setOrderId("");
        await reload();
      }
    } catch (purchaseError) {
      setError(purchaseError.message || "Could not start this purchase.");
    } finally {
      setProcessing(false);
    }
  };

  const retryCryptoVerification = async () => {
    if (!pendingCrypto) return;
    setProcessing(true);
    setError("");
    try {
      const result = await verifyWeb3Payment({
        chainType: "EVM",
        chain: pendingCrypto.chainName,
        txHash: pendingCrypto.txHash,
        claimedSenderWallet: pendingCrypto.senderWallet,
        foundersOrderId: pendingCrypto.orderId,
      });
      if (result.status === "success" || result.status === "already_processed") {
        setNotice("Crypto payment confirmed. Your founders card is now in your wallet.");
        setPendingCrypto(null);
        setOrderId("");
        await reload();
      } else if (result.status === "refund_required") {
        setNotice(result.message || "Payment was verified after the reservation expired. Contact support with the transaction hash for a manual refund.");
        setPendingCrypto(null);
        setOrderId("");
      } else {
        setNotice(result.message || "The transaction is still awaiting confirmation.");
      }
    } catch (verifyError) {
      setError(verifyError.message || "Could not verify the crypto transaction.");
    } finally {
      setProcessing(false);
    }
  };

  const transferSelectedCard = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProcessing(true);
    setError("");
    setNotice("");
    try {
      await foundersCardService.transferCard(selectedCard.id, formData.get("recipient"));
      setNotice("Card transferred to the Xeevia account.");
      setSelectedCard(null);
      setScreen("asset");
      await reload();
    } catch (transferError) {
      setError(transferError.message || "Could not transfer this card.");
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    setError("");
    setNotice("");
    if (screen === "detail") {
      setSelectedCard(null);
      setScreen("asset");
    } else if (screen === "market-tier" || screen === "asset") {
      setSelectedTier(null);
      setScreen(screen === "asset" ? "collection" : "marketplace");
    } else if (screen === "marketplace") {
      setScreen("collection");
    } else {
      setActiveTab("overview");
    }
  };

  const headerTitle = screen === "detail"
    ? "Card details"
    : screen === "market-tier"
      ? `${selectedTier} Collection`
      : screen === "asset"
        ? `Your ${selectedTier || ""} Cards`
        : screen === "marketplace"
          ? "Collections"
          : "Assets";

  return (
    <main className="fc-page">
      <style>{`
        .fc-page{min-height:100%;padding:clamp(10px,1.5vw,16px);padding-bottom:calc(clamp(10px,1.5vw,16px) + env(safe-area-inset-bottom, 0px));background:radial-gradient(ellipse at 92% 0%,rgba(198,255,0,.09),transparent 36%),#07080a;color:#f5f7f1;container-type:inline-size}
        .fc-top{display:flex;align-items:center;gap:8px;margin-bottom:12px;min-width:0}
        .fc-back{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:rgba(255,255,255,.055);color:#f0f3ed;font:inherit;font-weight:750;cursor:pointer;transition:background .18s,border-color .18s,color .18s}
        .fc-back:hover:not(:disabled){border-color:rgba(255,255,255,.38);background:rgba(255,255,255,.1);color:#fff}.fc-back:focus-visible,.fc-action:focus-visible,.fc-tier-card:focus-visible,.fc-payment-option:focus-visible{outline:2px solid #d5ff60;outline-offset:2px}
        .fc-head-copy{flex:1;min-width:0}.fc-head-copy h1{margin:0;font-size:clamp(21px,3vw,30px);letter-spacing:-.04em}
        .fc-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 13px;border:1px solid rgba(198,255,0,.48);border-radius:10px;background:linear-gradient(135deg,rgba(198,255,0,.16),rgba(198,255,0,.07));color:#e1ff80;font:inherit;font-weight:800;cursor:pointer;white-space:nowrap;transition:background .18s,border-color .18s,transform .18s}
        .fc-action:hover:not(:disabled){border-color:rgba(213,255,96,.72);background:rgba(198,255,0,.18);transform:translateY(-1px)}
        .fc-action:disabled{opacity:1;border-color:rgba(213,255,96,.34);background:rgba(198,255,0,.09);color:#d5ff60;cursor:not-allowed}
        .fc-panel{min-width:0;padding:clamp(11px,1.3vw,15px);border:1px solid rgba(255,255,255,.15);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));box-shadow:0 18px 70px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)}
        .fc-panel+.fc-panel{margin-top:10px}.fc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.fc-panel-head h2{margin:0;font-size:16px;color:#f7f9f4}.fc-muted{color:rgba(255,255,255,.7);font-size:12px}
        .fc-tier-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px}.fc-tier-card{position:relative;overflow:hidden;min-width:0;padding:13px;border:1px solid color-mix(in srgb,var(--fc-accent) 25%,transparent);border-radius:15px;background:var(--fc-backdrop);color:inherit;text-align:left;cursor:pointer;transition:transform .18s,border-color .18s}
        .fc-tier-card:hover{transform:translateY(-2px);border-color:var(--fc-accent)}.fc-tier-card h3{margin:0 0 5px;font-size:16px}.fc-tier-price{font-size:19px;font-weight:850;color:var(--fc-accent)}.fc-tier-count{display:flex;justify-content:space-between;gap:8px;margin-top:12px;color:rgba(255,255,255,.68);font-size:11px}
        .fc-progress{height:5px;margin-top:8px;overflow:hidden;border-radius:20px;background:rgba(255,255,255,.1)}.fc-progress span{display:block;height:100%;background:var(--fc-accent);border-radius:20px}
        .fc-asset-row{display:flex;align-items:center;gap:11px;width:100%;min-width:0;padding:11px 12px;border:1px solid rgba(255,255,255,.085);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer}
        .fc-asset-row+.fc-asset-row{margin-top:7px}.fc-asset-row:hover{border-color:color-mix(in srgb,var(--fc-accent) 38%,transparent);background:rgba(255,255,255,.045)}
        .fc-asset-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:color-mix(in srgb,var(--fc-accent) 15%,transparent);color:var(--fc-accent)}
        .fc-asset-copy{display:grid;gap:3px;flex:1;min-width:0}.fc-asset-copy strong{font-size:13px;overflow-wrap:anywhere}.fc-asset-copy small{color:rgba(255,255,255,.52);font-size:11px}.fc-asset-balance{color:var(--fc-accent);font-size:15px;font-weight:850;font-variant-numeric:tabular-nums;text-align:right;overflow-wrap:anywhere}
        .fc-muted-icon{color:rgba(255,255,255,.38);flex-shrink:0}.fc-assets-list{display:grid;gap:7px}.fc-balance-row{cursor:default}.fc-wallet-assets{display:grid;gap:7px}.fc-empty-assets{margin:0;padding:12px;border:1px dashed rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.58);font-size:12px;overflow-wrap:anywhere}
        .fc-market-hero{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;margin-bottom:12px;border:1px solid rgba(198,255,0,.15);border-radius:14px;background:linear-gradient(125deg,rgba(198,255,0,.08),rgba(255,255,255,.015) 62%)}
        .fc-market-hero h2{margin:0;font-size:17px}.fc-market-stat{text-align:right;white-space:nowrap}.fc-market-stat strong{display:block;color:#d5ff60;font-size:22px}.fc-market-stat span{color:rgba(255,255,255,.5);font-size:10px;letter-spacing:.08em}
        .fc-supply-gallery{min-width:0}.fc-supply-toolbar,.fc-supply-pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;color:rgba(255,255,255,.62);font-size:11px}
        .fc-supply-toolbar{margin:0 2px 8px;font-variant-numeric:tabular-nums}.fc-supply-pagination{margin-top:9px}
        .fc-supply-pagination .fc-back{min-height:32px;padding:0 9px;font-size:11px}.fc-supply-pagination .fc-back:disabled{opacity:.35;cursor:not-allowed}
        .fc-supply-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));align-content:start;gap:9px;max-height:48vh;overflow:auto;padding:2px}
        .fc-preview{box-sizing:border-box;position:relative;display:flex;width:100%;min-width:0;min-height:118px;flex-direction:column;justify-content:space-between;aspect-ratio:1.58;padding:12px;overflow:hidden;border:1px solid color-mix(in srgb,var(--fc-accent) 55%,rgba(255,255,255,.24));border-radius:12px;background:var(--fc-backdrop);color:#fff;text-align:left;font:inherit}
        .fc-preview:before{content:"";position:absolute;inset:5px;pointer-events:none;border:1px solid color-mix(in srgb,var(--fc-accent) 19%,transparent);border-radius:8px}
        .fc-preview.available{cursor:pointer}.fc-preview.available:hover,.fc-preview.selected{border-color:var(--fc-accent);box-shadow:0 0 18px var(--fc-glow)}
        .fc-preview.reserved,.fc-preview.owned{opacity:.58}        .fc-preview.pending{opacity:.88}.fc-preview-brand{position:relative;font-size:8px;font-weight:850;letter-spacing:.14em;color:var(--fc-accent)}
        .fc-preview-gem{position:absolute;right:13px;top:31%;color:var(--fc-accent);filter:drop-shadow(0 0 8px var(--fc-glow))}
        .fc-preview-tier{position:relative;margin-top:auto;font-size:14px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
        .fc-preview-serial{position:relative;margin-top:3px;font:700 10px ui-monospace,monospace;color:rgba(255,255,255,.76)}
        .fc-preview-status{position:absolute;right:11px;bottom:13px;font-size:7px;font-weight:900;letter-spacing:.12em;color:var(--fc-accent)}
        .fc-buy-controls{align-self:start;display:grid;gap:8px;min-width:0;padding:12px;border:1px solid rgba(255,255,255,.17);border-radius:13px;background:linear-gradient(145deg,rgba(15,18,14,.94),rgba(10,11,10,.94))}
        .fc-buy-open{width:100%;margin-top:12px}
        .fc-buy-backdrop{position:fixed;inset:0;z-index:110000;display:grid;place-items:center;overflow-y:auto;padding:16px;background:rgba(3,5,4,.78);backdrop-filter:blur(8px)}
        .fc-buy-dialog{width:min(100%,480px);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;border:1px solid rgba(198,255,0,.24);border-radius:16px;background:#0b0d0b;box-shadow:0 24px 80px rgba(0,0,0,.72)}
        .fc-buy-dialog:focus{outline:none}
        .fc-buy-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px}.fc-buy-title>div{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:1;min-width:0}.fc-buy-title span{padding:4px 8px;border:1px solid rgba(244,199,103,.28);border-radius:7px;background:rgba(244,199,103,.07);color:#f7d985;font-size:12px;font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap}
        .fc-buy-close{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.05);color:#e5e7eb;cursor:pointer}
        .fc-buy-close:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.1)}
        .fc-buy-close:focus-visible{outline:2px solid #d5ff60;outline-offset:2px}
        .fc-buy-controls label{display:grid;gap:5px;color:rgba(255,255,255,.8);font-size:12px;font-weight:750}
        .fc-buy-controls input,.fc-buy-controls select,.fc-transfer-form input{width:100%;min-height:40px;padding:0 11px;border:1px solid rgba(255,255,255,.2);border-radius:9px;background:#0b0c0e;color:#f5f7f1;font:inherit}
        .fc-buy-controls input:focus,.fc-buy-controls select:focus,.fc-transfer-form input:focus{outline:2px solid rgba(213,255,96,.7);outline-offset:1px;border-color:#d5ff60}
        .fc-payment-methods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .fc-payment-option{position:relative;display:grid;align-content:space-between;gap:8px;min-width:0;min-height:92px;padding:9px 10px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018) 70%),#080a08;color:rgba(255,255,255,.86);text-align:left;cursor:pointer;font:inherit;transition:transform .18s,border-color .18s,background .18s,box-shadow .18s}
        .fc-payment-option:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.34);background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.025) 70%),#080a08}
        .fc-payment-option.active{border-color:rgba(198,255,0,.66);background:linear-gradient(145deg,rgba(198,255,0,.13),rgba(198,255,0,.035) 72%),#080a08;color:#efffc0;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 18px rgba(198,255,0,.07)}
        .fc-payment-option.crypto.active{border-color:rgba(45,212,191,.64);background:linear-gradient(145deg,rgba(45,212,191,.14),rgba(45,212,191,.035) 72%),#080a08;color:#ccfbf1;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 18px rgba(45,212,191,.07)}
        .fc-payment-top,.fc-payment-main,.fc-payment-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .fc-payment-eyebrow{color:rgba(255,255,255,.66);font:700 8px/1.3 ui-monospace,monospace;letter-spacing:.1em}
        .fc-payment-status{padding:3px 6px;border:1px solid rgba(198,255,0,.26);border-radius:999px;background:rgba(198,255,0,.07);color:#d5ff60;font:700 8px/1 ui-monospace,monospace;white-space:nowrap}
        .fc-payment-option.crypto .fc-payment-status{border-color:rgba(45,212,191,.3);background:rgba(45,212,191,.07);color:#5eead4}
        .fc-payment-main{justify-content:flex-start}.fc-payment-main>svg{flex:none;color:#bef264}.fc-payment-option.crypto .fc-payment-main>svg{color:#5eead4}
        .fc-payment-copy{display:grid;gap:2px;min-width:0}.fc-payment-copy strong{font-size:13px;color:#f7f9f4}.fc-payment-copy small{color:rgba(255,255,255,.68);font-size:10px;overflow-wrap:anywhere}
        .fc-payment-foot{justify-content:flex-start;min-height:12px;padding-top:5px;border-top:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-size:9px;font-weight:750}
        .fc-payment-option.active .fc-payment-foot{color:#d5ff60}.fc-payment-option.crypto.active .fc-payment-foot{color:#5eead4}
        .fc-buy-total{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.14);font-size:12px;color:rgba(255,255,255,.8)}
        .fc-buy-total strong{font-size:18px;color:#d5ff60}.fc-note{margin:0;color:rgba(255,255,255,.66);font-size:10px;line-height:1.35;overflow-wrap:anywhere}
        .fc-status{margin:0 0 12px;padding:11px 13px;border:1px solid rgba(198,255,0,.2);border-radius:10px;background:rgba(198,255,0,.055);color:#d5ff60;font-size:12px}
        .fc-error{margin:0 0 12px;padding:11px 13px;border:1px solid rgba(248,113,113,.24);border-radius:10px;background:rgba(248,113,113,.06);color:#fca5a5;font-size:12px}
        .fc-owned-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px}
        .fc-owned-card{position:relative;overflow:hidden;cursor:pointer}
        .fc-card-detail{max-width:740px;margin:0 auto}.fc-detail-preview{max-width:520px;margin:0 auto 18px}
        .fc-detail-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));gap:8px}
        .fc-detail-item{min-width:0;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.02)}
        .fc-detail-item small{display:block;color:rgba(255,255,255,.4);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.fc-detail-item strong{display:block;margin-top:6px;font-size:13px;overflow-wrap:anywhere}
        .fc-transfer-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:12px}.fc-inline-error{padding:10px;color:#fca5a5;font-size:12px}.fc-asset-loading{height:56px;border-radius:12px;background:rgba(255,255,255,.035);animation:fc-pulse 1.4s infinite}
        .fc-spin{animation:fc-spin .9s linear infinite}@keyframes fc-spin{to{transform:rotate(360deg)}}
        @keyframes fc-pulse{50%{opacity:.45}}@container (max-width:680px){.fc-top{flex-wrap:wrap}.fc-head-copy{flex:1 1 160px}.fc-top>.fc-action{margin-left:auto}.fc-supply-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-height:36vh}.fc-market-hero{align-items:flex-start}.fc-transfer-form{grid-template-columns:minmax(0,1fr)}}
        @media(max-width:520px){.fc-buy-backdrop{align-items:end;padding:10px}.fc-buy-dialog{max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);border-radius:16px}.fc-buy-controls{padding:11px}}
        @media(max-width:520px){.fc-market-hero{flex-direction:column}.fc-market-stat{text-align:left}}
        @media(max-width:380px){.fc-page{padding-left:9px;padding-right:9px}.fc-panel{padding:10px}.fc-payment-methods{gap:6px}.fc-payment-option{padding:8px;min-height:88px}.fc-payment-eyebrow{font-size:7px}}
      `}</style>

      <header className="fc-top">
        <button type="button" className="fc-back" onClick={goBack} aria-label="Go back">
          <ArrowLeft size={16} />{screen === "collection" ? "Wallet" : "Back"}
        </button>
        <div className="fc-head-copy">
          <h1>{headerTitle}</h1>
        </div>
        {(screen === "collection" || screen === "asset") && (
          <button type="button" className="fc-action" onClick={() => setScreen("marketplace")}>
            <WalletCards size={16} />Collections
          </button>
        )}
      </header>

      {error && !purchasePanelOpen && <div className="fc-error" role="alert">{error}</div>}
      {liveUpdateError && <div className="fc-error" role="status">{liveUpdateError}</div>}
      {notice && !purchasePanelOpen && <div className="fc-status" role="status">{notice}</div>}

      {loading ? (
        <section className="fc-panel" aria-label="Loading collection"><LoaderCircle className="fc-spin" size={20} /></section>
      ) : error && !(catalog.tiers || []).length ? (
        <section className="fc-panel">
          <div className="fc-panel-head"><h2>Collections unavailable</h2></div>
          <button type="button" className="fc-action" onClick={reload}>Try again</button>
        </section>
      ) : screen === "collection" ? (
        <>
          <section className="fc-panel">
            <div className="fc-panel-head"><h2>Balances</h2></div>
            <div className="fc-wallet-assets">
              <WalletBalanceAsset icon={Coins} label="Xeevia Token" amount={balance?.tokens} unit="XEV" accent="#a3e635" />
              <WalletBalanceAsset icon={Zap} label="Engagement Points" amount={balance?.points} unit="EP" accent="#22d3ee" />
            </div>
          </section>
          <section className="fc-panel">
            <div className="fc-panel-head"><h2>Founders Cards</h2><span className="fc-muted">{ownedCards.length.toLocaleString()} owned</span></div>
            {ownedCards.length > 0 ? (
              <div className="fc-assets-list">
                {TIER_ORDER.map((name) => {
                  const cards = ownedCards.filter((card) => card.tier === name);
                  return cards.length ? <AssetRow key={name} tier={name} cards={cards} onClick={() => { setSelectedTier(name); setScreen("asset"); }} /> : null;
                })}
              </div>
            ) : <button type="button" className="fc-action" onClick={() => setScreen("marketplace")}>Browse collections</button>}
          </section>
        </>
      ) : screen === "marketplace" ? (
        <>
          <div className="fc-market-hero">
            <div><h2>Xeevia Founders</h2></div>
            <div className="fc-market-stat"><strong>{totalSupply.toLocaleString()}</strong><span>FIXED SUPPLY</span></div>
          </div>
          <section className="fc-panel">
            <div className="fc-panel-head"><h2>Choose a series</h2>{!registryReady && <span className="fc-muted">Inventory setup pending</span>}</div>
            <TierGrid tiers={catalog.tiers || []} registryReady={registryReady} onSelect={openMarketplaceTier} />
          </section>
        </>
      ) : screen === "market-tier" ? (
        <>
          <section className="fc-panel">
            <div className="fc-panel-head">
              <div><h2>{selectedTier} · {Number(tier?.supply || 0).toLocaleString()}</h2><span className="fc-muted">Next: {!registryReady ? "Pending" : firstAvailable?.serial_display || "Sold out"}</span></div>
              <span className="fc-muted">{registryReady ? `${Number(tier?.available || 0).toLocaleString()} available` : "Preview only"}</span>
            </div>
            <div className="fc-supply-gallery">
              <div className="fc-supply-toolbar">
                <span>{registryReady ? "Serials" : "Serial preview"}</span>
                <span>{supplyCards.length ? `${supplyPage * SUPPLY_PAGE_SIZE + 1}–${Math.min((supplyPage + 1) * SUPPLY_PAGE_SIZE, supplyCards.length)} / ${supplyCards.length.toLocaleString()}` : "No cards"}</span>
              </div>
              <div className="fc-supply-grid" aria-label={`${selectedTier} card supply`}>
              {visibleSupplyCards.map((card) => (
                <FoundersCardPreview key={`${card.tier}-${card.serial}`} tier={card.tier} serialDisplay={card.serial_display} status={card.status} />
              ))}
              </div>
              {supplyPageCount > 1 && (
                <div className="fc-supply-pagination" aria-label="Supply pages">
                  <button type="button" className="fc-back" aria-label="Previous supply page" disabled={supplyPage === 0} onClick={() => setSupplyPage((page) => page - 1)}>
                    <ArrowLeft size={14} />Previous
                  </button>
                  <span>Page {supplyPage + 1} of {supplyPageCount}</span>
                  <button type="button" className="fc-back" aria-label="Next supply page" disabled={supplyPage + 1 >= supplyPageCount} onClick={() => setSupplyPage((page) => page + 1)}>
                    Next<ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <button
              ref={buyButtonRef}
              type="button"
              className="fc-action fc-buy-open"
              aria-haspopup="dialog"
              aria-expanded={purchasePanelOpen}
              aria-label={`Open purchase options for ${selectedTier} card`}
              onClick={() => { setError(""); setPurchasePanelOpen(true); }}
            >
              <WalletCards size={16} />Buy this card
            </button>
          </section>
          {purchasePanelOpen && createPortal(
            <div
              className="fc-buy-backdrop"
              onClick={(event) => {
                if (event.target === event.currentTarget) setPurchasePanelOpen(false);
              }}
            >
              <section
                ref={buyDialogRef}
                className="fc-buy-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="fc-buy-dialog-title"
                tabIndex={-1}
              >
                <div className="fc-buy-controls">
                  <div className="fc-buy-title">
                    <div><strong id="fc-buy-dialog-title">{selectedTier} Founders Card</strong><span>{formatPrice(tier)}</span></div>
                    <button type="button" className="fc-buy-close" aria-label="Close purchase options" onClick={() => setPurchasePanelOpen(false)}>
                      <X size={17} />
                    </button>
                  </div>
                  {error && <div className="fc-error" role="alert">{error}</div>}
                  {notice && <div className="fc-status" role="status">{notice}</div>}
                  <label>Quantity
                    <input type="number" min="1" max={Math.max(1, Math.min(Number(tier?.max_per_user || 1), Number(tier?.available || 0)))} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
                  </label>
                  <div className="fc-payment-methods" role="radiogroup" aria-label="Payment method">
                    <button type="button" role="radio" aria-label="Fiat, local currency, Paystack in NGN" aria-checked={provider === "paystack"} className={`fc-payment-option${provider === "paystack" ? " active" : ""}`} onClick={() => setProvider("paystack")}>
                      <span className="fc-payment-top"><span className="fc-payment-eyebrow">LOCAL CURRENCY</span><span className="fc-payment-status">NGN</span></span>
                      <span className="fc-payment-main"><CreditCard size={18} /><span className="fc-payment-copy"><strong>Fiat</strong><small>Paystack · NGN</small></span></span>
                      <span className="fc-payment-foot">{provider === "paystack" ? "Selected" : "Choose fiat"}</span>
                    </button>
                    <button type="button" role="radio" aria-label="Crypto, on-chain, USDC on EVM" aria-checked={provider === "web3"} className={`fc-payment-option crypto${provider === "web3" ? " active" : ""}`} onClick={() => setProvider("web3")}>
                      <span className="fc-payment-top"><span className="fc-payment-eyebrow">CRYPTO · WEB3</span><span className="fc-payment-status">ON-CHAIN</span></span>
                      <span className="fc-payment-main"><Coins size={18} /><span className="fc-payment-copy"><strong>Crypto</strong><small>USDC · EVM</small></span></span>
                      <span className="fc-payment-foot">{provider === "web3" ? "Selected" : "Choose crypto"}</span>
                    </button>
                  </div>
                  {provider === "web3" && (
                    <label>Network
                      <select value={chain} onChange={(event) => setChain(event.target.value)}>
                        {Object.entries(CRYPTO_OPTIONS).map(([key, option]) => <option key={key} value={key}>{option.label} · {option.token}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="fc-buy-total"><span>Total · USD</span><strong>{tier?.price_currency === "USD" ? `$${(Number(tier?.list_price || 0) * quantity).toFixed(2)}` : "—"}</strong></div>
                  <button
                    type="button"
                    className="fc-action"
                    disabled={processing || !canPurchase}
                    onClick={startPurchase}
                  >
                    {processing ? <LoaderCircle size={15} className="fc-spin" /> : <WalletCards size={16} />}
                    {processing ? "Processing…" : !registryReady ? "Inventory pending" : !tier?.price_currency ? "Price not set" : !tier?.sale_enabled ? "Sales paused" : !firstAvailable ? "Sold out" : "Reserve & pay"}
                  </button>
                  {pendingCrypto && (
                    <button type="button" className="fc-back" disabled={processing} onClick={retryCryptoVerification}>
                      <ShieldCheck size={15} />Verify transaction
                    </button>
                  )}
                  <span className="fc-note">Max {tier?.max_per_user || 1} per account · issued after payment clears.</span>
                </div>
              </section>
            </div>,
            document.body,
          )}
        </>
      ) : screen === "asset" ? (
        <section className="fc-panel">
          <div className="fc-panel-head"><h2>{selectedTier} assets</h2><span className="fc-muted">{ownedInTier.length} owned</span></div>
          {ownedInTier.length ? (
            <div className="fc-owned-grid">
              {ownedInTier.map((card) => (
                <div key={card.id} className="fc-owned-card" onClick={() => { setSelectedCard(card); setScreen("detail"); }} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && (setSelectedCard(card), setScreen("detail"))}>
                  <FoundersCardPreview tier={card.tier} serialDisplay={card.serial_display} status="owned" />
                </div>
              ))}
            </div>
          ) : <p className="fc-empty-assets">You do not own a {selectedTier} card yet.</p>}
        </section>
      ) : screen === "detail" && selectedCard ? (
        <section className="fc-panel fc-card-detail">
          <div className="fc-detail-preview"><FoundersCardPreview tier={selectedCard.tier} serialDisplay={selectedCard.serial_display} status="owned" /></div>
          <div className="fc-detail-meta">
            <div className="fc-detail-item"><small>Series</small><strong>{selectedCard.tier}</strong></div>
            <div className="fc-detail-item"><small>Serial</small><strong>{selectedCard.serial_display}</strong></div>
            <div className="fc-detail-item"><small>Card code</small><strong>{selectedCard.card_code}</strong></div>
            <div className="fc-detail-item"><small>Issued</small><strong>{selectedCard.issued_at ? new Date(selectedCard.issued_at).toLocaleDateString() : "—"}</strong></div>
          </div>
          <div className="fc-status" style={{ marginTop: 14, marginBottom: 0 }}><BadgeCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Xeevia wallet ownership · no blockchain token has been minted.</div>
          {selectedCard.transfers_enabled && (
            <form className="fc-transfer-form" onSubmit={transferSelectedCard}>
              <input name="recipient" aria-label="Recipient Xeevia username" placeholder="Recipient Xeevia username" required />
              <button type="submit" className="fc-action" disabled={processing}>{processing ? "Transferring…" : "Transfer card"}</button>
            </form>
          )}
          {!selectedCard.transfers_enabled && <p className="fc-note" style={{ marginTop: 14 }}>Transfers are currently disabled for this tier.</p>}
          <p className="fc-note" style={{ marginTop: 14 }}>Card artwork is currently represented by the collection preview.</p>
        </section>
      ) : null}
    </main>
  );
}

function TierGrid({ tiers, registryReady, onSelect }) {
  return (
    <div className="fc-tier-grid">
      {TIER_ORDER.map((name) => {
        const tier = tiers.find((item) => item.tier === name);
        if (!tier) return null;
        const skin = getTierSkin(name);
        const soldPercent = registryReady && tier.supply
          ? Math.round((Number(tier.owned || 0) / Number(tier.supply)) * 100)
          : null;
        return (
          <button key={name} type="button" className="fc-tier-card" onClick={() => onSelect(name)} style={{ "--fc-accent": skin.accent, "--fc-glow": skin.glow, "--fc-backdrop": skin.backdrop }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h3>{name}</h3><span className="fc-muted">{Number(tier.supply).toLocaleString()} total</span></div>
              <Crown size={20} color={skin.accent} />
            </div>
            <div className="fc-tier-price">{formatPrice(tier)}</div>
            <div className="fc-tier-count">
              <span>{registryReady ? `${Number(tier.available || 0).toLocaleString()} available` : "Registry pending"}</span>
              <span>{registryReady ? `${soldPercent}% issued` : `${Number(tier.supply).toLocaleString()} total`}</span>
            </div>
            {registryReady && <div className="fc-progress"><span style={{ width: `${soldPercent}%` }} /></div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13, color: skin.accent, fontSize: 11, fontWeight: 800 }}>
              View full supply <ArrowRight size={14} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
