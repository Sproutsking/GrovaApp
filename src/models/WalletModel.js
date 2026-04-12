// src/models/WalletModel.js
// ════════════════════════════════════════════════════════════════
// Wallet Domain Models — $XEV + EP dual currency
//
// CANONICAL EXCHANGE RATES (source of truth):
//   1 USD  = 100 EP
//   1 $XEV = 10 EP
//   1 $XEV = $0.10 USD
//
// Derived:
//   EP  → USD : epAmount / 100
//   EP  → XEV : epAmount / 10
//   XEV → USD : xevAmount * 0.10
//   XEV → EP  : xevAmount * 10
//   USD → EP  : usdAmount * 100
//   USD → XEV : usdAmount / 0.10  (= usdAmount * 10)
// ════════════════════════════════════════════════════════════════

// ── Canonical rates ───────────────────────────────────────────────
export const EP_PER_USD  = 100;   // 1 USD  = 100 EP
export const EP_PER_XEV  = 10;    // 1 XEV  = 10 EP
export const USD_PER_XEV = 0.10;  // 1 XEV  = $0.10 USD

// Legacy aliases (keep for backward compat — do NOT use for new code)
/** @deprecated use USD_PER_XEV */
export const XEV_TO_USD  = USD_PER_XEV;   // 0.10
/** @deprecated use EP_PER_USD */
export const EP_TO_NGN   = 1; // EP ↔ NGN peg is separate from USD rate; keep 1 EP = ₦1

// ── Conversion helpers ────────────────────────────────────────────
export const convert = {
  epToUsd:  (ep)  => ep  / EP_PER_USD,           // EP  → USD
  epToXev:  (ep)  => ep  / EP_PER_XEV,            // EP  → XEV
  xevToUsd: (xev) => xev * USD_PER_XEV,           // XEV → USD
  xevToEp:  (xev) => xev * EP_PER_XEV,            // XEV → EP
  usdToEp:  (usd) => usd * EP_PER_USD,            // USD → EP
  usdToXev: (usd) => usd / USD_PER_XEV,           // USD → XEV
};

export const CURRENCIES = {
  XEV: {
    symbol:       "$XEV",
    name:         "XEV Token",
    color:        "#f59e0b",
    transferable: true,
    onChain:      true,
    description:  "Transferable token · 1 $XEV = $0.10 USD = 10 EP",
    usdRate:      USD_PER_XEV,    // 0.10
    epRate:       EP_PER_XEV,     // 10
  },
  EP: {
    symbol:       "EP",
    name:         "Engagement Points",
    color:        "#22d3ee",
    transferable: true, // internal only
    onChain:      false,
    description:  "Internal platform currency · 100 EP = $1 USD",
    usdRate:      1 / EP_PER_USD, // 0.01
    epRate:       1,
  },
};

export const TX_TYPES = {
  SEND:    "send",
  RECEIVE: "receive",
  DEPOSIT: "deposit",
  SWAP:    "swap",
  BURN:    "burn",
  CREDIT:  "credit",   // EP engagement credit
  PAYWAVE: "paywave",  // PayWave internal transfer
};

export const DEPOSIT_METHODS = {
  CRYPTO:        "crypto",
  BANK_TRANSFER: "transfer",
  ATM:           "atm",
};

// ── EP burn table for wallet sends ───────────────────────────────
// Tiers are denominated in XEV (not NGN) to stay currency-agnostic.
// 1 XEV = $0.10, so tiers in approximate USD value:
//   tier 1: < 1 XEV   (~< $0.10)   → 0.5 EP
//   tier 2: < 5 XEV   (~< $0.50)   → 2 EP
//   tier 3: < 20 XEV  (~< $2.00)   → 5 EP
//   tier 4: 20+ XEV   (~$2.00+)    → 10 EP
export const EP_BURN_TABLE = [
  { maxXev: 1,        burn: 0.5 },
  { maxXev: 5,        burn: 2   },
  { maxXev: 20,       burn: 5   },
  { maxXev: Infinity, burn: 10  },
];

export const EP_BURN = {
  swap:             5,
  conversion:       3,
  paywave_internal: 0,
  paywave_opay:     0,
};

/**
 * Compute EP burn for a send transaction.
 * @param {string} txType - TX_TYPES value
 * @param {number} xevAmount - Amount in XEV
 * @returns {number} EP to burn
 */
export function getEPBurn(txType, xevAmount = 0) {
  if (txType === TX_TYPES.DEPOSIT || txType === TX_TYPES.RECEIVE) return 0;
  if (txType === TX_TYPES.SWAP)    return EP_BURN.swap;
  if (txType === TX_TYPES.PAYWAVE) return 0;

  for (const row of EP_BURN_TABLE) {
    if (xevAmount < row.maxXev) return row.burn;
  }
  return 10;
}

// ── Transaction model ─────────────────────────────────────────────
export class Transaction {
  constructor({
    id,
    userId,
    type,
    currency,
    amount,
    fee      = 0,
    epBurn   = 0,
    toUserId,
    fromUserId,
    description,
    status   = "pending",
    metadata = {},
    createdAt = new Date().toISOString(),
  }) {
    this.id          = id;
    this.userId      = userId;
    this.type        = type;
    this.currency    = currency;
    this.amount      = parseFloat(amount);
    this.fee         = parseFloat(fee);
    this.epBurn      = parseFloat(epBurn);
    this.toUserId    = toUserId;
    this.fromUserId  = fromUserId;
    this.description = description;
    this.status      = status;
    this.metadata    = metadata;
    this.createdAt   = createdAt;
  }

  /** USD equivalent of this transaction */
  get usdValue() {
    if (this.currency === "XEV") return convert.xevToUsd(this.amount);
    if (this.currency === "EP")  return convert.epToUsd(this.amount);
    return this.amount;
  }

  /** EP equivalent of this transaction */
  get epValue() {
    if (this.currency === "XEV") return convert.xevToEp(this.amount);
    if (this.currency === "EP")  return this.amount;
    return convert.usdToEp(this.amount);
  }

  get isCredit() {
    return [TX_TYPES.RECEIVE, TX_TYPES.DEPOSIT, TX_TYPES.CREDIT].includes(this.type);
  }

  get isDebit() {
    return [TX_TYPES.SEND, TX_TYPES.BURN, TX_TYPES.SWAP].includes(this.type);
  }
}

// ── Wallet model ──────────────────────────────────────────────────
export class Wallet {
  constructor({ userId, xevTokens = 0, engagementPoints = 0, paywaveBalance = 0 }) {
    this.userId           = userId;
    this.xevTokens        = parseFloat(xevTokens);
    this.engagementPoints = parseFloat(engagementPoints);
    this.paywaveBalance   = parseFloat(paywaveBalance);
  }

  /** Total wallet value in USD (XEV only — EP is internal) */
  get totalUsdValue() {
    return convert.xevToUsd(this.xevTokens);
  }

  /** EP equivalent of XEV holdings */
  get xevAsEp() {
    return convert.xevToEp(this.xevTokens);
  }

  /** PayWave balance: 1 EP = ₦1 NGN (separate from USD rate) */
  get paywaveNGN() {
    return this.engagementPoints * EP_TO_NGN;
  }

  /**
   * Check if the wallet can afford an action.
   * @param {"XEV"|"EP"} currency
   * @param {number} amount
   * @param {number} epBurn - additional EP fee to burn
   */
  canAfford(currency, amount, epBurn = 0) {
    if (currency === "XEV") {
      return this.xevTokens >= amount && this.engagementPoints >= epBurn;
    }
    if (currency === "EP") {
      return this.engagementPoints >= amount + epBurn;
    }
    return false;
  }
}

// ── Deposit model ─────────────────────────────────────────────────
export class Deposit {
  constructor({ method, amount, currency, txReference, userId }) {
    this.method      = method;
    this.amount      = parseFloat(amount);
    this.currency    = currency;
    this.txReference = txReference;
    this.userId      = userId;
  }

  /**
   * How many XEV to credit for this deposit.
   * - NGN deposit  : ₦1 → 1 EP minted (not XEV); XEV requires explicit buy
   * - USD deposit  : $1 → 10 XEV  (1 XEV = $0.10)
   * - USDT deposit : 1 USDT → 10 XEV
   * - Crypto (XEV) : 1:1
   */
  get xevToCredit() {
    switch (this.currency) {
      case "USD":
      case "USDT": return convert.usdToXev(this.amount); // amount / 0.10
      case "XEV":  return this.amount;
      case "NGN":  return 0; // NGN deposits mint EP, not XEV
      default:     return this.amount;
    }
  }

  /**
   * How many EP to mint for this deposit.
   * - NGN : 1 EP per ₦1
   * - USD / USDT : 100 EP per $1
   * - XEV : 10 EP per 1 XEV
   */
  get epToMint() {
    switch (this.currency) {
      case "NGN":  return Math.floor(this.amount * EP_TO_NGN);
      case "USD":
      case "USDT": return Math.floor(convert.usdToEp(this.amount));
      case "XEV":  return Math.floor(convert.xevToEp(this.amount));
      default:     return 0;
    }
  }
}