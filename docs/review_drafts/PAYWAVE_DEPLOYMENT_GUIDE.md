# Trimmed draft: PAYWAVE_DEPLOYMENT_GUIDE.md
# PayWave Complete System - Quick Start Guide

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)

## 📦 What's Been Built

### ✅ Complete Backend Infrastructure
```
✓ Transaction fee management system
✓ Admin audit logging
```

### ✅ 4 Production Edge Functions
```
✓ deposit-flutterwave-checkout → Pan-Africa mobile money
```

### ✅ 3 Service Layers
```
✓ flutterwaveService.js     → Flutterwave integration
✓ FeeConfigManager.jsx      → Admin dashboard (CEO only)
```

### ✅ UI Fixes
```
```

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migration
```bash
cd /workspaces/GrovaApp

# Apply the migration

# Verify tables created
```

### Step 2: Deploy Edge Functions
```bash


# Deploy Flutterwave deposit
supabase functions deploy deposit-flutterwave-checkout --no-verify-jwt

```

### Step 3: Set Environment Variables in Supabase
```bash
# In Supabase dashboard → Settings → Edge Functions
# Add these secrets:


FLUTTERWAVE_SECRET_KEY=<get-from-flutterwave-dashboard>

POLYGON_RPC_URL=https://polygon-rpc.com
BASE_RPC_URL=https://mainnet.base.org

PUBLIC_URL=https://app.xeevia.com
```

### Step 4: Add Admin Dashboard Route
```jsx
// In your Admin Panel router

```

---

## 📋 File Checklist

### ✅ Created Files
- `supabase/functions/deposit-flutterwave-checkout/index.ts` - Flutterwave

### ✅ Updated Files

---

## 🧪 Quick Testing

```javascript
// In browser console

  userId: "user-uuid-here",
  ngnAmount: 10000,
});

console.log(result);
// Expected: { success: true, transaction_id, reference, status: "processing" }
```

### Test Flutterwave Deposit
```javascript

const result = await flutterwaveService.depositViaFlutterwave({
  userId: "user-uuid-here",
  amount: 10000,
  currency: "NGN",
});

console.log(result);
// Expected: { success: true, checkout_url: "https://checkout.flutterwave.com/..." }
```

```javascript
// In browser console
const { data } = await supabase
  .select("*")
  .eq("user_id", "user-uuid")
  .limit(10);

console.log(data);
```

---

## 🔑 Access Control

### Admin Fee Management
- **CEO Only**: Full access to all fee configurations
- **Super Admin**: Full access to all fee configurations
- **Others**: No access (error message returned)

```javascript
// Only CEO/Super Admin can update fees
  p_admin_id: adminUserId,
  p_transaction_type: 'airtime',
  p_new_fee_percentage: 2.5,
  p_reason: 'Adjusted for market rates'
});
```

---

## 💾 Database Schema Overview

- Includes fee calculations and XRC tracking

- Transaction type → percentage fee mapping
- CEO can edit all percentages
- Audit log tracks all changes

- Tracks verification status
- Stores proof data and block information

- Complete audit trail of admin actions
- Who changed what, when, why
- CEO-only visibility

---

## 🌐 Supported Providers

### Nigeria (Direct)
  - Airtime, Data, Electricity, Cable

### Pan-Africa
- **Flutterwave** ✅ Ready
  - MTN MoMo (Ghana, Cameroon, Uganda)
  - M-Pesa (Kenya)
  - Airtel Money (Pan-Africa)
  - International cards (Visa, Mastercard)

- **Polygon** ✅ Ready
- **Base** ✅ Ready

---

## 📊 Transaction Flow Diagrams

```
User enters phone
    ↓
    ↓
    ↓
    ↓
    ↓
    ↓
    ↓
```

### Flutterwave Deposit
```
User clicks "Mobile Money"
    ↓
POST /deposit-flutterwave-checkout
    ↓
    ↓
Generate Flutterwave checkout link
    ↓
Redirect user to checkout
    ↓
    ↓
    ↓
Flutterwave sends webhook
    ↓
```

```
    ↓
    ↓
