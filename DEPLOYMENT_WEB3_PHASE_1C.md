# Web3 Phase 1C Deployment Guide

**Date**: 2026-06-29  
**Commit**: c35d9eb  
**Status**: Ready for production deployment  

---

## 🚀 Quick Deployment

### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Verify project connection
supabase projects list
```

---

## Step 1: Deploy Database Migration

```bash
cd /workspaces/GrovaApp

# Push migration to Supabase
supabase db push

# Verify tables created
supabase db list
```

**Includes**:
- `web3_webhook_events` table
- `web3_pending_confirmations` table  
- `web3_auto_payment_sessions` table
- `finalize_web3_payment()` RPC function
- `get_web3_payment_status()` RPC function
- All indexes and constraints

---

## Step 2: Set Environment Variables

```bash
# Get from Supabase project settings → Edge Functions secrets

supabase functions secrets set ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
supabase functions secrets set POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
supabase functions secrets set SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
supabase functions secrets set BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
supabase functions secrets set ARBITRUM_RPC_URL="https://arbitrum-mainnet.g.alchemy.com/v2/YOUR_KEY"
supabase functions secrets set OPTIMISM_RPC_URL="https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY"
supabase functions secrets set TRON_RPC_URL="https://api.tronstack.io"
supabase functions secrets set CARDANO_RPC_URL="https://cardano-mainnet.blockfrost.io/api/v0"
supabase functions secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

---

## Step 3: Deploy Edge Functions (In Order)

### Already Deployed (verify status)
```bash
supabase functions deploy web3-initiate-payment
supabase functions deploy web3-submit-payment
supabase functions deploy web3-payment-status
supabase functions deploy web3-verify-payment
```

### NEW: Deploy Now
```bash
# Webhook listener (real-time confirmation processor)
supabase functions deploy web3-webhook-listener

# Polling scheduler (fallback confirmation checker)
supabase functions deploy web3-poll-pending --cron "*/30 * * * * *"
```

### Verify Deployment
```bash
# List all deployed functions
supabase functions list

# Should show:
# ✓ web3-initiate-payment
# ✓ web3-submit-payment
# ✓ web3-payment-status
# ✓ web3-verify-payment
# ✓ web3-webhook-listener
# ✓ web3-poll-pending (with cron: */30 * * * * *)
```

---

## Step 4: Update Frontend Environment

**File**: `.env.local` (or your config)

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_KEY=your-anon-key
```

Frontend will automatically use:
- `web3PaymentService.js` for automatic wallet payments
- `depositFundService.js` with sender wallet validation for manual payments
- `useWalletConnect.js` for 12+ wallet detection

---

## Step 5: Test Each Function

### 1. Test web3-webhook-listener
```bash
curl -X POST https://your-project.supabase.co/functions/v1/web3-webhook-listener \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "chainType": "EVM",
    "chainName": "polygon",
    "confirmations": 5,
    "blockNumber": 45000000,
    "eventType": "confirmed",
    "fromWebhook": false
  }'
```

Expected: 404 (no pending confirmation) — that's correct for test

### 2. Test web3-poll-pending (manual)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/web3-poll-pending \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Expected: `{"success": true, "checked": 0, "updated": 0, "finalized": 0}`

---

## Step 6: Configure External Webhook (Optional)

If using external blockchain event listener (e.g., Alchemy Webhook, Moralis, Quicknode):

**Configure webhook to POST to**:
```
https://your-project.supabase.co/functions/v1/web3-webhook-listener
```

**Payload format**:
```json
{
  "txHash": "0x...",
  "chainType": "EVM",
  "chainName": "polygon",
  "confirmations": 5,
  "blockNumber": 12345678,
  "eventType": "confirmed",
  "fromWebhook": true
}
```

---

## Step 7: Verify Payment Flow (E2E Test)

### Manual Path Test
1. Go to Wallet → Deposit tab → Manual/Receive
2. Select network (Polygon)
3. Copy treasury address
4. Send small amount of USDC/USDT to that address from own wallet
5. Get transaction hash from block explorer
6. Return to app → Enter TX hash + sender wallet address
7. Click "Verify & Credit Wallet"
8. Should see: ✓ "Verified! +XX EP credited"

### Automatic Path Test (Phase 1D, when UI ready)
1. Go to Wallet → Deposit tab → Quick Pay (auto)
2. Select wallet and amount
3. Approve in wallet
4. Should see real-time confirmation counter
5. Auto-credit when confirmations reach required

---

## Step 8: Monitoring & Debugging

### Check Payment Status
```sql
SELECT id, status, provider, amount_cents, created_at 
FROM payments 
WHERE provider = 'web3' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Pending Confirmations
```sql
SELECT payment_id, current_confirmations, required_confirmations, is_finalized 
FROM web3_pending_confirmations 
WHERE is_finalized = false;
```

### Check Webhook Events
```sql
SELECT payment_id, event_type, confirmations, received_at 
FROM web3_webhook_events 
ORDER BY received_at DESC 
LIMIT 20;
```

### Check Recent Errors
```bash
# View function logs
supabase functions logs web3-webhook-listener --tail
supabase functions logs web3-poll-pending --tail
```

---

## 🎯 Success Checklist

- [ ] Database migration deployed successfully
- [ ] All RPC URLs set in Supabase secrets
- [ ] CRON_SECRET set for polling function
- [ ] All 5 edge functions deployed
- [ ] Manual payment test successful
- [ ] Confirmation tracking working
- [ ] Webhook events logged correctly
- [ ] Frontend loads without errors

---

## ⚠️ Important Notes

### BREAKING CHANGE
- Manual verification now **requires sender wallet address**
- UI updated with new input field
- Prevents wallet spoofing/fraud

### Security
- Webhook listener verifies on-chain before crediting
- Polling function acts as fallback
- Idempotency prevents double-credit
- Per-chain wallet format validation

### Production Readiness
- ✅ All security patterns implemented
- ✅ Error recovery included
- ✅ Idempotency guaranteed
- ✅ Real-time confirmation tracking
- ✅ 24-hour confirmation expiry

---

## Next Phase (1D)

After deployment verification:
1. Create `QuickPayTab.jsx` for automatic wallet payment UI
2. Add wallet selection modal
3. Add real-time confirmation progress bar
4. Add error recovery flows

See: `WEB3_PHASE_1C_COMPLETION.md` for complete documentation

---

**Deployed by**: GitHub Actions / Manual CLI  
**Tested on**: Polygon Mumbai / Ethereum Sepolia (testnet)  
**Production**: Polygon / Ethereum (mainnet after testing)
