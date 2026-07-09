# Trimmed draft: DEPLOYMENT_WEB3_PHASE_1C.md
# Web3 Phase 1C Deployment Guide

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)

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
- All indexes and constraints

---

## Step 2: Set Environment Variables

```bash
# Get from Supabase project settings → Edge Functions secrets

supabase functions secrets set POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
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
```

### NEW: Deploy Now
```bash
# Webhook listener (real-time confirmation processor)

# Polling scheduler (fallback confirmation checker)
```

### Verify Deployment
```bash
# List all deployed functions
supabase functions list

# Should show:
```

---

## Step 4: Update Frontend Environment

**File**: `.env.local` (or your config)

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_KEY=your-anon-key
```

Frontend will automatically use:

---

## Step 5: Test Each Function

```bash
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

```bash
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Expected: `{"success": true, "checked": 0, "updated": 0, "finalized": 0}`

---

## Step 6: Configure External Webhook (Optional)


**Configure webhook to POST to**:
```
```

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


### Manual Path Test
2. Select network (Polygon)
5. Get transaction hash from block explorer
8. Should see: ✓ "Verified! +XX EP credited"

### Automatic Path Test (Phase 1D, when UI ready)
4. Should see real-time confirmation counter
5. Auto-credit when confirmations reach required

---

## Step 8: Monitoring & Debugging

```sql
SELECT id, status, provider, amount_cents, created_at 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Pending Confirmations
```sql
WHERE is_finalized = false;
```

### Check Webhook Events
```sql
ORDER BY received_at DESC 
LIMIT 20;
```

### Check Recent Errors
```bash
# View function logs
```

---

## 🎯 Success Checklist

- [ ] Database migration deployed successfully
- [ ] All RPC URLs set in Supabase secrets
- [ ] CRON_SECRET set for polling function
- [ ] All 5 edge functions deployed
- [ ] Confirmation tracking working
- [ ] Webhook events logged correctly
- [ ] Frontend loads without errors

---

## ⚠️ Important Notes

### BREAKING CHANGE
- UI updated with new input field

### Security
- Webhook listener verifies on-chain before crediting
- Polling function acts as fallback
- Idempotency prevents double-credit

