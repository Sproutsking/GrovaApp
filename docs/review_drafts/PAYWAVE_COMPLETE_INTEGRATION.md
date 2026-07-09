# Trimmed draft: PAYWAVE_COMPLETE_INTEGRATION.md
# PayWave Complete System - Implementation Guide

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)

## ✅ COMPLETED INFRASTRUCTURE

### 1. Database & Backend
- ✅ Admin fee configuration with CEO/Super Admin access

### 2. Edge Functions (Supabase)
- ✅ `deposit-flutterwave-checkout/index.ts` - Pan-Africa mobile money + cards

### 3. Frontend Services
- ✅ `flutterwaveService.js` - Flutterwave integration

### 4. UI Fixes

---

## 🔧 DEPLOYMENT CHECKLIST

### 1. Apply Database Migration
```bash
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy deposit-flutterwave-checkout
```

### 3. Set Environment Variables (Supabase)
```

FLUTTERWAVE_SECRET_KEY=<your-flutterwave-secret-key>

POLYGON_RPC_URL=https://polygon-rpc.com
BASE_RPC_URL=https://mainnet.base.org

PUBLIC_URL=https://app.xeevia.com  # For redirect URLs
```

---

## 🎯 WIRING UI COMPONENTS

### 1. DepositTab.jsx (Multi-Provider Checkout)
```jsx

// Add provider selection

    userId: profile.id,
    ngnAmount: depositAmount,
  });
  if (result.success) {
  }
};

// Handle Flutterwave deposit
const handleFlutterwaveDeposit = async () => {
  const result = await flutterwaveService.depositViaFlutterwave({
    userId: profile.id,
    amount: depositAmount,
    currency: "NGN",
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
      >
      </button>
      <button 
      >
      </button>
      <button 
        onClick={() => setSelectedProvider("flutterwave")}
        className={selectedProvider === "flutterwave" ? "active" : ""}
      >
        🌍 Mobile Money (Flutterwave)
      </button>
    </div>

    {/* Forms for each provider */}
      <div>
        <input 
          value={userPhone}
          onChange={(e) => setUserPhone(e.target.value)}
        />
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

```jsx


const handleBankWithdraw = async () => {
    userId: profile.id,
    amount: withdrawAmount,
    bankAccount: accountNumber,
    bankCode: bankCode,
    accountName: accountName,
  });
  if (result.success) {
  }
};

    userId: profile.id,
    amount: withdrawAmount,
  });
  if (result.success) {
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
      >
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

      <div>
      </div>
    )}
  </div>
);
```

### 3. BillsTab.jsx (Airtime, Data, TV, Electricity)
```jsx

// Airtime
const handleBuyAirtime = async (network, phone, amount) => {
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
    userId: profile.id,
    provider,
    meterNumber: meter,
