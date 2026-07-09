# Trimmed draft: PAYWAVE_PHASE_4_COMPLETE.md
# PayWave Phase 4 Complete - Testing & Deployment Guide

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)

## Overview
- **Phase 4A**: UI Component Wiring ✅ COMPLETE
- **Phase 4B**: Webhook Handlers ✅ CREATED
- **Phase 4C**: End-to-End Testing & Deployment (THIS GUIDE)

---

## Phase 4A Status: UI Wiring Complete

### Created Components
1. **DepositTab.jsx** - Three deposit methods integrated
   - Flutterwave (mobile money)

   - Bank account (NIBSS)

3. **BillsTab.jsx** - Already wired (airtime, data, electricity, cable)
   - PIN + 2FA security enabled
   - Real-time balance validation

### Integration Points
All components use:
- `flutterwaveService.js` - Flutterwave checkout
- `TransactionPinModal` - PIN verification
- `TwoFAModal` - 2FA confirmation

---

## Phase 4B Status: Webhook Handlers Deployed

### Three Webhook Functions Created


Process:
```
  ↓
  ↓
  ↓
```

#### 2. webhook-flutterwave/index.ts
Handles Flutterwave events:
- **Duplicate prevention**: Check if already processed

Process:
```
Flutterwave API calls webhook → Verify HMAC-SHA256 signature
  ↓
  ↓
If CHARGE.COMPLETED + SUCCESSFUL: 
  - Find transaction by reference
  - Calculate net_amount
  - Store customer email, phone, card issuer
  ↓
If CHARGE.COMPLETED + FAILED:
  - Mark transaction as failed
  - Store processor response reason
```

#### 3. webhook-xrc-settlement/index.ts
- **Polygon**: Verify transaction via eth_getTransactionReceipt
- **Base**: Verify transaction via eth_blockNumber

Process:
```
  ↓
  ↓
If STATUS = CONFIRMED (1+ confirmations):
  - Create XRC Oracle record
  - Convert USD to NGN (rate: 1500)
  ↓
If STATUS = FAILED:
  - Mark transaction as failed
  - Store failure reason
```

---

## Phase 4C: Testing & Deployment Steps

### Step 1: Deploy Webhook Functions

```bash
# Deploy all three webhook handlers
supabase functions deploy webhook-flutterwave --no-verify-jwt
supabase functions deploy webhook-xrc-settlement --no-verify-jwt
```

Verify deployment:
```bash
supabase functions list
```

You should see:
```
✓ webhook-flutterwave
✓ webhook-xrc-settlement
```


2. Settings → Webhooks
3. Add webhook URL:
   ```
   ```
4. Enable events:
5. Test: Click "Send Test Event"

**Expected Response:**
```json
{
  "success": true,
  "reference": "test-reference-123"
}
```

#### Flutterwave Dashboard Configuration
1. Go: https://dashboard.flutterwave.com
2. Settings → Webhooks
3. Add webhook URL:
   ```
   https://[project-ref].supabase.co/functions/v1/webhook-flutterwave
   ```
4. Secret Key: Already saved in Supabase secrets
5. Test: Use their webhook tester tool

**Expected Response:**
```json
{
  "success": true
}
```

#### XRC Oracle Configuration
1. Contact XRC team for settlement webhook setup
2. Provide endpoint:
   ```
   https://[project-ref].supabase.co/functions/v1/webhook-xrc-settlement
   ```

---


```bash
# 1. User initiates deposit via UI
#    - Returns checkout reference

#    - Updates transaction: status = "completed"

# Expected result:
# - User balance increased ✓
# - Transaction shows "completed" ✓
```

**Manual Test Commands:**
```javascript
// In browser console after logging in

  userId: "user-uuid",
  ngnAmount: 5000,
});

// Expected response:
{
  success: true,
  transaction_id: "uuid-here",
  status: "processing"
}

// After webhook fires - balance should show ₦5000 (minus fee if applicable)
```

```bash
# 1. User enters bank details + amount


# Expected result:
# - Transaction status: pending → completed ✓
# - Bank reference in metadata ✓
```

---

### Step 4: Test Flutterwave Deposit (Sandbox)

#### Test Case 3: Flutterwave Mobile Money
```bash
# 1. User clicks Flutterwave option
# 2. DepositTab calls flutterwaveService.depositViaFlutterwave()
# 3. Edge function: deposit-flutterwave-checkout
#    - Calls Flutterwave API
#    - Returns checkout link

# 4. User redirected to Flutterwave checkout
# 5. Selects MTN MoMo / M-Pesa / Airtel Money

# 7. Flutterwave sends webhook
# 8. webhook-flutterwave:
#    - Verifies signature
#    - Updates transaction status

