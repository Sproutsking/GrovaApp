// src/components/Auth/PaymentWall.jsx
import React, { useState, useEffect } from "react";
import {
  Lock,
  CreditCard,
  Coins,
  Check,
  Shield,
  Loader2,
  Sparkles,
  ArrowLeft,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import authService from "../../services/auth/authService";
import { supabase } from "../../services/config/supabase";

async function checkAdminBypass(user) {
  if (!user?.id) return false;
  return !!(await authService.checkAdminStatus(user.id));
}

async function activateAccount(user) {
  if (!user?.id) return false;
  const { error } = await supabase
    .from("profiles")
    .update({ payment_status: "free", account_activated: true })
    .eq("id", user.id);
  return !error;
}

const COUNTRIES = [
  {
    code: "DZ",
    name: "🇩🇿 Algeria",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "AO",
    name: "🇦🇴 Angola",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "BJ",
    name: "🇧🇯 Benin",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "BW",
    name: "🇧🇼 Botswana",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "BF",
    name: "🇧🇫 Burkina Faso",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "CM",
    name: "🇨🇲 Cameroon",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "CI",
    name: "🇨🇮 Côte d'Ivoire",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "EG",
    name: "🇪🇬 Egypt",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "ET",
    name: "🇪🇹 Ethiopia",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "GH",
    name: "🇬🇭 Ghana",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "KE",
    name: "🇰🇪 Kenya",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "LR",
    name: "🇱🇷 Liberia",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "MA",
    name: "🇲🇦 Morocco",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "MZ",
    name: "🇲🇿 Mozambique",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "NA",
    name: "🇳🇦 Namibia",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "NG",
    name: "🇳🇬 Nigeria",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "RW",
    name: "🇷🇼 Rwanda",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "SN",
    name: "🇸🇳 Senegal",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "SL",
    name: "🇸🇱 Sierra Leone",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "ZA",
    name: "🇿🇦 South Africa",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "SD",
    name: "🇸🇩 Sudan",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "TZ",
    name: "🇹🇿 Tanzania",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "TN",
    name: "🇹🇳 Tunisia",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "UG",
    name: "🇺🇬 Uganda",
    region: "Africa",
    methods: ["card", "local", "crypto"],
  },
  {
    code: "ZM",
    name: "🇿🇲 Zambia",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "ZW",
    name: "🇿🇼 Zimbabwe",
    region: "Africa",
    methods: ["card", "crypto"],
  },
  {
    code: "IN",
    name: "🇮🇳 India",
    region: "Asia",
    methods: ["card", "local", "crypto"],
  },
  { code: "CN", name: "🇨🇳 China", region: "Asia", methods: ["card", "crypto"] },
  { code: "JP", name: "🇯🇵 Japan", region: "Asia", methods: ["card", "crypto"] },
  {
    code: "KR",
    name: "🇰🇷 South Korea",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "SG",
    name: "🇸🇬 Singapore",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "MY",
    name: "🇲🇾 Malaysia",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "ID",
    name: "🇮🇩 Indonesia",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "PH",
    name: "🇵🇭 Philippines",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "TH",
    name: "🇹🇭 Thailand",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "VN",
    name: "🇻🇳 Vietnam",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "PK",
    name: "🇵🇰 Pakistan",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "BD",
    name: "🇧🇩 Bangladesh",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  { code: "AE", name: "🇦🇪 UAE", region: "Asia", methods: ["card", "crypto"] },
  {
    code: "SA",
    name: "🇸🇦 Saudi Arabia",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "TR",
    name: "🇹🇷 Turkey",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "IL",
    name: "🇮🇱 Israel",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "HK",
    name: "🇭🇰 Hong Kong",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "TW",
    name: "🇹🇼 Taiwan",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "KW",
    name: "🇰🇼 Kuwait",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  { code: "QA", name: "🇶🇦 Qatar", region: "Asia", methods: ["card", "crypto"] },
  {
    code: "LB",
    name: "🇱🇧 Lebanon",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "MM",
    name: "🇲🇲 Myanmar",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  {
    code: "KH",
    name: "🇰🇭 Cambodia",
    region: "Asia",
    methods: ["card", "crypto"],
  },
  { code: "NP", name: "🇳🇵 Nepal", region: "Asia", methods: ["card", "crypto"] },
  {
    code: "GB",
    name: "🇬🇧 United Kingdom",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "DE",
    name: "🇩🇪 Germany",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "FR",
    name: "🇫🇷 France",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "IT",
    name: "🇮🇹 Italy",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "ES",
    name: "🇪🇸 Spain",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "NL",
    name: "🇳🇱 Netherlands",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "SE",
    name: "🇸🇪 Sweden",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "NO",
    name: "🇳🇴 Norway",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "CH",
    name: "🇨🇭 Switzerland",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "PL",
    name: "🇵🇱 Poland",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "UA",
    name: "🇺🇦 Ukraine",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "RU",
    name: "🇷🇺 Russia",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "PT",
    name: "🇵🇹 Portugal",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "BE",
    name: "🇧🇪 Belgium",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "AT",
    name: "🇦🇹 Austria",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "DK",
    name: "🇩🇰 Denmark",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "FI",
    name: "🇫🇮 Finland",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "GR",
    name: "🇬🇷 Greece",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "RO",
    name: "🇷🇴 Romania",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "CZ",
    name: "🇨🇿 Czech Republic",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "HU",
    name: "🇭🇺 Hungary",
    region: "Europe",
    methods: ["card", "crypto"],
  },
  {
    code: "US",
    name: "🇺🇸 United States",
    region: "North America",
    methods: ["card", "crypto"],
  },
  {
    code: "CA",
    name: "🇨🇦 Canada",
    region: "North America",
    methods: ["card", "crypto"],
  },
  {
    code: "MX",
    name: "🇲🇽 Mexico",
    region: "North America",
    methods: ["card", "crypto"],
  },
  {
    code: "JM",
    name: "🇯🇲 Jamaica",
    region: "North America",
    methods: ["card", "crypto"],
  },
  {
    code: "TT",
    name: "🇹🇹 Trinidad & Tobago",
    region: "North America",
    methods: ["card", "crypto"],
  },
  {
    code: "BR",
    name: "🇧🇷 Brazil",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "AR",
    name: "🇦🇷 Argentina",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "CO",
    name: "🇨🇴 Colombia",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "CL",
    name: "🇨🇱 Chile",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "PE",
    name: "🇵🇪 Peru",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "VE",
    name: "🇻🇪 Venezuela",
    region: "South America",
    methods: ["card", "crypto"],
  },
  {
    code: "AU",
    name: "🇦🇺 Australia",
    region: "Oceania",
    methods: ["card", "crypto"],
  },
  {
    code: "NZ",
    name: "🇳🇿 New Zealand",
    region: "Oceania",
    methods: ["card", "crypto"],
  },
  {
    code: "FJ",
    name: "🇫🇯 Fiji",
    region: "Oceania",
    methods: ["card", "crypto"],
  },
];

const PAYMENT_METHODS = [
  {
    id: "card",
    icon: CreditCard,
    title: "Pay with Card",
    subtitle: "Visa, Mastercard, Apple Pay, Google Pay",
  },
  {
    id: "local",
    icon: Lock,
    title: "Local Payment",
    subtitle: "OPay, bank transfer, USSD (where supported)",
  },
  {
    id: "crypto",
    icon: Coins,
    title: "Pay with Crypto",
    subtitle: "USDT, USDC — instant settlement",
  },
];

// Real Xeevia value propositions extracted from the platform
const WHY_JOIN = [
  {
    icon: <Zap size={16} />,
    text: "Earn EP the moment you sign up — your first deposit is instant",
  },
  {
    icon: <TrendingUp size={16} />,
    text: "Creators earn 84% of every engagement — value flows to makers, not platforms",
  },
  {
    icon: <Users size={16} />,
    text: "Built-in communities with governance, channels, and real ownership",
  },
  {
    icon: <Check size={16} />,
    text: "Every like costs EP and pays a creator — signal kills noise",
  },
];

const s = (obj) => ({ ...obj });

function PaymentWall({ onPaymentComplete, onBack, user }) {
  const [step, setStep] = useState("checking");
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    checkAdminBypass(user).then((isAdmin) =>
      setStep(isAdmin ? "bypass" : "select"),
    );
  }, [user]);

  const grouped = COUNTRIES.reduce((acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
  }, {});

  const selectedCountryData = COUNTRIES.find((c) => c.code === selectedCountry);
  const availableMethods = selectedCountryData
    ? PAYMENT_METHODS.filter((m) => selectedCountryData.methods.includes(m.id))
    : [];

  const handleCountryChange = (e) => {
    const code = e.target.value;
    setSelectedCountry(code);
    const country = COUNTRIES.find((c) => c.code === code);
    if (selectedMethod && country && !country.methods.includes(selectedMethod))
      setSelectedMethod(null);
  };

  const handleValidateInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError("Please enter an invite or VIP code");
      return;
    }
    setIsValidating(true);
    setInviteError("");
    try {
      const { data } = await supabase
        .from("invite_codes")
        .select("id, status, uses_count, max_uses")
        .eq("code", inviteCode.toUpperCase().trim())
        .eq("status", "active")
        .maybeSingle();
      if (data && data.uses_count < data.max_uses) {
        await supabase
          .from("invite_codes")
          .update({ uses_count: data.uses_count + 1 })
          .eq("id", data.id);
        await activateAccount(user);
        setStep("success");
      } else {
        setInviteError("Invalid or expired code. Please check and try again.");
      }
    } catch {
      setInviteError("Could not validate code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmPayment = () => {
    setStep("processing");
    // TODO: integrate real payment gateway
    setTimeout(
      () => activateAccount(user).then(() => setStep("success")),
      3000,
    );
  };

  const handleAdminBypass = async () => {
    setStep("processing");
    await activateAccount(user);
    setStep("success");
  };

  // ── Shared layout wrapper ────────────────────────────────────────────────
  const Wrap = ({ children, narrow = false }) => (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: narrow ? 420 : 500 }}>
        {children}
      </div>
    </div>
  );

  const Card = ({ children, style = {} }) => (
    <div
      style={{
        background: "#0d0d0e",
        border: "1px solid rgba(200,245,66,.16)",
        borderRadius: 20,
        padding: "32px 28px",
        ...style,
      }}
    >
      {children}
    </div>
  );

  const BackBtn = ({ onClick, label = "Back" }) => (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "#71717a",
        cursor: "pointer",
        fontSize: 13,
        padding: 0,
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );

  const PrimaryBtn = ({ children, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "13px",
        borderRadius: 12,
        border: "none",
        background: disabled
          ? "#18181b"
          : "linear-gradient(135deg,#c8f542,#84cc16)",
        color: disabled ? "#3f3f46" : "#000",
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? "default" : "pointer",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );

  // ── Screens ──────────────────────────────────────────────────────────────
  if (step === "checking")
    return (
      <Wrap>
        <div style={{ textAlign: "center", color: "#71717a" }}>
          <Loader2
            style={{
              width: 40,
              height: 40,
              animation: "spin 1s linear infinite",
              color: "#c8f542",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Wrap>
    );

  if (step === "processing")
    return (
      <Wrap>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(200,245,66,.08)",
              border: "2px solid rgba(200,245,66,.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Loader2
              style={{
                width: 36,
                height: 36,
                color: "#c8f542",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
          <h3
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 8px",
            }}
          >
            Activating your account...
          </h3>
          <p style={{ color: "#71717a", fontSize: 14 }}>
            This only takes a moment
          </p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Wrap>
    );

  if (step === "success")
    return (
      <Wrap narrow>
        <Card style={{ textAlign: "center" }}>
          <div
            style={{
              position: "relative",
              width: 88,
              height: 88,
              margin: "0 auto 22px",
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#c8f542,#84cc16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 32px rgba(200,245,66,.38)",
              }}
            >
              <Check
                style={{ width: 44, height: 44, color: "#000", strokeWidth: 3 }}
              />
            </div>
            <Sparkles
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 26,
                height: 26,
                color: "#c8f542",
              }}
            />
          </div>
          <h3
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              margin: "0 0 6px",
            }}
          >
            You're in.
          </h3>
          <p
            style={{
              color: "#71717a",
              fontSize: 14,
              margin: "0 0 22px",
              lineHeight: 1.7,
            }}
          >
            Your account is activated. EP has been deposited to your wallet.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {[
              "Account activated",
              "EP deposited to wallet",
              "Earn GT from your first engagement",
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#a3e635",
                  fontSize: 13,
                  justifyContent: "center",
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
                <span>{t}</span>
              </div>
            ))}
          </div>
          <PrimaryBtn onClick={onPaymentComplete}>Enter Xeevia →</PrimaryBtn>
        </Card>
      </Wrap>
    );

  if (step === "bypass")
    return (
      <Wrap narrow>
        <Card style={{ textAlign: "center" }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "rgba(200,245,66,.08)",
              border: "2px solid rgba(200,245,66,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              fontSize: 28,
            }}
          >
            🛡️
          </div>
          <h3
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: 800,
              margin: "0 0 8px",
            }}
          >
            Admin Access
          </h3>
          <p
            style={{
              color: "#71717a",
              fontSize: 14,
              margin: "0 0 24px",
              lineHeight: 1.7,
            }}
          >
            Your account has admin privileges. You can activate for free.
          </p>
          <PrimaryBtn onClick={handleAdminBypass}>Activate Free →</PrimaryBtn>
          <button
            onClick={() => setStep("select")}
            style={{
              background: "none",
              border: "none",
              color: "#3f3f46",
              fontSize: 13,
              cursor: "pointer",
              padding: 8,
              width: "100%",
              marginTop: 8,
            }}
          >
            Pay normally instead
          </button>
        </Card>
      </Wrap>
    );

  if (step === "invite")
    return (
      <Wrap narrow>
        <Card>
          <BackBtn onClick={() => setStep("select")} label="Back to payment" />
          <h2
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: 800,
              margin: "0 0 6px",
            }}
          >
            VIP / Invite Access
          </h2>
          <p style={{ color: "#71717a", fontSize: 13, margin: "0 0 20px" }}>
            Invite codes are limited and issued intentionally.
          </p>
          {inviteError && (
            <div
              style={{
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.22)",
                borderRadius: 10,
                color: "#f87171",
                fontSize: 13,
                padding: "10px 12px",
                marginBottom: 14,
              }}
            >
              {inviteError}
            </div>
          )}
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value);
              setInviteError("");
            }}
            placeholder="Enter invite or VIP code"
            disabled={isValidating}
            onKeyDown={(e) => e.key === "Enter" && handleValidateInvite()}
            style={{
              width: "100%",
              background: "#18181b",
              border: "1.5px solid #27272a",
              borderRadius: 12,
              padding: "13px 14px",
              color: "#fff",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 14,
            }}
          />
          <PrimaryBtn onClick={handleValidateInvite} disabled={isValidating}>
            {isValidating ? "Validating..." : "Unlock with code"}
          </PrimaryBtn>
        </Card>
      </Wrap>
    );

  if (step === "confirm")
    return (
      <Wrap narrow>
        <Card>
          <BackBtn onClick={() => setStep("select")} label="Change method" />
          <h2
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: 800,
              margin: "0 0 20px",
            }}
          >
            Confirm Payment
          </h2>
          {[
            { label: "Amount", value: "$1", accent: true },
            { label: "What you receive", value: "EP deposit on activation" },
            {
              label: "Creator share",
              value: "84% of every engagement you earn",
            },
            {
              label: "GT conversion",
              value: "40% of monthly EP → stored value",
            },
            { label: "Protocol fee", value: "2% on all transactions" },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "12px 0",
                borderBottom: "1px solid #1f1f23",
              }}
            >
              <span style={{ color: "#71717a", fontSize: 13 }}>{r.label}</span>
              <span
                style={{
                  color: r.accent ? "#c8f542" : "#fff",
                  fontWeight: r.accent ? 800 : 500,
                  fontSize: r.accent ? 20 : 13,
                  textAlign: "right",
                  maxWidth: "55%",
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 22 }}>
            <PrimaryBtn onClick={handleConfirmPayment}>
              Continue to Secure Payment →
            </PrimaryBtn>
          </div>
        </Card>
      </Wrap>
    );

  // ── Main select screen ───────────────────────────────────────────────────
  return (
    <Wrap>
      <BackBtn onClick={onBack} />
      <Card>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: "#c8f542",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Join the Economy
          </div>
          <h2
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
              margin: "0 0 6px",
              lineHeight: 1.1,
            }}
          >
            Activate Xeevia
          </h2>
          <p style={{ color: "#71717a", fontSize: 13, margin: 0 }}>
            $1 one-time entry. EP deposited instantly on activation.
          </p>
        </div>

        {/* Why join — real platform data */}
        <div
          style={{
            background: "rgba(200,245,66,.04)",
            border: "1px solid rgba(200,245,66,.12)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#71717a",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            What you're joining
          </div>
          {WHY_JOIN.map((w, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: i < WHY_JOIN.length - 1 ? 10 : 0,
              }}
            >
              <span style={{ color: "#c8f542", flexShrink: 0, marginTop: 1 }}>
                {w.icon}
              </span>
              <span style={{ color: "#a3a3a3", fontSize: 13, lineHeight: 1.5 }}>
                {w.text}
              </span>
            </div>
          ))}
        </div>

        {/* Economy stats from whitepaper */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 22,
          }}
        >
          {[
            { v: "2 EP", l: "Per like" },
            { v: "4 EP", l: "Per comment" },
            { v: "10 EP", l: "Per post" },
            { v: "40%", l: "EP → GT monthly" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 10,
                padding: "12px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#c8f542",
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: "monospace",
                }}
              >
                {s.v}
              </div>
              <div style={{ color: "#52525b", fontSize: 11, marginTop: 2 }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Country */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              color: "#a3a3a3",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              display: "block",
              marginBottom: 8,
            }}
          >
            Your country
          </label>
          <div style={{ position: "relative" }}>
            <select
              value={selectedCountry}
              onChange={handleCountryChange}
              style={{
                width: "100%",
                padding: "13px 40px 13px 14px",
                background: "#18181b",
                border: "1.5px solid #27272a",
                borderRadius: 12,
                color: selectedCountry ? "#fff" : "#52525b",
                fontSize: 14,
                outline: "none",
                appearance: "none",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <option value="">Choose your country...</option>
              {Object.entries(grouped).map(([region, list]) => (
                <optgroup key={region} label={region}>
                  {list.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#52525b",
                pointerEvents: "none",
              }}
            >
              ▾
            </div>
          </div>
          {selectedCountryData && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#52525b" }}>
              {selectedCountryData.methods.length} payment method
              {selectedCountryData.methods.length > 1 ? "s" : ""} available
            </div>
          )}
        </div>

        {/* Payment methods */}
        {selectedCountry && (
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                color: "#a3a3a3",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 8,
              }}
            >
              Payment method
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availableMethods.map((m) => {
                const Icon = m.icon;
                const sel = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      background: sel ? "rgba(200,245,66,.07)" : "#18181b",
                      border: `1.5px solid ${sel ? "#c8f542" : "#27272a"}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all .15s",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: sel ? "rgba(200,245,66,.14)" : "#27272a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        style={{
                          width: 16,
                          height: 16,
                          color: sel ? "#c8f542" : "#71717a",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: sel ? "#c8f542" : "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {m.title}
                      </div>
                      <div
                        style={{ color: "#52525b", fontSize: 11, marginTop: 2 }}
                      >
                        {m.subtitle}
                      </div>
                    </div>
                    {sel && (
                      <Check
                        style={{
                          width: 16,
                          height: 16,
                          color: "#c8f542",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <PrimaryBtn
          onClick={() => setStep("confirm")}
          disabled={!selectedMethod || !selectedCountry}
        >
          {!selectedCountry
            ? "Select your country first"
            : !selectedMethod
              ? "Select a payment method"
              : "Continue →"}
        </PrimaryBtn>

        {/* Invite link */}
        <button
          onClick={() => setStep("invite")}
          style={{
            background: "none",
            border: "none",
            color: "#52525b",
            fontSize: 13,
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
            padding: "12px 8px",
            marginTop: 4,
          }}
        >
          Have a VIP / Invite code?
        </button>

        {/* Trust row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 20,
            paddingTop: 14,
            borderTop: "1px solid #1f1f23",
          }}
        >
          {[
            { icon: <Shield size={13} />, t: "Secure payments" },
            { icon: <Lock size={13} />, t: "One-time entry" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#3f3f46",
                fontSize: 12,
              }}
            >
              {item.icon}
              {item.t}
            </div>
          ))}
        </div>
      </Card>
    </Wrap>
  );
}

export default PaymentWall;
