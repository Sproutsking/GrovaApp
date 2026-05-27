import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  DollarSign,
  List,
  Clock,
  Edit,
  Trash2,
  MessageSquare,
  Check,
  AlertTriangle,
  Upload,
  ArrowLeft,
  User,
  Star,
  TrendingUp,
  Shield,
  Award,
  Calendar,
  MessageSquare as SupportIcon,
  Search,
  Coins as AssetIcon,
  CreditCard as PaymentIcon,
} from "lucide-react";
import { p2pService } from "../../../services/wallet/p2pService";
import { useAuth } from "../../Auth/AuthContext";

const ASSETS = ["XEV", "USDT"];
const CURRENCIES = ["NGN", "USD", "GHS", "KES"];
const PM_TYPES = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "opay", label: "OPay" },
  { value: "palmpay", label: "PalmPay" },
  { value: "paypal", label: "PayPal" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "crypto_wallet", label: "Crypto Wallet" },
];
const STATUS_LABEL = {
  CREATED: "Created",
  ESCROW_LOCKED: "Escrow Locked",
  PAYMENT_PENDING: "Awaiting Payment",
  PAYMENT_SENT: "Payment Sent",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  EXPIRED: "Expired",
};
const STATUS_COLOR = {
  CREATED: "#60a5fa",
  ESCROW_LOCKED: "#a3e635",
  PAYMENT_PENDING: "#fbbf24",
  PAYMENT_SENT: "#34d399",
  COMPLETED: "#22c55e",
  CANCELLED: "#6b7280",
  DISPUTED: "#f87171",
  EXPIRED: "#4b5563",
};

function initials(n) {
  return (
    (n || "")
      .split(" ")
      .slice(0, 2)
      .map((w) => (w[0] || "").toUpperCase())
      .join("") || "?"
  );
}

function useCountdown(expiresAt) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt) - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      setLabel(
        Math.floor(ms / 60000) +
          ":" +
          ("" + Math.floor((ms % 60000) / 1000)).padStart(2, "0"),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

/* =============================================
   PROFILE MODAL — identical to original
   ============================================= */
const ProfileModal = ({ profile, name, onClose }) => (
  <div className="profile-modal-overlay" onClick={onClose}>
    <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
      <button className="profile-modal-close" onClick={onClose}>
        <ArrowLeft size={18} />
      </button>
      <div className="profile-modal-header">
        <div className="profile-avatar-large">{initials(name)}</div>
        <div className="profile-modal-info">
          <div className="profile-name-badge">
            <h3>{name}</h3>
            {profile.verified && (
              <Shield size={15} className="verified-badge" />
            )}
          </div>
          <div className="profile-stats-row">
            <div className="profile-stat">
              <Star size={13} fill="#fbbf24" stroke="#fbbf24" />
              <span>{profile.rating ?? profile.trust_score ?? 99}%</span>
            </div>
            <div className="profile-stat">
              <TrendingUp size={13} />
              <span>
                {profile.trades ?? profile.completed_trades ?? 0} trades
              </span>
            </div>
            <div className="profile-stat">
              <Award size={13} />
              <span>{profile.completion ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="profile-modal-details">
        <div className="profile-detail-item">
          <Calendar size={14} />
          <span>Joined {profile.joined ?? "—"}</span>
        </div>
        <div className="profile-detail-item">
          <Clock size={14} />
          <span>{profile.responseTime ?? "—"}</span>
        </div>
      </div>
      <div className="profile-modal-bio">
        <h4>About</h4>
        <p>{profile.bio ?? "No bio provided."}</p>
      </div>
      <div className="profile-modal-extended">
        <div className="profile-info-card">
          <h4>Total Volume</h4>
          <p>{profile.totalVolume ?? `${profile.volume_xev ?? 0} XEV`}</p>
        </div>
        <div className="profile-info-card">
          <h4>Payment</h4>
          <p>{profile.preferredPayment ?? "Various"}</p>
        </div>
        <div className="profile-info-card">
          <h4>Hours</h4>
          <p>{profile.tradingHours ?? "Flexible"}</p>
        </div>
        <div className="profile-info-card">
          <h4>Languages</h4>
          <p>{profile.languages ?? "English"}</p>
        </div>
      </div>
    </div>
  </div>
);

/* =============================================
   ADD PAYMENT METHOD FORM
   ============================================= */
const AddPaymentMethodForm = ({ userId, onAdded }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "bank_transfer",
    label: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    wallet_address: "",
    network: "",
  });
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!form.label.trim())
      return alert("Give this method a label (e.g. GTBank Savings).");
    setSaving(true);
    try {
      await p2pService.addPaymentMethod({ ...form, user_id: userId });
      setForm({
        type: "bank_transfer",
        label: "",
        bank_name: "",
        account_name: "",
        account_number: "",
        wallet_address: "",
        network: "",
      });
      setOpen(false);
      onAdded();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };
  if (!open)
    return (
      <button
        className="btn-create-ad"
        style={{ marginTop: 8 }}
        onClick={() => setOpen(true)}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Payment
        Method
      </button>
    );
  const isFiat = ["bank_transfer", "opay", "palmpay", "mobile_money"].includes(
    form.type,
  );
  return (
    <div className="trade-section" style={{ marginTop: 8 }}>
      <h3 className="trade-section-title">Add Payment Method</h3>
      <div className="trade-form" style={{ flexDirection: "column" }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={form.type}
              onChange={(e) => f("type", e.target.value)}
            >
              {PM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Label</label>
            <input
              className="form-input"
              placeholder="e.g. GTBank Savings"
              value={form.label}
              onChange={(e) => f("label", e.target.value)}
            />
          </div>
        </div>
        {isFiat && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bank / Provider</label>
              <input
                className="form-input"
                placeholder="GTBank"
                value={form.bank_name}
                onChange={(e) => f("bank_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Name</label>
              <input
                className="form-input"
                placeholder="John Doe"
                value={form.account_name}
                onChange={(e) => f("account_name", e.target.value)}
              />
            </div>
          </div>
        )}
        {isFiat && (
          <div className="form-group">
            <label className="form-label">Account / Phone Number</label>
            <input
              className="form-input"
              placeholder="0801234567"
              value={form.account_number}
              onChange={(e) => f("account_number", e.target.value)}
            />
          </div>
        )}
        {form.type === "crypto_wallet" && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Wallet Address</label>
              <input
                className="form-input"
                value={form.wallet_address}
                onChange={(e) => f("wallet_address", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Network</label>
              <input
                className="form-input"
                placeholder="EVM / TRC20 / SOL"
                value={form.network}
                onChange={(e) => f("network", e.target.value)}
              />
            </div>
          </div>
        )}
        {form.type === "paypal" && (
          <div className="form-group">
            <label className="form-label">PayPal Email</label>
            <input
              className="form-input"
              type="email"
              value={form.account_name}
              onChange={(e) => f("account_name", e.target.value)}
            />
          </div>
        )}
        <div className="form-actions">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Method"}
          </button>
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============================================
   MAIN COMPONENT
   ============================================= */
const TradeTab = ({ setActiveTab, userId, balance }) => {
  const { profile: authProfile } = useAuth();

  // ── ui state ──────────────────────────────────────────────────────────
  const [subTab, setSubTab] = useState("buy");
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [tradeInitiated, setTradeInitiated] = useState(false);
  const [activeTrade, setActiveTrade] = useState(null);
  const [tradeAmount, setTradeAmount] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportMessage, setSupportMessage] = useState("");
  const [assetFilterOpen, setAssetFilterOpen] = useState(false);
  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [amountFilterOpen, setAmountFilterOpen] = useState(false);
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  // ── live data ──────────────────────────────────────────────────────────
  const [offers, setOffers] = useState([]);
  const [yourAds, setYourAds] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  // ── create ad form ─────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({
    asset: "XEV",
    offerType: "sell",
    type: "sell",
    amount: "",
    price: "",
    currency: "NGN",
    method: "bank_transfer",
    min: "",
    max: "",
    status: "active",
    terms: "",
  });
  const [editAd, setEditAd] = useState(null);
  const [selectedPMs, setSelectedPMs] = useState([]);

  // ── user profile ───────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState({
    name: authProfile?.full_name || authProfile?.username || "Trader",
    bio: "Professional trader. Fast and reliable.",
    rating: 99,
    completion: "100%",
    trades: 0,
    joined: "Recent",
    verified: authProfile?.verified || false,
    responseTime: "< 5 min",
    avatar: initials(authProfile?.full_name || "Trader"),
    email: authProfile?.email || "",
    phone: authProfile?.phone || "",
    preferredPayment: "Bank Transfer",
    tradingHours: "9 AM - 10 PM",
    languages: "English",
    totalVolume: "0 XEV",
  });

  const userBalance = {
    tokens: balance?.tokens ?? 0,
    usdt: balance?.usdt ?? 0,
  };

  const assetFilterRef = useRef(null);
  const paymentFilterRef = useRef(null);
  const amountFilterRef = useRef(null);
  const chatBottomRef = useRef(null);
  const countdown = useCountdown(activeTrade?.expires_at);

  // ── load ───────────────────────────────────────────────────────────────
  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await p2pService.getOffers({
        currency: filterCurrency || undefined,
      });
      setOffers(d);
    } catch (e) {
      console.error("[TradeTab] loadOffers:", e);
    } finally {
      setLoading(false);
    }
  }, [filterCurrency]);

  const loadMyData = useCallback(async () => {
    if (!userId) return;
    try {
      const [ads, trades, pms] = await Promise.allSettled([
        p2pService.getMyOffers(userId),
        p2pService.getMyTrades(userId),
        p2pService.getMyPaymentMethods(userId),
      ]);
      if (ads.status === "fulfilled") setYourAds(ads.value);
      if (trades.status === "fulfilled") setHistory(trades.value);
      if (pms.status === "fulfilled") setPaymentMethods(pms.value);
    } catch (e) {
      console.error("[TradeTab] loadMyData:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);
  useEffect(() => {
    loadMyData();
  }, [loadMyData]);

  // ── realtime: active trade ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeTrade?.id) return;
    const unsub = p2pService.subscribeTrade(activeTrade.id, (type, payload) => {
      if (type === "trade") setActiveTrade((prev) => ({ ...prev, ...payload }));
      if (type === "message") {
        setChatMessages((prev) => {
          if (prev.find((m) => m.id === payload.id)) return prev;
          const sender =
            payload.sender_id === userId
              ? "you"
              : payload.msg_type === "system"
                ? "system"
                : "counterparty";
          return [
            ...prev,
            {
              id: payload.id,
              sender,
              text: payload.message || payload.file_name || "",
            },
          ];
        });
      }
    });
    return unsub;
  }, [activeTrade?.id, userId]);

  // ── load chat when opened ──────────────────────────────────────────────
  useEffect(() => {
    if (!chatOpen || !activeTrade?.id) return;
    p2pService
      .getMessages(activeTrade.id)
      .then((msgs) => {
        setChatMessages(
          msgs.map((m) => ({
            id: m.id,
            sender:
              m.sender_id === userId
                ? "you"
                : m.msg_type === "system"
                  ? "system"
                  : "counterparty",
            text: m.message || m.file_name || "",
            type: m.msg_type,
          })),
        );
        p2pService.markMessagesRead(activeTrade.id, userId);
      })
      .catch(() => {});
  }, [chatOpen, activeTrade?.id, userId]);

  // ── notifications subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const unsub = p2pService.subscribeNotifications(userId, () =>
      setNotifUnread((p) => p + 1),
    );
    return unsub;
  }, [userId]);

  // ── scroll chat bottom ─────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── close dropdowns on outside click ──────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (assetFilterRef.current && !assetFilterRef.current.contains(e.target))
        setAssetFilterOpen(false);
      if (
        paymentFilterRef.current &&
        !paymentFilterRef.current.contains(e.target)
      )
        setPaymentFilterOpen(false);
      if (
        amountFilterRef.current &&
        !amountFilterRef.current.contains(e.target)
      )
        setAmountFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── filtered lists ─────────────────────────────────────────────────────
  const filteredOffers = useCallback(
    (list) =>
      list.filter((o) => {
        const cm = filterCurrency ? o.currency === filterCurrency : true;
        const mm = filterMethod
          ? (o.payment_methods || []).some(
              (p) => p.type === filterMethod || p.label === filterMethod,
            )
          : true;
        const amt = o.available_amount ?? 0;
        const mn = filterMinAmount ? amt >= parseFloat(filterMinAmount) : true;
        const mx = filterMaxAmount ? amt <= parseFloat(filterMaxAmount) : true;
        return cm && mm && mn && mx;
      }),
    [filterCurrency, filterMethod, filterMinAmount, filterMaxAmount],
  );

  const filteredHistory = history.filter((t) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "completed") return t.status === "COMPLETED";
    if (historyFilter === "in-progress")
      return ["ESCROW_LOCKED", "PAYMENT_PENDING", "PAYMENT_SENT"].includes(
        t.status,
      );
    if (historyFilter === "canceled")
      return ["CANCELLED", "EXPIRED"].includes(t.status);
    return true;
  });

  // ── map DB offer to component shape ───────────────────────────────────
  const mapOffer = (o) => ({
    ...o,
    seller: o.seller?.username || o.seller?.full_name || "Trader",
    buyer: o.seller?.username || o.seller?.full_name || "Trader",
    available: Number(o.available_amount),
    wanted: Number(o.available_amount),
    price: Number(o.price_per_unit),
    min: Number(o.min_order),
    max: Number(o.max_order),
    method: (o.payment_methods || [])[0]?.label || "Bank Transfer",
    sellerDetails: {
      rating: o.reputation?.trust_score ?? 99,
      trust_score: o.reputation?.trust_score ?? 99,
      completion: `${o.reputation?.completed_trades ?? 0}/${o.reputation?.total_trades ?? 0}`,
      trades: o.reputation?.completed_trades ?? 0,
      completed_trades: o.reputation?.completed_trades ?? 0,
      joined: "Recent",
      verified: o.seller?.verified || false,
      responseTime: o.reputation?.avg_release_secs
        ? `< ${Math.ceil(o.reputation.avg_release_secs / 60)} min`
        : "< 5 min",
      bio: "Xeevia verified trader.",
      avatar: initials(o.seller?.full_name || "T"),
      volume_xev: o.reputation?.volume_xev ?? 0,
      totalVolume: `${(o.reputation?.volume_xev ?? 0).toLocaleString()} XEV`,
      preferredPayment: (o.payment_methods || [])[0]?.label || "—",
      tradingHours: "Flexible",
      languages: "English",
    },
    buyerDetails: {
      rating: 99,
      trust_score: 99,
      trades: 0,
      joined: "Recent",
      verified: false,
      responseTime: "—",
      bio: "—",
      avatar: "?",
      totalVolume: "0 XEV",
      preferredPayment: "—",
      tradingHours: "—",
      languages: "English",
    },
  });

  // ── select offer ──────────────────────────────────────────────────────
  const handleSelectOffer = (offer) => {
    setSelectedOffer(mapOffer(offer));
    setTradeAmount("");
    setChatMessages([
      {
        id: "sys0",
        sender: "system",
        text: "Trade initiated. Discuss terms with your counterparty.",
      },
    ]);
  };

  const counterpartyDetails = selectedOffer
    ? subTab === "buy"
      ? selectedOffer.sellerDetails
      : selectedOffer.buyerDetails
    : null;
  const counterpartyName = selectedOffer
    ? subTab === "buy"
      ? selectedOffer.seller
      : selectedOffer.buyer
    : "";

  // ── initiate trade ────────────────────────────────────────────────────
  const handleInitiateTrade = async () => {
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount.");
      return;
    }
    if (amount < selectedOffer.min) {
      alert(`Minimum order is ${selectedOffer.min} ${selectedOffer.asset}.`);
      return;
    }
    if (amount > selectedOffer.max) {
      alert(`Maximum order is ${selectedOffer.max} ${selectedOffer.asset}.`);
      return;
    }
    if (amount > selectedOffer.available) {
      alert("Amount exceeds what is available.");
      return;
    }
    if (subTab === "sell" && amount > userBalance.tokens) {
      alert("Insufficient XEV balance.");
      return;
    }
    const myPM = paymentMethods[0];
    if (!myPM) {
      alert("Add a payment method first in Manage → Payment Methods.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await p2pService.acceptOffer({
        offerId: selectedOffer.id,
        amount,
        paymentMethodId: myPM.id,
      });
      setActiveTrade(res.trade);
      setTradeInitiated(true);
      setChatMessages((prev) => [
        ...prev,
        {
          id: "sys1",
          sender: "system",
          text: `✅ Escrow locked. ${amount} ${selectedOffer.asset} is secured. You have 30 minutes to complete payment.`,
        },
      ]);
      await loadMyData();
    } catch (e) {
      alert("Failed to initiate trade: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── send chat ──────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage("");
    const tmpId = "tmp_" + Date.now();
    setChatMessages((prev) => [...prev, { id: tmpId, sender: "you", text }]);
    try {
      if (activeTrade?.id)
        await p2pService.sendMessage(activeTrade.id, userId, text, "text");
    } catch {
      // Still show the message locally; real-time will sync on next open
    }
  };

  // ── file upload ────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setChatMessages((prev) => [
      ...prev,
      {
        id: "up" + Date.now(),
        sender: "you",
        text: `📎 ${file.name}`,
        type: "file",
      },
    ]);
    try {
      const url = await p2pService.uploadEvidence(file);
      if (activeTrade?.id)
        await p2pService.sendMessage(
          activeTrade.id,
          userId,
          file.name,
          "file",
          url,
          file.name,
        );
    } catch (e) {
      console.error("Upload failed:", e);
    }
  };

  // ── confirm (buyer paid / seller releases) ─────────────────────────────
  const handleConfirm = async (asBuyer) => {
    if (!activeTrade?.id) {
      // Demo fallback (no real trade ID)
      setHistory((prev) => [
        {
          id: Date.now(),
          type: subTab,
          amount: parseFloat(tradeAmount),
          price: selectedOffer.price,
          currency: selectedOffer.currency,
          asset: selectedOffer.asset,
          buyer_id: userId,
          seller: { username: counterpartyName },
          buyer: { username: counterpartyName },
          status: "COMPLETED",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setChatOpen(false);
      setSelectedOffer(null);
      setTradeInitiated(false);
      setTradeAmount("");
      alert(
        `${asBuyer ? "Payment confirmed" : "Funds released"}. Trade completed!`,
      );
      return;
    }
    setActionLoading(true);
    try {
      if (asBuyer) {
        await p2pService.markPaid(activeTrade.id);
        setActiveTrade((prev) => ({ ...prev, status: "PAYMENT_SENT" }));
        alert("Payment marked as sent. Awaiting seller confirmation.");
      } else {
        await p2pService.confirmPayment(activeTrade.id);
        alert("Payment confirmed! Funds released to buyer. Trade complete!");
        setChatOpen(false);
        setSelectedOffer(null);
        setTradeInitiated(false);
        setActiveTrade(null);
        setTradeAmount("");
        await loadMyData();
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── cancel trade ───────────────────────────────────────────────────────
  const handleCancelTrade = async () => {
    if (
      !window.confirm("Cancel this trade? Escrow will be refunded to seller.")
    )
      return;
    if (!activeTrade?.id) {
      setTradeInitiated(false);
      setSelectedOffer(null);
      setTradeAmount("");
      return;
    }
    setActionLoading(true);
    try {
      await p2pService.cancelTrade(activeTrade.id, "User cancelled");
      setTradeInitiated(false);
      setSelectedOffer(null);
      setActiveTrade(null);
      setTradeAmount("");
      await loadMyData();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── open dispute ───────────────────────────────────────────────────────
  const handleOpenDispute = async () => {
    if (!activeTrade?.id) {
      alert("No active trade to dispute.");
      return;
    }
    const reason = window.prompt("Describe the issue briefly:");
    if (!reason || !reason.trim()) return;
    setActionLoading(true);
    try {
      await p2pService.openDispute(activeTrade.id, reason.trim());
      setActiveTrade((prev) => ({ ...prev, status: "DISPUTED" }));
      setChatMessages((prev) => [
        ...prev,
        {
          id: "dsp" + Date.now(),
          sender: "system",
          text: `⚠️ Dispute opened: "${reason}". Our team will review shortly.`,
        },
      ]);
      alert("Dispute opened. A moderator will contact you.");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── create / edit ad ──────────────────────────────────────────────────
  const handleCreateOrEditAd = async () => {
    if (
      !createForm.amount ||
      !createForm.price ||
      !createForm.min ||
      !createForm.max
    ) {
      alert("Fill all required fields.");
      return;
    }
    const pmIds =
      selectedPMs.length > 0
        ? selectedPMs
        : paymentMethods.slice(0, 1).map((p) => p.id);
    setActionLoading(true);
    try {
      if (editAd) {
        await p2pService.updateOfferStatus(editAd.id, createForm.status);
        setYourAds((prev) =>
          prev.map((a) =>
            a.id === editAd.id ? { ...a, status: createForm.status } : a,
          ),
        );
      } else {
        if (pmIds.length === 0) {
          alert("Add a payment method first.");
          setActionLoading(false);
          return;
        }
        await p2pService.createOffer({
          asset: createForm.asset,
          offerType: createForm.offerType || "sell",
          totalAmount: parseFloat(createForm.amount),
          pricePerUnit: parseFloat(createForm.price),
          currency: createForm.currency,
          paymentMethodIds: pmIds,
          minOrder: parseFloat(createForm.min),
          maxOrder: parseFloat(createForm.max),
          terms: createForm.terms || null,
        });
        await loadMyData();
        await loadOffers();
      }
      setCreateForm({
        asset: "XEV",
        offerType: "sell",
        type: "sell",
        amount: "",
        price: "",
        currency: "NGN",
        method: "bank_transfer",
        min: "",
        max: "",
        status: "active",
        terms: "",
      });
      setSelectedPMs([]);
      setEditAd(null);
      setShowCreateAd(false);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAd = async (id) => {
    if (!window.confirm("Cancel this offer?")) return;
    try {
      await p2pService.updateOfferStatus(id, "cancelled");
      setYourAds((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEditAd = (ad) => {
    setEditAd(ad);
    setCreateForm({
      asset: ad.asset || "XEV",
      type: "sell",
      amount: String(ad.total_amount || ""),
      price: String(ad.price_per_unit || ""),
      currency: ad.currency || "NGN",
      method: "bank_transfer",
      min: String(ad.min_order || ""),
      max: String(ad.max_order || ""),
      status: ad.status || "active",
      terms: ad.terms || "",
    });
    setShowCreateAd(true);
  };

  const handleToggleAdStatus = async (id) => {
    const ad = yourAds.find((a) => a.id === id);
    if (!ad) return;
    const next = ad.status === "active" ? "paused" : "active";
    try {
      await p2pService.updateOfferStatus(id, next);
      setYourAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: next } : a)),
      );
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUpdateProfile = () => {
    setShowEditProfile(false);
    alert("Profile updated!");
  };

  const handleSendSupportMessage = () => {
    if (!supportMessage.trim()) return;
    setSupportMessages((prev) => [
      ...prev,
      {
        sender: "you",
        text: supportMessage,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setSupportMessage("");
    setTimeout(
      () =>
        setSupportMessages((prev) => [
          ...prev,
          {
            sender: "support",
            text: "Thank you for contacting support. A representative will assist you shortly.",
            time: new Date().toLocaleTimeString(),
          },
        ]),
      1200,
    );
  };

  // normalise history row
  const norm = (t) => ({
    id: t.id,
    type: t.buyer_id === userId ? "buy" : "sell",
    amount: Number(t.amount),
    price: Number(t.price_per_unit),
    currency: t.currency,
    asset: t.asset,
    counterparty:
      t.buyer_id === userId
        ? t.seller?.username || t.seller?.full_name || "—"
        : t.buyer?.username || t.buyer?.full_name || "—",
    status:
      t.status === "COMPLETED"
        ? "completed"
        : ["CANCELLED", "EXPIRED"].includes(t.status)
          ? "canceled"
          : "in-progress",
    date: new Date(t.created_at).toISOString().split("T")[0],
  });

  const showFilters =
    (subTab === "buy" || subTab === "sell" || subTab === "history") &&
    !selectedOffer;
  const paymentMethodsList = PM_TYPES.map((p) => p.label);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="trade-fullscreen-overlay">
      <div className="trade-container">
        {/* HEADER */}
        <div className="trade-header">
          <div className="header-left">
            <button
              className="back-btn"
              title="Back"
              onClick={() => {
                if (chatOpen) {
                  setChatOpen(false);
                  return;
                }
                if (showSupportModal) {
                  setShowSupportModal(false);
                  return;
                }
                if (tradeInitiated || selectedOffer) {
                  setTradeInitiated(false);
                  setSelectedOffer(null);
                  setActiveTrade(null);
                  setTradeAmount("");
                  return;
                }
                setActiveTab("overview");
              }}
            >
              <ArrowLeft size={18} />
            </button>
          </div>

          <div className="header-center">
            {showFilters && (
              <div className="trade-filters">
                <div className="filter-row">
                  {/* Currency filter */}
                  <div
                    className={`filter-button${filterCurrency ? " has-filter" : ""}`}
                    ref={assetFilterRef}
                    onClick={() => {
                      setAssetFilterOpen((p) => !p);
                      setPaymentFilterOpen(false);
                      setAmountFilterOpen(false);
                    }}
                    title="Filter by currency"
                  >
                    <AssetIcon size={16} />
                    {assetFilterOpen && (
                      <div className="filter-dropdown">
                        {["", ...CURRENCIES].map((c) => (
                          <div
                            key={c}
                            className={`filter-option${filterCurrency === c ? " active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterCurrency(c);
                              setAssetFilterOpen(false);
                            }}
                          >
                            {c === "" ? "All Currencies" : c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment method filter */}
                  {(subTab === "buy" || subTab === "sell") && (
                    <div
                      className={`filter-button${filterMethod ? " has-filter" : ""}`}
                      ref={paymentFilterRef}
                      onClick={() => {
                        setPaymentFilterOpen((p) => !p);
                        setAssetFilterOpen(false);
                        setAmountFilterOpen(false);
                      }}
                      title="Filter by payment"
                    >
                      <PaymentIcon size={16} />
                      {paymentFilterOpen && (
                        <div className="filter-dropdown">
                          <div
                            className={`filter-option${filterMethod === "" ? " active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterMethod("");
                              setPaymentFilterOpen(false);
                            }}
                          >
                            All Methods
                          </div>
                          {PM_TYPES.map((m) => (
                            <div
                              key={m.value}
                              className={`filter-option${filterMethod === m.value ? " active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterMethod(m.value);
                                setPaymentFilterOpen(false);
                              }}
                            >
                              {m.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount filter */}
                  {(subTab === "buy" || subTab === "sell") && (
                    <div
                      className={`filter-button${filterMinAmount || filterMaxAmount ? " has-filter" : ""}`}
                      ref={amountFilterRef}
                      onClick={() => {
                        setAmountFilterOpen((p) => !p);
                        setAssetFilterOpen(false);
                        setPaymentFilterOpen(false);
                      }}
                      title="Filter by amount"
                    >
                      <Search size={16} />
                      {amountFilterOpen && (
                        <div
                          className="filter-dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="amount-filter-row">
                            <input
                              type="number"
                              className="amount-filter-input"
                              placeholder="Min"
                              value={filterMinAmount}
                              onChange={(e) =>
                                setFilterMinAmount(e.target.value)
                              }
                            />
                            <input
                              type="number"
                              className="amount-filter-input"
                              placeholder="Max"
                              value={filterMaxAmount}
                              onChange={(e) =>
                                setFilterMaxAmount(e.target.value)
                              }
                            />
                            <button
                              className="amount-filter-button"
                              onClick={() => setAmountFilterOpen(false)}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="header-right" style={{ position: "relative" }}>
            {notifUnread > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -4,
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 15,
                  height: 15,
                  fontSize: 8,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  lineHeight: 1,
                }}
              >
                {notifUnread > 9 ? "9+" : notifUnread}
              </span>
            )}
            <button
              onClick={() => setShowSupportModal(true)}
              className="support-btn"
              title="Support"
            >
              <SupportIcon size={18} />
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="trade-quick-actions">
          {[
            { id: "buy", icon: <ShoppingCart size={16} />, label: "Buy" },
            { id: "sell", icon: <DollarSign size={16} />, label: "Sell" },
            { id: "manage", icon: <List size={16} />, label: "Manage" },
            { id: "history", icon: <Clock size={16} />, label: "History" },
          ].map((t) => (
            <button
              key={t.id}
              className={`trade-tab-btn${subTab === t.id ? " active" : ""}`}
              onClick={() => {
                setSubTab(t.id);
                setSelectedOffer(null);
                setTradeInitiated(false);
                setActiveTrade(null);
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* SCROLL AREA */}
        <div className="trade-scroll-area">
          {/* ════ LIST VIEWS (no offer selected) ════ */}
          {!selectedOffer && !tradeInitiated && (
            <div className="trade-content">
              {/* ── BUY TAB ── */}
              {subTab === "buy" && (
                <div className="trade-section">
                  <div className="trade-offers-list">
                    {loading ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "48px 0",
                          color: "#333",
                          fontFamily: "'Syne',sans-serif",
                          fontSize: 12,
                        }}
                      >
                        Loading offers…
                      </div>
                    ) : filteredOffers(offers).length > 0 ? (
                      filteredOffers(offers).map((offer) => (
                        <div key={offer.id} className="trade-offer-card">
                          <div className="offer-header">
                            <div
                              className="offer-avatar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileModal({
                                  profile: {
                                    ...offer.reputation,
                                    verified: offer.seller?.verified,
                                    bio: "Xeevia verified trader.",
                                    joined: "Recent",
                                    responseTime: offer.reputation
                                      ?.avg_release_secs
                                      ? `< ${Math.ceil(offer.reputation.avg_release_secs / 60)} min`
                                      : "< 5 min",
                                  },
                                  name:
                                    offer.seller?.username ||
                                    offer.seller?.full_name ||
                                    "Trader",
                                });
                              }}
                            >
                              {initials(
                                offer.seller?.full_name ||
                                  offer.seller?.username ||
                                  "T",
                              )}
                            </div>
                            <div className="offer-user-info">
                              <div className="offer-user-name">
                                {offer.seller?.username ||
                                  offer.seller?.full_name ||
                                  "Trader"}
                                {offer.seller?.verified && (
                                  <Shield
                                    size={13}
                                    className="verified-badge"
                                  />
                                )}
                                <span className="status-indicator active" />
                              </div>
                              <div className="offer-user-stats">
                                <div className="offer-stat">
                                  <Star
                                    size={11}
                                    fill="#fbbf24"
                                    stroke="#fbbf24"
                                  />
                                  {offer.reputation?.trust_score ?? 99}%
                                </div>
                                <div className="offer-stat">
                                  {offer.reputation?.completed_trades ?? 0}{" "}
                                  trades
                                </div>
                                <div className="offer-stat">
                                  <Clock size={11} />
                                  {offer.reputation?.avg_release_secs
                                    ? `< ${Math.ceil(offer.reputation.avg_release_secs / 60)} min`
                                    : "< 5 min"}
                                </div>
                              </div>
                            </div>
                            <div className="offer-price-section">
                              <div className="offer-price">
                                {Number(offer.price_per_unit).toLocaleString()}{" "}
                                {offer.currency}
                              </div>
                              <div className="offer-currency">
                                per {offer.asset}
                              </div>
                            </div>
                            <button
                              className="btn-buy"
                              onClick={() => handleSelectOffer(offer)}
                            >
                              <ShoppingCart size={13} /> BUY
                            </button>
                          </div>
                          <div className="offer-body">
                            <div className="offer-details">
                              <div className="offer-detail">
                                <strong>Available</strong>
                                <span>
                                  {Number(
                                    offer.available_amount,
                                  ).toLocaleString()}{" "}
                                  {offer.asset}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Limits</strong>
                                <span>
                                  {offer.min_order}–{offer.max_order}{" "}
                                  {offer.asset}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Method</strong>
                                <span>
                                  {(offer.payment_methods || [])[0]?.label ||
                                    "—"}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Time Limit</strong>
                                <span>30 min</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <ShoppingCart size={44} className="empty-state-icon" />
                        <p>No offers match your filters</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SELL TAB ── */}
              {subTab === "sell" && (
                <div className="trade-section">
                  <h3 className="trade-section-title">
                    <DollarSign size={16} /> Available Buy Offers
                  </h3>
                  <div className="trade-offers-list">
                    {loading ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "48px 0",
                          color: "#333",
                          fontFamily: "'Syne',sans-serif",
                          fontSize: 12,
                        }}
                      >
                        Loading offers…
                      </div>
                    ) : filteredOffers(offers).length > 0 ? (
                      filteredOffers(offers).map((offer) => (
                        <div key={offer.id} className="trade-offer-card">
                          <div className="offer-header">
                            <div
                              className="offer-avatar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileModal({
                                  profile: {
                                    ...offer.reputation,
                                    verified: offer.seller?.verified,
                                    bio: "Xeevia verified trader.",
                                    joined: "Recent",
                                    responseTime: "< 5 min",
                                  },
                                  name: offer.seller?.username || "Trader",
                                });
                              }}
                            >
                              {initials(offer.seller?.full_name || "T")}
                            </div>
                            <div className="offer-user-info">
                              <div className="offer-user-name">
                                {offer.seller?.username ||
                                  offer.seller?.full_name ||
                                  "Trader"}
                                {offer.seller?.verified && (
                                  <Shield
                                    size={13}
                                    className="verified-badge"
                                  />
                                )}
                                <span className="status-indicator active" />
                              </div>
                              <div className="offer-user-stats">
                                <div className="offer-stat">
                                  <Star
                                    size={11}
                                    fill="#fbbf24"
                                    stroke="#fbbf24"
                                  />
                                  {offer.reputation?.trust_score ?? 99}%
                                </div>
                                <div className="offer-stat">
                                  {offer.reputation?.completed_trades ?? 0}{" "}
                                  trades
                                </div>
                                <div className="offer-stat">
                                  <Clock size={11} />
                                  {"< 5 min"}
                                </div>
                              </div>
                            </div>
                            <div className="offer-price-section">
                              <div className="offer-price">
                                {Number(offer.price_per_unit).toLocaleString()}{" "}
                                {offer.currency}
                              </div>
                              <div className="offer-currency">
                                per {offer.asset}
                              </div>
                            </div>
                            <button
                              className="btn-sell"
                              onClick={() => handleSelectOffer(offer)}
                            >
                              <DollarSign size={13} /> SELL
                            </button>
                          </div>
                          <div className="offer-body">
                            <div className="offer-details">
                              <div className="offer-detail">
                                <strong>Wants</strong>
                                <span>
                                  {Number(
                                    offer.available_amount,
                                  ).toLocaleString()}{" "}
                                  {offer.asset}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Limits</strong>
                                <span>
                                  {offer.min_order}–{offer.max_order}{" "}
                                  {offer.asset}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Method</strong>
                                <span>
                                  {(offer.payment_methods || [])[0]?.label ||
                                    "—"}
                                </span>
                              </div>
                              <div className="offer-detail">
                                <strong>Time Limit</strong>
                                <span>30 min</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <DollarSign size={44} className="empty-state-icon" />
                        <p>No offers match your filters</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── MANAGE TAB ── */}
              {subTab === "manage" && (
                <>
                  {/* Profile section */}
                  <div className="profile-edit-section">
                    <div className="profile-edit-header">
                      <h3 className="trade-section-title">
                        <User size={16} /> Your Trading Profile
                      </h3>
                      <button
                        className="btn-edit"
                        onClick={() => setShowEditProfile((p) => !p)}
                      >
                        {showEditProfile ? "Cancel" : "Edit Profile"}
                      </button>
                    </div>
                    {!showEditProfile ? (
                      <div className="profile-display">
                        <div className="profile-display-avatar">
                          {userProfile.avatar}
                        </div>
                        <div className="profile-display-info">
                          <h3>{userProfile.name}</h3>
                          <p className="profile-display-bio">
                            {userProfile.bio}
                          </p>
                          <div className="profile-display-stats">
                            <span>
                              <Star size={11} fill="#fbbf24" stroke="#fbbf24" />{" "}
                              {userProfile.rating}%
                            </span>
                            <span>{history.length} trades</span>
                            <span>
                              {
                                history.filter((t) => t.status === "COMPLETED")
                                  .length
                              }{" "}
                              completed
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="trade-form"
                        style={{ marginTop: 12, flexDirection: "column" }}
                      >
                        <div className="form-group">
                          <label className="form-label">Display Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={userProfile.name}
                            onChange={(e) =>
                              setUserProfile((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Bio</label>
                          <textarea
                            className="form-textarea"
                            value={userProfile.bio}
                            onChange={(e) =>
                              setUserProfile((p) => ({
                                ...p,
                                bio: e.target.value,
                              }))
                            }
                            placeholder="Tell traders about yourself..."
                          />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">
                              Preferred Payment
                            </label>
                            <select
                              className="form-select"
                              value={userProfile.preferredPayment}
                              onChange={(e) =>
                                setUserProfile((p) => ({
                                  ...p,
                                  preferredPayment: e.target.value,
                                }))
                              }
                            >
                              {PM_TYPES.map((m) => (
                                <option key={m.value} value={m.label}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Trading Hours</label>
                            <input
                              type="text"
                              className="form-input"
                              value={userProfile.tradingHours}
                              onChange={(e) =>
                                setUserProfile((p) => ({
                                  ...p,
                                  tradingHours: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Languages</label>
                          <input
                            type="text"
                            className="form-input"
                            value={userProfile.languages}
                            onChange={(e) =>
                              setUserProfile((p) => ({
                                ...p,
                                languages: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <button
                          className="btn-primary"
                          onClick={handleUpdateProfile}
                        >
                          Save Profile
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Payment methods */}
                  <div className="trade-section">
                    <h3 className="trade-section-title">
                      <PaymentIcon size={16} /> Payment Methods (
                      {paymentMethods.length})
                    </h3>
                    {paymentMethods.length === 0 && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "#444",
                          fontFamily: "'Syne',sans-serif",
                          marginBottom: 8,
                        }}
                      >
                        No payment methods yet. Add one below to start trading.
                      </p>
                    )}
                    <div className="trade-offers-list">
                      {paymentMethods.map((pm) => (
                        <div key={pm.id} className="ad-card">
                          <div className="ad-header">
                            <div
                              className="ad-type sell"
                              style={{ fontSize: 11 }}
                            >
                              {pm.label}
                            </div>
                            <div className="ad-actions">
                              <button
                                className="icon-btn delete"
                                title="Remove"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "Remove this payment method?",
                                    )
                                  )
                                    return;
                                  p2pService
                                    .deletePaymentMethod(pm.id)
                                    .then(loadMyData)
                                    .catch((e) => alert(e.message));
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="ad-details">
                            <div className="ad-detail">
                              <strong>Type</strong>
                              {PM_TYPES.find((t) => t.value === pm.type)
                                ?.label || pm.type}
                            </div>
                            {pm.bank_name && (
                              <div className="ad-detail">
                                <strong>Bank</strong>
                                {pm.bank_name}
                              </div>
                            )}
                            {pm.account_number && (
                              <div className="ad-detail">
                                <strong>Acct No.</strong>
                                {pm.account_number}
                              </div>
                            )}
                            {pm.account_name && (
                              <div className="ad-detail">
                                <strong>Acct Name</strong>
                                {pm.account_name}
                              </div>
                            )}
                            {pm.wallet_address && (
                              <div className="ad-detail">
                                <strong>Wallet</strong>
                                {pm.wallet_address.slice(0, 12) + "…"}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <AddPaymentMethodForm
                      userId={userId}
                      onAdded={loadMyData}
                    />
                  </div>

                  {/* My Ads */}
                  <div className="trade-section">
                    <h3 className="trade-section-title">
                      <List size={16} /> Your Offers ({yourAds.length})
                    </h3>
                    <div className="trade-offers-list">
                      {yourAds.map((ad) => (
                        <div key={ad.id} className="ad-card">
                          <div className="ad-header">
                            <div className="ad-type sell">
                              <DollarSign size={14} />
                              {ad.asset} OFFER
                            </div>
                            <div className="ad-actions">
                              <button
                                className={`ad-status-toggle ${ad.status === "active" ? "active" : "inactive"}`}
                                onClick={() => handleToggleAdStatus(ad.id)}
                              >
                                {ad.status === "active" ? "Active" : "Paused"}
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => handleEditAd(ad)}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                className="icon-btn delete"
                                onClick={() => handleDeleteAd(ad.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="ad-details">
                            <div className="ad-detail">
                              <strong>Price</strong>
                              {Number(ad.price_per_unit).toLocaleString()}{" "}
                              {ad.currency}/{ad.asset}
                            </div>
                            <div className="ad-detail">
                              <strong>Available</strong>
                              {Number(
                                ad.available_amount,
                              ).toLocaleString()}{" "}
                              {ad.asset}
                            </div>
                            <div className="ad-detail">
                              <strong>Limits</strong>
                              {ad.min_order}–{ad.max_order} {ad.asset}
                            </div>
                            <div className="ad-detail">
                              <strong>Trades</strong>
                              {ad.trades_count ?? 0}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!showCreateAd && !editAd && (
                    <div className="create-ad-section">
                      <button
                        className="btn-create-ad"
                        onClick={() => setShowCreateAd(true)}
                      >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>{" "}
                        Create New Offer
                      </button>
                    </div>
                  )}

                  {(showCreateAd || editAd) && (
                    <div className="trade-section">
                      <h3 className="trade-section-title">
                        {editAd ? "Edit Offer" : "Create New Offer"}
                      </h3>
                      <div
                        className="trade-form"
                        style={{ flexDirection: "column", gap: 12 }}
                      >
                        {/* Offer Type — Buy or Sell */}
                        <div
                          className="form-group"
                          style={{ flexDirection: "column", gap: 6 }}
                        >
                          <label className="form-label">Offer Type</label>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            {[
                              { v: "sell", icon: "💰", label: "Sell" },
                              { v: "buy", icon: "🛒", label: "Buy" },
                            ].map((t) => (
                              <button
                                key={t.v}
                                type="button"
                                onClick={() =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    offerType: t.v,
                                  }))
                                }
                                style={{
                                  padding: "11px 8px",
                                  borderRadius: 9,
                                  fontFamily: "'Syne',sans-serif",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: "pointer",
                                  border: "1px solid",
                                  transition: "all .18s",
                                  textAlign: "center",
                                  background:
                                    createForm.offerType === t.v
                                      ? t.v === "sell"
                                        ? "rgba(239,68,68,0.12)"
                                        : "rgba(34,197,94,0.12)"
                                      : "rgba(255,255,255,0.03)",
                                  borderColor:
                                    createForm.offerType === t.v
                                      ? t.v === "sell"
                                        ? "rgba(239,68,68,0.45)"
                                        : "rgba(34,197,94,0.45)"
                                      : "rgba(255,255,255,0.07)",
                                  color:
                                    createForm.offerType === t.v
                                      ? t.v === "sell"
                                        ? "#f87171"
                                        : "#22c55e"
                                      : "#555",
                                }}
                              >
                                {t.icon} {t.label}
                              </button>
                            ))}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#444",
                              fontFamily: "'Syne',sans-serif",
                              lineHeight: 1.6,
                              marginTop: 2,
                            }}
                          >
                            {createForm.offerType === "sell"
                              ? "Selling crypto — buyer pays you fiat, you release crypto."
                              : "Buying crypto — you pay fiat, seller releases crypto."}
                          </div>
                        </div>

                        {/* Asset + Currency */}
                        <div className="form-row">
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">Asset</label>
                            <select
                              className="form-select"
                              value={createForm.asset}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  asset: e.target.value,
                                }))
                              }
                            >
                              {ASSETS.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">Currency</label>
                            <select
                              className="form-select"
                              value={createForm.currency}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  currency: e.target.value,
                                }))
                              }
                            >
                              {CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Balance hint */}
                        <div
                          style={{
                            fontSize: 10,
                            color: "#444",
                            fontFamily: "'DM Mono',monospace",
                            marginTop: -4,
                          }}
                        >
                          Wallet:{" "}
                          <strong style={{ color: "#a3e635" }}>
                            {createForm.asset === "XEV"
                              ? Number(userBalance.tokens).toLocaleString()
                              : Number(userBalance.usdt).toLocaleString()}{" "}
                            {createForm.asset}
                          </strong>
                        </div>

                        {/* Amount + Price */}
                        <div className="form-row">
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">
                              Total Amount ({createForm.asset})
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              value={createForm.amount}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  amount: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">
                              Price per {createForm.asset} (
                              {createForm.currency})
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0.00"
                              value={createForm.price}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  price: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        {/* Min + Max */}
                        <div className="form-row">
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">
                              Min per Trade ({createForm.asset})
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              value={createForm.min}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  min: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div
                            className="form-group"
                            style={{ flexDirection: "column", gap: 5 }}
                          >
                            <label className="form-label">
                              Max per Trade ({createForm.asset})
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              value={createForm.max}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  max: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        {/* Payment Methods */}
                        <div
                          className="form-group"
                          style={{ flexDirection: "column", gap: 6 }}
                        >
                          <label className="form-label">Payment Methods</label>
                          {paymentMethods.length === 0 ? (
                            <p
                              style={{
                                fontSize: 11,
                                color: "#f87171",
                                fontFamily: "'Syne',sans-serif",
                                margin: 0,
                              }}
                            >
                              Add a payment method above first.
                            </p>
                          ) : (
                            paymentMethods.map((pm) => (
                              <label
                                key={pm.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  cursor: "pointer",
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  background: "rgba(255,255,255,0.02)",
                                  border: "1px solid rgba(255,255,255,0.05)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPMs.includes(pm.id)}
                                  onChange={(e) =>
                                    setSelectedPMs((prev) =>
                                      e.target.checked
                                        ? [...prev, pm.id]
                                        : prev.filter((x) => x !== pm.id),
                                    )
                                  }
                                />
                                <div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "#bbb",
                                      fontFamily: "'Syne',sans-serif",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {pm.label}
                                  </div>
                                  {pm.bank_name && (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: "#444",
                                        fontFamily: "'DM Mono',monospace",
                                      }}
                                    >
                                      {pm.bank_name}
                                      {pm.account_number
                                        ? ` · ${pm.account_number}`
                                        : ""}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))
                          )}
                        </div>

                        {/* Terms */}
                        <div
                          className="form-group"
                          style={{ flexDirection: "column", gap: 5 }}
                        >
                          <label className="form-label">Terms (Optional)</label>
                          <textarea
                            className="form-textarea"
                            value={createForm.terms}
                            onChange={(e) =>
                              setCreateForm((p) => ({
                                ...p,
                                terms: e.target.value,
                              }))
                            }
                            placeholder="Any specific terms for traders…"
                          />
                        </div>

                        {/* Preview */}
                        {createForm.amount && createForm.price && (
                          <div
                            style={{
                              background: "rgba(132,204,22,0.05)",
                              border: "1px solid rgba(132,204,22,0.15)",
                              borderRadius: 10,
                              padding: "10px 14px",
                              fontSize: 12,
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ color: "#555" }}>Total value</span>
                              <strong
                                style={{ color: "#a3e635", fontSize: 14 }}
                              >
                                {(
                                  Number(createForm.amount) *
                                  Number(createForm.price)
                                ).toLocaleString()}{" "}
                                {createForm.currency}
                              </strong>
                            </div>
                          </div>
                        )}

                        <div className="form-actions">
                          <button
                            className="btn-primary"
                            onClick={handleCreateOrEditAd}
                            disabled={actionLoading}
                          >
                            {actionLoading
                              ? "Processing…"
                              : editAd
                                ? "Update Offer"
                                : `Create ${(createForm.offerType || "sell").charAt(0).toUpperCase() + (createForm.offerType || "sell").slice(1)} Offer`}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setEditAd(null);
                              setShowCreateAd(false);
                              setCreateForm({
                                asset: "XEV",
                                offerType: "sell",
                                type: "sell",
                                amount: "",
                                price: "",
                                currency: "NGN",
                                method: "bank_transfer",
                                min: "",
                                max: "",
                                status: "active",
                                terms: "",
                              });
                              setSelectedPMs([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── HISTORY TAB ── */}
              {subTab === "history" && (
                <div className="trade-section">
                  <h3 className="trade-section-title">
                    <Clock size={16} /> Trade History
                  </h3>
                  <div className="history-filter-buttons">
                    {["all", "completed", "in-progress", "canceled"].map(
                      (f) => (
                        <button
                          key={f}
                          className={`history-filter-btn${historyFilter === f ? " active" : ""}`}
                          onClick={() => setHistoryFilter(f)}
                        >
                          {f === "all"
                            ? "All"
                            : f === "in-progress"
                              ? "In Progress"
                              : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="trade-offers-list">
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((trade) => {
                        const n = norm(trade);
                        return (
                          <div
                            key={n.id}
                            className="history-card"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setActiveTrade(trade);
                              setTradeInitiated(true);
                              setSelectedOffer(
                                mapOffer({
                                  ...trade,
                                  seller: trade.seller,
                                  reputation: {},
                                  payment_methods: [
                                    trade.payment_method,
                                  ].filter(Boolean),
                                }),
                              );
                            }}
                          >
                            <div className="history-header">
                              <div className={`history-type ${n.type}`}>
                                {n.type === "buy" ? (
                                  <ShoppingCart size={15} />
                                ) : (
                                  <DollarSign size={15} />
                                )}
                                {n.type.toUpperCase()}{" "}
                                {n.amount.toLocaleString()} {n.asset}
                              </div>
                              <div className={`history-status ${n.status}`}>
                                {n.status === "in-progress"
                                  ? "In Progress"
                                  : n.status.charAt(0).toUpperCase() +
                                    n.status.slice(1)}
                              </div>
                            </div>
                            <div className="history-details">
                              <strong>Price:</strong> {n.price.toLocaleString()}{" "}
                              {n.currency}/{n.asset} &nbsp;|&nbsp;
                              <strong>Total:</strong>{" "}
                              {(n.amount * n.price).toLocaleString()}{" "}
                              {n.currency}
                              <br />
                              <strong>With:</strong> {n.counterparty}{" "}
                              &nbsp;|&nbsp; <strong>Date:</strong> {n.date}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty-state">
                        <Clock size={44} className="empty-state-icon" />
                        <p>No trades found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ INITIATE TRADE VIEW ════ */}
          {selectedOffer && !tradeInitiated && (
            <div className="trade-summary-interface">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <button
                  className="back-btn"
                  onClick={() => setSelectedOffer(null)}
                >
                  <ArrowLeft size={18} />
                </button>
                <div style={{ flex: 1 }}>
                  <div className="view-title">Initiate Trade</div>
                  <div className="view-subtitle">Review and start trading</div>
                </div>
                <button className="back-btn" onClick={() => setChatOpen(true)}>
                  <MessageSquare size={18} />
                </button>
              </div>

              {/* Counterparty card */}
              <div
                className="summary-card"
                onClick={() =>
                  setShowProfileModal({
                    profile: counterpartyDetails,
                    name: counterpartyName,
                  })
                }
                style={{ cursor: "pointer" }}
              >
                <div className="offer-header" style={{ padding: 0 }}>
                  <div
                    className="offer-avatar"
                    style={{ pointerEvents: "none" }}
                  >
                    {counterpartyDetails?.avatar || initials(counterpartyName)}
                  </div>
                  <div className="offer-user-info">
                    <div className="offer-user-name">
                      {counterpartyName}
                      {counterpartyDetails?.verified && (
                        <Shield size={13} className="verified-badge" />
                      )}
                    </div>
                    <div className="offer-user-stats">
                      <div className="offer-stat">
                        <Star size={11} fill="#fbbf24" stroke="#fbbf24" />
                        {counterpartyDetails?.rating ?? 99}%
                      </div>
                      <div className="offer-stat">
                        {counterpartyDetails?.trades ?? 0} trades
                      </div>
                      <div className="offer-stat">
                        <Clock size={11} />
                        {counterpartyDetails?.responseTime ?? "< 5 min"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#555",
                      fontFamily: "JetBrains Mono,monospace",
                    }}
                  >
                    Tap to view →
                  </div>
                </div>
              </div>

              {/* Trade details */}
              <div className="summary-card">
                <div className="summary-title">Trade Details</div>
                <div className="summary-details">
                  <div className="summary-detail">
                    <span className="summary-detail-label">Type</span>
                    <span
                      className="summary-detail-value"
                      style={{
                        color: subTab === "buy" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {subTab.toUpperCase()}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Asset</span>
                    <span className="summary-detail-value">
                      {selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">
                      Price per {selectedOffer.asset}
                    </span>
                    <span className="summary-detail-value">
                      {selectedOffer.price.toLocaleString()}{" "}
                      {selectedOffer.currency}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">
                      {subTab === "buy" ? "Available" : "Wanted"}
                    </span>
                    <span className="summary-detail-value">
                      {selectedOffer.available.toLocaleString()}{" "}
                      {selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Trade Limits</span>
                    <span className="summary-detail-value">
                      {selectedOffer.min} – {selectedOffer.max}{" "}
                      {selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Payment Method</span>
                    <span className="summary-detail-value">
                      {selectedOffer.method}
                    </span>
                  </div>
                  {selectedOffer.terms && (
                    <div
                      style={{
                        paddingTop: 8,
                        borderTop: "1px solid #1e1e1e",
                        marginTop: 4,
                      }}
                    >
                      <div
                        className="summary-detail-label"
                        style={{ marginBottom: 6 }}
                      >
                        Terms
                      </div>
                      <div
                        style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}
                      >
                        {selectedOffer.terms}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment method warning */}
              {paymentMethods.length === 0 && (
                <div
                  style={{
                    background: "rgba(248,113,113,0.07)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 12,
                    color: "#f87171",
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  ⚠️ You need a payment method to trade. Go to the{" "}
                  <strong>Manage</strong> tab and add one.
                </div>
              )}
              {paymentMethods.length > 0 && (
                <div className="summary-card">
                  <div className="summary-title">Your Payment Method</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#aaa",
                      fontFamily: "'Syne',sans-serif",
                    }}
                  >
                    {paymentMethods[0].label}
                    {paymentMethods[0].bank_name &&
                      ` — ${paymentMethods[0].bank_name}`}
                    {paymentMethods[0].account_number &&
                      ` · ${paymentMethods[0].account_number}`}
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div className="amount-input-group">
                <label className="amount-label">
                  Enter Amount ({selectedOffer.asset})
                </label>
                <input
                  type="number"
                  className="amount-input"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder={`${selectedOffer.min} – ${selectedOffer.max}`}
                />
                {tradeAmount && !isNaN(parseFloat(tradeAmount)) && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 15,
                      }}
                    >
                      <span
                        style={{
                          color: "#666",
                          fontFamily: "JetBrains Mono,monospace",
                          fontSize: 12,
                        }}
                      >
                        Total Cost
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          color: "#84cc16",
                          fontFamily: "JetBrains Mono,monospace",
                        }}
                      >
                        {(
                          parseFloat(tradeAmount) * selectedOffer.price
                        ).toLocaleString()}{" "}
                        {selectedOffer.currency}
                      </span>
                    </div>
                    {subTab === "sell" && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <span
                          style={{
                            color: "#444",
                            fontFamily: "JetBrains Mono,monospace",
                          }}
                        >
                          Your Balance
                        </span>
                        <span
                          style={{
                            color: "#666",
                            fontFamily: "JetBrains Mono,monospace",
                          }}
                        >
                          {Number(userBalance.tokens).toLocaleString()} XEV
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className={subTab === "buy" ? "btn-buy" : "btn-sell"}
                onClick={handleInitiateTrade}
                disabled={
                  !tradeAmount ||
                  isNaN(parseFloat(tradeAmount)) ||
                  actionLoading ||
                  paymentMethods.length === 0
                }
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 15,
                  opacity: tradeAmount && paymentMethods.length > 0 ? 1 : 0.4,
                }}
              >
                {actionLoading ? (
                  "Locking escrow…"
                ) : subTab === "buy" ? (
                  <>
                    <ShoppingCart size={16} /> Initiate Buy
                  </>
                ) : (
                  <>
                    <DollarSign size={16} /> Initiate Sell
                  </>
                )}
              </button>
            </div>
          )}

          {/* ════ TRADE IN PROGRESS ════ */}
          {tradeInitiated && selectedOffer && (
            <div className="trade-summary-interface">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <button
                  className="back-btn"
                  onClick={() => {
                    setTradeInitiated(false);
                    setSelectedOffer(null);
                    setActiveTrade(null);
                    setTradeAmount("");
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div style={{ flex: 1 }}>
                  <div className="view-title">Ongoing Trade</div>
                  <div className="view-subtitle">
                    Complete the transaction
                    {countdown && activeTrade && (
                      <span
                        style={{
                          color: "#fbbf24",
                          marginLeft: 8,
                          fontFamily: "JetBrains Mono,monospace",
                          fontSize: 11,
                        }}
                      >
                        ⏱ {countdown}
                      </span>
                    )}
                  </div>
                </div>
                <button className="back-btn" onClick={() => setChatOpen(true)}>
                  <MessageSquare size={18} />
                </button>
              </div>

              <div
                className="summary-card"
                style={{
                  background: "rgba(132,204,22,0.05)",
                  borderColor: "rgba(132,204,22,0.2)",
                }}
              >
                <div className="summary-title" style={{ color: "#84cc16" }}>
                  {activeTrade
                    ? `🔄 ${STATUS_LABEL[activeTrade.status] ?? "Trade In Progress"}`
                    : "🔄 Trade In Progress"}
                </div>
                <div className="summary-details">
                  <div className="summary-detail">
                    <span className="summary-detail-label">Trading with</span>
                    <span className="summary-detail-value">
                      {counterpartyName}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Asset</span>
                    <span className="summary-detail-value">
                      {selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Amount</span>
                    <span className="summary-detail-value">
                      {tradeAmount} {selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Price</span>
                    <span className="summary-detail-value">
                      {selectedOffer.price.toLocaleString()}{" "}
                      {selectedOffer.currency}/{selectedOffer.asset}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Total</span>
                    <span
                      className="summary-detail-value"
                      style={{
                        fontSize: 18,
                        color: "#84cc16",
                        fontFamily: "JetBrains Mono,monospace",
                      }}
                    >
                      {(
                        parseFloat(tradeAmount) * selectedOffer.price
                      ).toLocaleString()}{" "}
                      {selectedOffer.currency}
                    </span>
                  </div>
                  <div className="summary-detail">
                    <span className="summary-detail-label">Method</span>
                    <span className="summary-detail-value">
                      {selectedOffer.method}
                    </span>
                  </div>
                  {activeTrade && (
                    <div className="summary-detail">
                      <span className="summary-detail-label">Status</span>
                      <span
                        className="summary-detail-value"
                        style={{
                          color: STATUS_COLOR[activeTrade.status] ?? "#aaa",
                        }}
                      >
                        {STATUS_LABEL[activeTrade.status] ?? activeTrade.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-title">
                  {subTab === "buy"
                    ? "Buyer Instructions"
                    : "Seller Instructions"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#ccc",
                    lineHeight: 1.8,
                    fontFamily: "Syne,sans-serif",
                  }}
                >
                  {subTab === "buy" ? (
                    <>
                      <p style={{ marginBottom: 10 }}>
                        1. Send{" "}
                        <strong style={{ color: "#84cc16" }}>
                          {(
                            parseFloat(tradeAmount) * selectedOffer.price
                          ).toLocaleString()}{" "}
                          {selectedOffer.currency}
                        </strong>{" "}
                        via <strong>{selectedOffer.method}</strong>
                      </p>
                      <p style={{ marginBottom: 10 }}>
                        2. Get seller's payment details from the chat
                      </p>
                      <p style={{ marginBottom: 10 }}>
                        3. After sending, click "Confirm Payment Sent"
                      </p>
                      <p
                        style={{
                          color: "#555",
                          fontSize: 12,
                          fontFamily: "JetBrains Mono,monospace",
                        }}
                      >
                        ⚠ Seller releases {selectedOffer.asset} after payment
                        confirmed
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ marginBottom: 10 }}>
                        1. Share your payment details in chat
                      </p>
                      <p style={{ marginBottom: 10 }}>
                        2. Wait for buyer to send{" "}
                        <strong style={{ color: "#84cc16" }}>
                          {(
                            parseFloat(tradeAmount) * selectedOffer.price
                          ).toLocaleString()}{" "}
                          {selectedOffer.currency}
                        </strong>
                      </p>
                      <p style={{ marginBottom: 10 }}>
                        3. Confirm payment received in your account
                      </p>
                      <p style={{ marginBottom: 10 }}>
                        4. Click "Confirm Received &amp; Release"
                      </p>
                      <p
                        style={{
                          color: "#555",
                          fontSize: 12,
                          fontFamily: "JetBrains Mono,monospace",
                        }}
                      >
                        ⚠ Never release before verifying payment
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {subTab === "buy" ? (
                  <button
                    className="btn-buy"
                    onClick={() => handleConfirm(true)}
                    disabled={actionLoading}
                    style={{ width: "100%", padding: 14, fontSize: 14 }}
                  >
                    {actionLoading ? (
                      "Processing…"
                    ) : (
                      <>
                        <Check size={16} /> Confirm Payment Sent
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleConfirm(false)}
                    disabled={actionLoading}
                    style={{ width: "100%" }}
                  >
                    {actionLoading ? (
                      "Processing…"
                    ) : (
                      <>
                        <Check size={16} /> Confirm Received &amp; Release
                      </>
                    )}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    borderColor: "rgba(239,68,68,0.2)",
                    color: "#ef4444",
                  }}
                  onClick={handleOpenDispute}
                  disabled={actionLoading}
                >
                  <AlertTriangle size={16} /> Open Dispute
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleCancelTrade}
                  disabled={actionLoading}
                >
                  Cancel Trade
                </button>
              </div>
            </div>
          )}
        </div>
        {/* end trade-scroll-area */}

        {/* CHAT MODAL */}
        {chatOpen && (
          <div className="trade-chat-modal">
            <div className="chat-header">
              <button className="back-btn" onClick={() => setChatOpen(false)}>
                <ArrowLeft size={18} />
              </button>
              <div className="chat-user-info">
                <div className="chat-user-name">
                  {counterpartyName || "Trader"}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "JetBrains Mono,monospace",
                  }}
                >
                  <span>
                    <Star size={11} fill="#fbbf24" stroke="#fbbf24" />{" "}
                    {counterpartyDetails?.rating ?? 99}%
                  </span>
                  <span>{counterpartyDetails?.trades ?? 0} trades</span>
                </div>
              </div>
            </div>
            <div className="chat-messages-container">
              {chatMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`chat-message ${msg.sender}`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div className="chat-input-container">
              <label className="chat-upload-btn">
                <Upload size={16} />
                <input
                  type="file"
                  onChange={handleUpload}
                  hidden
                  accept="image/*,.pdf"
                />
              </label>
              <input
                type="text"
                className="chat-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
              />
              <button className="chat-send-btn" onClick={handleSendMessage}>
                Send
              </button>
            </div>
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfileModal && (
          <ProfileModal
            profile={showProfileModal.profile}
            name={showProfileModal.name}
            onClose={() => setShowProfileModal(null)}
          />
        )}

        {/* SUPPORT MODAL */}
        {showSupportModal && (
          <div className="support-modal">
            <div className="support-header">
              <button
                className="back-btn"
                onClick={() => setShowSupportModal(false)}
              >
                <ArrowLeft size={18} />
              </button>
              <div className="support-title">
                <h3>Support Chat</h3>
                <p>Talk to our support team</p>
              </div>
            </div>
            <div className="support-messages-container">
              {supportMessages.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "#333",
                    marginTop: 60,
                    fontFamily: "Syne,sans-serif",
                    fontSize: 14,
                  }}
                >
                  Start a conversation with support
                </div>
              ) : (
                supportMessages.map((msg, idx) => (
                  <div key={idx} className={`support-message ${msg.sender}`}>
                    {msg.text}
                    <div className="support-message-time">{msg.time}</div>
                  </div>
                ))
              )}
            </div>
            <div className="support-input-container">
              <input
                type="text"
                className="support-input"
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendSupportMessage()
                }
                placeholder="Type your message..."
              />
              <button
                className="support-send-btn"
                onClick={handleSendSupportMessage}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeTab;
