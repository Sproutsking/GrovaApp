// src/models/WalletModel.js
// ════════════════════════════════════════════════════════════════
// Wallet Domain Models — $XEV + EP dual currency
// ════════════════════════════════════════════════════════════════

export const XEV_TO_NGN = 2.5;
export const EP_TO_NGN = 1; // 1 EP = ₦1 in PayWave

export const CURRENCIES = {
  XEV: {
    symbol: "$XEV",
    name: "XEV Token",
    color: "#f59e0b",
    transferable: true,
    onChain: true,
    description: "Transferable token, converts to NGN",
  },
  EP: {
    symbol: "EP",
    name: "Engagement Points",
    color: "#22d3ee",
    transferable: true, // internal only
    onChain: false,
    description: "Internal platform currency, cannot leave",
  },
};

export const TX_TYPES = {
  SEND: "send",
  RECEIVE: "receive",
  DEPOSIT: "deposit",
  SWAP: "swap",
  BURN: "burn",
  CREDIT: "credit", // EP engagement credit
  PAYWAVE: "paywave", // PayWave internal transfer
};

export const DEPOSIT_METHODS = {
  CRYPTO: "crypto",
  BANK_TRANSFER: "transfer",
  ATM: "atm",
};

// EP burn amounts by transaction weight
export const EP_BURN = {
  // Transfers by value tier
  transfer_tier_1: 1, // < ₦250
  transfer_tier_2: 2, // ₦250–₦999
  transfer_tier_3: 4, // ₦1000–₦4999
  transfer_tier_4: 7, // ₦5000–₦24999
  transfer_tier_5: 10, // ₦25000+
  // Other actions
  swap: 5,
  conversion: 3,
  paywave_internal: 0, // PayWave internal: free
  paywave_opay: 0, // PayWave OPay: ₦5 fee (no EP burn)
};

/**
 * Get EP burn for a transaction
 * @param {string} txType - TX_TYPES value
 * @param {number} xevAmount - Amount in XEV
 * @returns {number} EP to burn
 */
export function getEPBurn(txType, xevAmount = 0) {
  if (txType === TX_TYPES.DEPOSIT || txType === TX_TYPES.RECEIVE) return 0;
  if (txType === TX_TYPES.SWAP) return EP_BURN.swap;
  if (txType === TX_TYPES.PAYWAVE) return 0;

  const ngnValue = xevAmount * XEV_TO_NGN;
  if (ngnValue < 250) return EP_BURN.transfer_tier_1;
  if (ngnValue < 1000) return EP_BURN.transfer_tier_2;
  if (ngnValue < 5000) return EP_BURN.transfer_tier_3;
  if (ngnValue < 25000) return EP_BURN.transfer_tier_4;
  return EP_BURN.transfer_tier_5;
}

/**
 * Model a transaction object
 */
export class Transaction {
  constructor({
    id,
    userId,
    type,
    currency,
    amount,
    fee = 0,
    epBurn = 0,
    toUserId,
    fromUserId,
    description,
    status = "pending",
    metadata = {},
    createdAt = new Date().toISOString(),
  }) {
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.currency = currency;
    this.amount = parseFloat(amount);
    this.fee = parseFloat(fee);
    this.epBurn = parseInt(epBurn);
    this.toUserId = toUserId;
    this.fromUserId = fromUserId;
    this.description = description;
    this.status = status;
    this.metadata = metadata;
    this.createdAt = createdAt;
  }

  get ngnValue() {
    if (this.currency === "XEV") return this.amount * XEV_TO_NGN;
    if (this.currency === "EP") return this.amount * EP_TO_NGN;
    return this.amount;
  }

  get isCredit() {
    return [TX_TYPES.RECEIVE, TX_TYPES.DEPOSIT, TX_TYPES.CREDIT].includes(
      this.type,
    );
  }

  get isDebit() {
    return [TX_TYPES.SEND, TX_TYPES.BURN, TX_TYPES.SWAP].includes(this.type);
  }
}

/**
 * Model a wallet object
 */
export class Wallet {
  constructor({ userId, xevTokens = 0, engagementPoints = 0 }) {
    this.userId = userId;
    this.xevTokens = parseFloat(xevTokens);
    this.engagementPoints = parseFloat(engagementPoints);
  }

  get totalNGNValue() {
    return this.xevTokens * XEV_TO_NGN;
  }

  get payWaveBalance() {
    return this.engagementPoints * EP_TO_NGN; // NGN equivalent
  }

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

/**
 * Deposit model
 */
export class Deposit {
  constructor({ method, amount, currency, txReference, userId }) {
    this.method = method;
    this.amount = parseFloat(amount);
    this.currency = currency;
    this.txReference = txReference;
    this.userId = userId;
  }

  get xevToCredit() {
    if (this.currency === "NGN") {
      return this.amount / XEV_TO_NGN;
    }
    // USDT at 1:1 to XEV (rate adjustable)
    return this.amount;
  }

  get epToMint() {
    return Math.floor(this.xevToCredit); // 1 EP per 1 XEV
  }
}
