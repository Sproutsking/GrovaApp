// src/services/wallet/opayService.js
// ============================================================================
// OPay Service Layer — Singular Money Network Gateway
// ============================================================================
//
// PURPOSE:
//   • Centralize all OPay operations for Naira transactions
//   • Serve as the singular payment processor (not a bank)
//   • Enable money network functionality without banking license
//   • Support: deposits, bills, transfers, withdrawals
//
// KEY FUNCTIONS:
//   • opayTransfer() — Send money to external accounts/phones
//   • opayBillPayment() — Pay bills (airtime, data, electricity, cable)
//   • opayDeposit() — Deposit to PayWave wallet
//   • opayWithdrawal() — Withdraw from PayWave wallet
//   • opayBalanceCheck() — Check OPay account balance
//   • opayTransactionHistory() — Get transaction records
//
// INTEGRATION:
//   Used by PayWave (billing, transfers), DepositTab (deposits), WithdrawTab
//
// ============================================================================

import { supabase } from "../config/supabase";

const MIN_TRANSACTION = 100;    // Minimum ₦100
const MAX_TRANSACTION = 5000000; // Maximum ₦5M per transaction
const TRANSFER_FEE = 5;          // ₦5 transfer fee
const WITHDRAWAL_FEE = 50;       // ₦50 withdrawal fee
const DEPOSIT_FEE = 0;           // No fee on deposits

class OPayService {
  // ── TRANSFERS ──────────────────────────────────────────────────────────
  /**
   * Send money via OPay to external phone/account
   * @param {string} fromUserId - Sender user ID
   * @param {string} recipientPhone - Recipient phone number or account
   * @param {number} ngnAmount - Amount in Naira
   * @param {string} note - Transaction note/reference
   * @returns {Promise<{success: bool, data?: any, error?: string}>}
   */
  async transfer({ fromUserId, recipientPhone, ngnAmount, note }) {
    const amount = parseFloat(ngnAmount);
    
    // Validation
    if (!fromUserId) throw new Error("User ID required");
    if (!recipientPhone) throw new Error("Recipient phone required");
    if (amount < MIN_TRANSACTION) throw new Error(`Minimum transfer: ₦${MIN_TRANSACTION}`);
    if (amount > MAX_TRANSACTION) throw new Error(`Maximum transfer: ₦${MAX_TRANSACTION}`);

    try {
      const { data, error } = await supabase.rpc("paywave_external_send", {
        p_from_user_id: fromUserId,
        p_opay_phone: recipientPhone.replace(/\D/g, ""),
        p_ngn_amount: amount,
        p_fee: TRANSFER_FEE,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error("OPay transfer error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── BILL PAYMENTS ──────────────────────────────────────────────────────
  /**
   * Pay bills via OPay (airtime, data, electricity, cable)
   * @param {string} userId - User ID
   * @param {string} billType - Type: 'airtime', 'data', 'electricity', 'cable'
   * @param {string} provider - Provider: 'MTN', 'GLO', 'AIRTEL', '9mobile', 'NEPA', 'DSTV', 'GOTV'
   * @param {string} identifier - Phone/meter/account number
   * @param {number} ngnAmount - Amount in Naira
   * @returns {Promise<{success: bool, transactionId?: string, error?: string}>}
   */
  async billPayment({ userId, billType, provider, identifier, ngnAmount }) {
    const amount = parseFloat(ngnAmount);

    // Validation
    if (!userId) throw new Error("User ID required");
    if (!billType) throw new Error("Bill type required");
    if (!provider) throw new Error("Provider required");
    if (!identifier) throw new Error("Identifier (phone/meter/account) required");
    if (amount < MIN_TRANSACTION) throw new Error(`Minimum payment: ₦${MIN_TRANSACTION}`);
    if (amount > MAX_TRANSACTION) throw new Error(`Maximum payment: ₦${MAX_TRANSACTION}`);

    try {
      // Determine RPC function based on bill type
      let rpcFunction = "";
      let params = {
        p_user_id: userId,
        p_amount: amount,
        p_provider: provider.toUpperCase(),
        p_identifier: identifier.replace(/\D/g, ""),
      };

      if (billType === "airtime") {
        rpcFunction = "opay_buy_airtime";
      } else if (billType === "data") {
        rpcFunction = "opay_buy_data";
      } else if (billType === "electricity") {
        rpcFunction = "opay_buy_electricity";
        params.p_meter_number = identifier;
      } else if (billType === "cable") {
        rpcFunction = "opay_buy_cable";
        params.p_account_number = identifier;
      } else {
        throw new Error("Invalid bill type");
      }

      const { data, error } = await supabase.rpc(rpcFunction, params);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, transactionId: data?.transaction_id, data };
    } catch (err) {
      console.error("OPay bill payment error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── DEPOSITS ───────────────────────────────────────────────────────────
  /**
   * Deposit to PayWave wallet via OPay
   * @param {string} userId - User ID
   * @param {number} ngnAmount - Amount in Naira
   * @param {string} currency - Target currency: 'EP' or 'XEV'
   * @returns {Promise<{success: bool, reference?: string, credit?: number, error?: string}>}
   */
  async deposit({ userId, ngnAmount, currency = "EP" }) {
    const amount = parseFloat(ngnAmount);

    if (!userId) throw new Error("User ID required");
    if (amount < MIN_TRANSACTION) throw new Error(`Minimum deposit: ₦${MIN_TRANSACTION}`);
    if (amount > MAX_TRANSACTION) throw new Error(`Maximum deposit: ₦${MAX_TRANSACTION}`);

    try {
      const { data, error } = await supabase.rpc("opay_deposit_to_paywave", {
        p_user_id: userId,
        p_ngn_amount: amount,
        p_currency: currency,
        p_fee: DEPOSIT_FEE,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        reference: data?.reference,
        credit: data?.credit_amount,
        data 
      };
    } catch (err) {
      console.error("OPay deposit error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── WITHDRAWALS ────────────────────────────────────────────────────────
  /**
   * Withdraw from PayWave wallet to OPay account
   * @param {string} userId - User ID
   * @param {number} ngnAmount - Amount in Naira
   * @param {string} opayPhone - OPay phone number
   * @returns {Promise<{success: bool, transactionId?: string, error?: string}>}
   */
  async withdrawal({ userId, ngnAmount, opayPhone }) {
    const amount = parseFloat(ngnAmount);

    if (!userId) throw new Error("User ID required");
    if (amount < MIN_TRANSACTION) throw new Error(`Minimum withdrawal: ₦${MIN_TRANSACTION}`);
    if (amount > MAX_TRANSACTION) throw new Error(`Maximum withdrawal: ₦${MAX_TRANSACTION}`);
    if (!opayPhone) throw new Error("OPay phone number required");

    try {
      const { data, error } = await supabase.rpc("opay_withdrawal_from_paywave", {
        p_user_id: userId,
        p_ngn_amount: amount,
        p_opay_phone: opayPhone.replace(/\D/g, ""),
        p_fee: WITHDRAWAL_FEE,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, transactionId: data?.transaction_id, data };
    } catch (err) {
      console.error("OPay withdrawal error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── BALANCE CHECK ──────────────────────────────────────────────────────
  /**
   * Check OPay account balance
   * @param {string} userId - User ID
   * @returns {Promise<{success: bool, balance?: number, currency?: string, error?: string}>}
   */
  async getBalance(userId) {
    if (!userId) throw new Error("User ID required");

    try {
      const { data, error } = await supabase.rpc("opay_get_balance", {
        p_user_id: userId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        balance: data?.balance,
        currency: data?.currency || "NGN",
        data 
      };
    } catch (err) {
      console.error("OPay balance check error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── TRANSACTION HISTORY ────────────────────────────────────────────────
  /**
   * Get transaction history
   * @param {string} userId - User ID
   * @param {number} limit - Number of records (default 50)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {Promise<{success: bool, transactions?: array, total?: number, error?: string}>}
   */
  async getTransactionHistory(userId, limit = 50, offset = 0) {
    if (!userId) throw new Error("User ID required");

    try {
      const { data, error } = await supabase.rpc("opay_get_transactions", {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        transactions: data?.transactions || [],
        total: data?.total || 0,
        data 
      };
    } catch (err) {
      console.error("OPay transaction history error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── ACCOUNT LINKING ────────────────────────────────────────────────────
  /**
   * Link OPay account to user profile
   * @param {string} userId - User ID
   * @param {string} opayPhone - OPay phone number
   * @param {string} opayAccountName - Account holder name
   * @returns {Promise<{success: bool, error?: string}>}
   */
  async linkAccount({ userId, opayPhone, opayAccountName }) {
    if (!userId) throw new Error("User ID required");
    if (!opayPhone) throw new Error("OPay phone number required");
    if (!opayAccountName) throw new Error("Account name required");

    try {
      const { data, error } = await supabase
        .from("user_cards")
        .insert({
          user_id: userId,
          card_type: "opay_account",
          card_name: opayAccountName,
          last_four: opayPhone.replace(/\D/g, "").slice(-4),
          brand: "OPay",
          bank_name: "OPay",
          phone: opayPhone,
          status: "connected",
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error("OPay account linking error:", err);
      return { success: false, error: err.message };
    }
  }

  // ── VALIDATION HELPERS ─────────────────────────────────────────────────
  /**
   * Validate Nigerian phone number
   * @param {string} phone - Phone number
   * @returns {boolean}
   */
  static isValidNigerianPhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/\D/g, "");
    return /^234[789]\d{9}$/.test(clean) || /^0[789]\d{9}$/.test(clean);
  }

  /**
   * Format amount for display
   * @param {number} amount - Amount in Naira
   * @returns {string}
   */
  static formatNGN(amount) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Calculate fees for a transaction
   * @param {string} type - Transaction type: 'transfer', 'bill', 'withdrawal'
   * @param {number} amount - Amount in Naira
   * @returns {number} Fee amount
   */
  static calculateFee(type, amount) {
    if (type === "transfer") return TRANSFER_FEE;
    if (type === "withdrawal") return WITHDRAWAL_FEE;
    if (type === "bill") return 0; // No fee on bills
    return 0;
  }
}

export default new OPayService();
