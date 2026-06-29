# PayWave Complete System - Implementation Guide

## ✅ COMPLETED INFRASTRUCTURE

### 1. Database & Backend
- ✅ `paywave_complete_system.sql` - Transaction fees, XRC Oracle tracking, admin audit
- ✅ PayWave transaction table (separate from wallet_history)
- ✅ XRC Records for blockchain verification
- ✅ Admin fee configuration with CEO/Super Admin access

### 2. Edge Functions (Supabase)
- ✅ `deposit-opay-checkout/index.ts` - OPay Request-to-Pay
- ✅ `withdraw-opay/index.ts` - Bank disbursement + OPay wallet
- ✅ `deposit-flutterwave-checkout/index.ts` - Pan-Africa mobile money + cards
- ✅ `listener-web3-settlement/index.ts` - Solana/Polygon/Base verification

### 3. Frontend Services
- ✅ `opayService.js` - Refactored to call real edge functions
- ✅ `flutterwaveService.js` - Flutterwave integration
- ✅ `src/components/Admin/PayWaveManagement/FeeConfigManager.jsx` - Admin dashboard

### 4. UI Fixes
- ✅ `TransactionsTab.jsx` - Now queries only paywave_transactions (not wallet_history)

---

## 🔧 DEPLOYMENT CHECKLIST

### 1. Apply Database Migration
```bash
supabase db push migrations/paywave_complete_system.sql
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy deposit-opay-checkout
supabase functions deploy withdraw-opay
supabase functions deploy deposit-flutterwave-checkout
supabase functions deploy listener-web3-settlement
```

### 3. Set Environment Variables (Supabase)
```
OPAY_API_URL=https://api.opayweb.com/api/v3
OPAY_API_KEY=<your-opay-api-key>
OPAY_SECRET_KEY=<your-opay-secret-key>
OPAY_MERCHANT_ID=<your-opay-merchant-id>

FLUTTERWAVE_SECRET_KEY=<your-flutterwave-secret-key>

SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
POLYGON_RPC_URL=https://polygon-rpc.com
BASE_RPC_URL=https://mainnet.base.org

PUBLIC_URL=https://app.xeevia.com  # For redirect URLs
```

---

## 🎯 WIRING UI COMPONENTS

### 1. DepositTab.jsx (Multi-Provider Checkout)
```jsx
import opayService from "../../../services/wallet/opayService";
import flutterwaveService from "../../../services/wallet/flutterwaveService";

// Add provider selection
const [selectedProvider, setSelectedProvider] = useState("paystack");

// Handle OPay deposit
const handleOPayDeposit = async () => {
  const result = await opayService.depositViaOPayWallet({
    userId: profile.id,
    opayPhone: userPhone,
    ngnAmount: depositAmount,
  });
  if (result.success) {
    // User approves in OPay app
    // Webhook will credit wallet
    showSuccess("OPay payment request sent!");
  }
};

// Handle Flutterwave deposit
const handleFlutterwaveDeposit = async () => {
  const result = await flutterwaveService.depositViaFlutterwave({
    userId: profile.id,
    amount: depositAmount,
    currency: "NGN",
    paymentMethod: "all",
  });
  if (result.success) {
    // Redirect to Flutterwave checkout
    window.location.href = result.checkout_url;
  }
};

return (
  <div>
    {/* Provider tabs */}
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button 
        onClick={() => setSelectedProvider("paystack")}
        className={selectedProvider === "paystack" ? "active" : ""}
      >
        💳 Card & Bank (Paystack)
      </button>
      <button 
        onClick={() => setSelectedProvider("opay")}
        className={selectedProvider === "opay" ? "active" : ""}
      >
        📱 OPay Wallet
      </button>
      <button 
        onClick={() => setSelectedProvider("flutterwave")}
        className={selectedProvider === "flutterwave" ? "active" : ""}
      >
        🌍 Mobile Money (Flutterwave)
      </button>
    </div>

    {/* Forms for each provider */}
    {selectedProvider === "opay" && (
      <div>
        <input 
          placeholder="OPay Phone (e.g., 08012345678)"
          value={userPhone}
          onChange={(e) => setUserPhone(e.target.value)}
        />
        <button onClick={handleOPayDeposit}>Send Payment Request</button>
      </div>
    )}

    {selectedProvider === "flutterwave" && (
      <div>
        <input 
          placeholder="Amount (NGN)"
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />
        <button onClick={handleFlutterwaveDeposit}>Proceed to Checkout</button>
      </div>
    )}
  </div>
);
```

### 2. WithdrawTab.jsx (Bank + OPay)
```jsx
import opayService from "../../../services/wallet/opayService";

const [withdrawMethod, setWithdrawMethod] = useState("bank"); // bank | opay

// Handle bank withdrawal
const handleBankWithdraw = async () => {
  const result = await opayService.withdrawToBank({
    userId: profile.id,
    amount: withdrawAmount,
    bankAccount: accountNumber,
    bankCode: bankCode,
    accountName: accountName,
  });
  if (result.success) {
    showSuccess(`Withdrawal of ₦${withdrawAmount} initiated. Should arrive in 1-2 hours.`);
  }
};

// Handle OPay wallet withdrawal
const handleOPayWithdraw = async () => {
  const result = await opayService.withdrawToOPayWallet({
    userId: profile.id,
    opayPhone: opayPhone,
    amount: withdrawAmount,
  });
  if (result.success) {
    showSuccess(`Withdrawal of ₦${withdrawAmount} sent to OPay. Instant!`);
  }
};

return (
  <div>
    {/* Method selection */}
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button 
        onClick={() => setWithdrawMethod("bank")}
        className={withdrawMethod === "bank" ? "active" : ""}
      >
        🏦 Bank Account
      </button>
      <button 
        onClick={() => setWithdrawMethod("opay")}
        className={withdrawMethod === "opay" ? "active" : ""}
      >
        📱 OPay Wallet (Instant)
      </button>
    </div>

    {/* Forms */}
    {withdrawMethod === "bank" && (
      <div>
        <input placeholder="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
          <option value="">Select Bank</option>
          <option value="001">Access Bank</option>
          <option value="044">GTBank</option>
          <option value="035">Zenith Bank</option>
          {/* ... more banks */}
        </select>
        <button onClick={handleBankWithdraw}>Withdraw to Bank</button>
      </div>
    )}

    {withdrawMethod === "opay" && (
      <div>
        <input placeholder="OPay Phone" value={opayPhone} onChange={(e) => setOpayPhone(e.target.value)} />
        <button onClick={handleOPayWithdraw}>Send to OPay (Instant)</button>
      </div>
    )}
  </div>
);
```

### 3. BillsTab.jsx (Airtime, Data, TV, Electricity)
```jsx
import opayService from "../../../services/wallet/opayService";

// Airtime
const handleBuyAirtime = async (network, phone, amount) => {
  const result = await opayService.buyAirtime({
    userId: profile.id,
    network,
    phone,
    amount,
  });
  if (result.success) {
    showSuccess(`₦${amount} airtime sent to ${phone}`);
  }
};

// Data
const handleBuyData = async (network, phone, plan, amount) => {
  const result = await opayService.buyData({
    userId: profile.id,
    network,
    phone,
    planId: plan,
    amount,
  });
  if (result.success) {
    showSuccess(`Data bundle sent to ${phone}`);
  }
};

// Electricity
const handleBuyElectricity = async (provider, meter, amount) => {
  const result = await opayService.buyElectricity({
    userId: profile.id,
    provider,
    meterNumber: meter,
    amount,
    meterType: "prepaid",
  });
  if (result.success) {
    showSuccess(`₦${amount} electricity purchased`);
  }
};

// Cable TV
const handleBuyCable = async (provider, smartCard, package, amount) => {
  const result = await opayService.buyCable({
    userId: profile.id,
    provider,
    smartCard,
    packageId: package,
    amount,
  });
  if (result.success) {
    showSuccess(`${package} subscription purchased`);
  }
};
```

---

## 🌐 WEB3 INTEGRATION (Solana/Polygon/Base)

### 1. PaywallPayment.jsx Web3 Tabs
Already has Solana, Cardano, EVM stubs. Update with listener:

```jsx
const handleSolanaPayment = async () => {
  // After user signs transaction, get txHash
  // Then call Web3 settlement listener
  
  const result = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/listener-web3-settlement`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        chainType: "solana",
        chainId: 0,
        txHash: solanaTransactionSignature,
        userId: profile.id,
        amount: priceInUSDC,
        tokenSymbol: "USDC",
      }),
    }
  );
  
  const data = await result.json();
  if (data.success) {
    setSolMsg("✓ Payment verified! Wallet credited.");
  }
};
```

---

## 📊 ADMIN DASHBOARD ACCESS

1. **Route**: `/admin/paywave-fees` or add to admin menu
2. **Access**: CEO only by default (set in `admin_team.role`)
3. **Super Admin** can also be granted access

```jsx
// In AdminPanel or AdminMenu
import FeeConfigManager from "../components/Admin/PayWaveManagement/FeeConfigManager";

<Route path="/admin/paywave-fees" element={<FeeConfigManager />} />
```

---

## 🔔 WEBHOOK HANDLERS (Not implemented yet - to-do)

Create edge functions to handle:

### 1. OPay Webhooks
```typescript
// supabase/functions/webhook-opay/index.ts
- Payment confirmed
- Payment failed
- Disbursement completed
- Disbursement failed
```

### 2. Flutterwave Webhooks
```typescript
// supabase/functions/webhook-flutterwave/index.ts
- Payment successful
- Payment failed
```

### 3. XRC Oracle Updates
```typescript
// supabase/functions/webhook-xrc-settlement/index.ts
- Blockchain confirmation received
- Proof verified
```

---

## 🧪 TESTING FLOW

### 1. Paystack (Already working ✅)
- User clicks "Pay with Paystack"
- Redirected to Paystack checkout
- User completes payment
- Webhook confirms → balance credited

### 2. OPay Deposit
- User enters OPay phone
- System sends Request-to-Pay
- User receives push/OTP in OPay app
- User approves → OPay sends webhook
- Webhook confirms → balance credited

### 3. OPay Withdrawal
- User enters bank account or OPay phone
- System calls disbursement API
- OPay deducts from master account
- Sends to bank (1-2 hours) or OPay wallet (instant)
- Balance updated immediately

### 4. Flutterwave Deposit
- User clicks "Mobile Money"
- Redirected to Flutterwave checkout
- Selects payment method (MTN MoMo, M-Pesa, Airtel, etc.)
- Completes payment
- Flutterwave webhook confirms
- Balance credited

### 5. Bill Payments (Airtime/Data)
- User selects network and enters phone
- System calls OPay bill API
- Instant delivery
- PayWave history shows transaction

### 6. Web3 Deposit
- User connects wallet (Phantom, MetaMask)
- Signs USDC transfer
- System verifies on blockchain
- XRC Oracle records transaction
- Balance credited in PayWave

---

## 📋 ENVIRONMENT VARIABLES

### Frontend (.env)
```
REACT_APP_SUPABASE_URL=https://...supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbG...
```

### Supabase (secrets)
```
OPAY_API_KEY=...
OPAY_SECRET_KEY=...
OPAY_MERCHANT_ID=...
OPAY_API_URL=https://api.opayweb.com/api/v3

FLUTTERWAVE_SECRET_KEY=...

SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
POLYGON_RPC_URL=https://polygon-rpc.com
BASE_RPC_URL=https://mainnet.base.org

PUBLIC_URL=https://app.xeevia.com
```

---

## ✨ FINAL TOUCHES

1. **PayWave History** - Now only shows PayWave transactions ✅
2. **Transaction Fees** - Configurable per transaction type ✅
3. **Admin Dashboard** - CEO-only access to manage fees ✅
4. **XRC Oracle** - Tracks all transactions on blockchain ✅
5. **OPay Business** - Direct API integration ready ✅
6. **Flutterwave** - Pan-Africa coverage ready ✅
7. **Web3** - Solana/Polygon/Base verification ready ✅

---

## 🚀 NEXT STEPS

1. **Webhook Handlers** - Implement OPay, Flutterwave, XRC webhooks
2. **UI Integration** - Wire DepositTab, WithdrawTab, BillsTab
3. **Testing** - Test each flow end-to-end
4. **Admin Dashboard** - Add to admin panel navigation
5. **Documentation** - Create user guides for each payment method
