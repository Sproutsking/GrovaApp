# Withdrawal System V2 — Production-Grade Model

## Overview

The new withdrawal system eliminates unnecessary queueing while implementing tier-based limits, spam protection, and smart queueing for actual congestion scenarios.

### Key Improvements

✅ **No Unnecessary Queueing** — Withdrawals process immediately on healthy systems
✅ **Smart Queueing** — Queue only when system detects genuine congestion
✅ **Tier-Based Limits** — Different limits for free, silver, gold, diamond tiers
✅ **Spam Protection** — Rate limiting, cooldowns, daily caps per tier
✅ **Robust Error Handling** — Automatic retries, audit trails, clear user feedback
✅ **Production Ready** — Handles edge cases, scales, fails gracefully

---

## Tier Configuration

### FREE Tier
- **Withdrawals:** Not allowed (upgrade required message)

### SILVER Tier
- **Min/Max Per Withdrawal:** $5 – $500
- **Daily Limit:** $2,000 (14 withdrawals max)
- **Processing Fee:** 2%
- **Estimated Time:** ~24 hours
- **Rate Limit:** 1 withdrawal per 5 minutes, max 6 per hour

### GOLD Tier
- **Min/Max Per Withdrawal:** $5 – $2,000
- **Daily Limit:** $10,000 (50 withdrawals max)
- **Processing Fee:** 1.5%
- **Estimated Time:** ~4 hours
- **Rate Limit:** 1 withdrawal per 3 minutes, max 20 per hour

### DIAMOND Tier
- **Min/Max Per Withdrawal:** $5 – $10,000
- **Daily Limit:** Unlimited
- **Processing Fee:** 1%
- **Estimated Time:** ~1 hour
- **Rate Limit:** 1 withdrawal per minute, unlimited per hour

---

## Spam & Rate Protection

### Protections Implemented

1. **Minimum Interval Between Withdrawals** (tier-dependent)
   - Silver: 5 minutes
   - Gold: 3 minutes
   - Diamond: 1 minute

2. **Hourly Rate Limits** (tier-dependent)
   - Silver: max 6 withdrawals/hour
   - Gold: max 20 withdrawals/hour
   - Diamond: unlimited

3. **Daily Amount & Count Limits** (tier-specific)
   - Enforced per user per day (UTC midnight reset)
   - Prevents account takeover abuse

4. **Cooldown Backoff**
   - Rapid-fire attempts trigger escalating delays
   - Example: User attempts 3 withdrawals in 10 seconds → forced cooldown

### User Experience

```javascript
// Example: User tries to withdraw again too soon
{
  allowed: false,
  error: "Please wait 245s before next withdrawal",
  cooldownSeconds: 245
}
```

---

## Smart Queueing Logic

### When to Queue

System queues a withdrawal **ONLY IF**:

1. **Pending Withdrawals >= 50** (system overload)
   - Too many processing; queue for fairness

2. **Recent Error Rate > 30%** (system instability)
   - Last 10 withdrawals: >3 failures
   - Pause new processing; let system recover

3. **Paystack Response Time > 5 seconds** (payment processor slow)
   - Payment gateway throttled; don't hammer it

4. **Database Under Resource Strain** (infrastructure limit)
   - Detected via connection pool or query latency

### User Experience

```javascript
// Healthy system — immediate processing
{
  status: "processing",
  message: "Your withdrawal is being processed.",
  systemWasHealthy: true,
  estimatedHours: 4
}

// Congested system — queued
{
  status: "queued",
  message: "Your withdrawal is queued due to high system traffic. It will be processed soon.",
  systemWasHealthy: false,
  estimatedHours: 12
}
```

---

## API Usage

### Initiate Withdrawal

```javascript
import withdrawServiceV2 from "src/services/wallet/withdrawServiceV2";

const result = await withdrawServiceV2.initiateWithdrawal({
  userId: "user-uuid",
  usdAmount: 100,
  method: "bank", // "bank" | "crypto" | "paypal"
  fields: {
    bank: "GTBank",
    accountNumber: "0123456789",
    accountName: "John Doe",
    bankCode: "058", // optional
  },
  pin: "1234", // required if amount >= $100
});

// Response:
// {
//   id: "withdrawal-uuid",
//   status: "processing" or "queued",
//   grossUSD: 100,
//   feeUSD: 1.5,
//   netUSD: 98.5,
//   netEP: 9850,
//   estimatedHours: 4,
//   systemWasHealthy: true,
//   message: "Your withdrawal is being processed.",
//   dailyRemaining: 9900,
//   dailyCount: 1
// }
```

### Get Withdrawal Preview

```javascript
const preview = await withdrawServiceV2.getPreview(userId, tier, 100); // $100 USD

// Response:
// {
//   valid: true,
//   grossUSD: 100,
//   feeUSD: 1.5,
//   netUSD: 98.5,
//   grossEP: 10000,
//   feeEP: 150,
//   netEP: 9850,
//   ngnRate: 1520,
//   netNGN: 150070,
//   estimatedHours: 4,
//   dailyRemaining: 9900
// }
```

### Get User Stats

```javascript
const stats = await withdrawServiceV2.getUserWithdrawalStats(userId);

// Response:
// {
//   dailyUsedUSD: 250,
//   dailyUsedEP: 25000,
//   dailyPendingUSD: 50,
//   dailyPendingEP: 5000,
//   dailyCount: 3,
//   totalRequestedUSD: 300,
//   totalRequestedEP: 30000
// }
```

---

## Migration from V1

### Old Service → New Service Mapping

| Old | New | Notes |
|-----|-----|-------|
| `withdrawService.queueWithdrawal()` | `withdrawServiceV2.initiateWithdrawal()` | New params; same endpoint logic |
| `withdrawService.getWithdrawalHistory()` | `withdrawServiceV2.getWithdrawalHistory()` | Compatible; no changes needed |
| `withdrawService.MIN_WITHDRAWAL_EP` (100) | `withdrawServiceV2.MIN_WITHDRAWAL_EP` (500) | **BREAKING: Now 500 EP = $5 USD** |
| `withdrawService.getWithdrawalPreview()` | `withdrawServiceV2.getPreview()` | New name; requires tier param |

### Update Your Components

```javascript
// OLD
import withdrawService from "src/services/wallet/withdrawService";
const result = await withdrawService.queueWithdrawal({ ... });

// NEW
import withdrawServiceV2 from "src/services/wallet/withdrawServiceV2";
const result = await withdrawServiceV2.initiateWithdrawal({ ... });
```

---

## Error Handling

### Tier-Related Errors

```javascript
// User is on free tier
"Your tier cannot withdraw"

// Withdrawal below minimum ($5)
"Minimum withdrawal is $5 USD"

// Withdrawal above tier limit ($2000 for silver)
"Maximum per withdrawal is $500 USD for your tier"

// Daily limit reached
"Daily withdrawal limit ($2000) reached"
"This withdrawal would exceed your daily limit. Remaining: $1750"
```

### Rate Limit Errors

```javascript
// User tried to withdraw too soon
"Please wait 245s before next withdrawal"

// Hourly quota exceeded
"Hourly withdrawal limit (6) reached"
```

### System Errors

```javascript
// Could not fetch profile
"Could not fetch user profile"

// Invalid destination
"Account number must be 10 digits (NUBAN)"
"Please enter a valid PayPal email address"
"Wallet address too short"
```

---

## Database Schema (withdrawal_queue)

```sql
CREATE TABLE withdrawal_queue (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  ep_amount BIGINT NOT NULL,
  usd_amount DECIMAL(10,2) NOT NULL,
  processing_tier TEXT, -- "silver" | "gold" | "diamond"
  fee_pct DECIMAL(5,2), -- e.g., 1.5
  fee_ep BIGINT,
  net_ep BIGINT,
  status TEXT, -- "processing" | "queued" | "completed" | "failed" | "cancelled"
  destination_type TEXT, -- "bank" | "crypto" | "paypal"
  destination_info JSONB,
  pin_verified BOOLEAN DEFAULT FALSE,
  ngn_rate DECIMAL(10,2),
  requested_at TIMESTAMP DEFAULT NOW(),
  estimated_at TIMESTAMP,
  processed_at TIMESTAMP,
  error_msg TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_queue_user ON withdrawal_queue(user_id);
CREATE INDEX idx_withdrawal_queue_status ON withdrawal_queue(status);
```

---

## Testing Scenarios

### Scenario 1: Single User, Healthy System
- **Expected:** Immediate processing (no queue)
- **Test:** User withdraws $10 → status: "processing"

### Scenario 2: User at Daily Limit
- **Expected:** Rejected with clear message
- **Test:** User has withdrawn $2000 today → tries $100 → "Daily limit reached"

### Scenario 3: Rapid-Fire Attempts
- **Expected:** Rate limit enforced
- **Test:** User attempts 3 withdrawals in 30s → 2nd blocked with cooldown

### Scenario 4: System Congestion
- **Expected:** Queued for later processing
- **Test:** >50 pending withdrawals exist → new withdrawal status: "queued"

---

## Production Deployment

1. **Deploy WithdrawalModel.js** (models)
2. **Deploy withdrawServiceV2.js** (services)
3. **Update UI components** to use new service
4. **Run database migrations** if needed (schema updates)
5. **Test with real tier users** (silver, gold, diamond)
6. **Monitor for spam/abuse** (rate limits working?)
7. **Monitor withdrawal success rate** (edge function reliability)

---

## Future Enhancements

- [ ] Multi-step verification for large withdrawals (>$1000)
- [ ] Auto-conversion between currencies (USD → NGN → fiat payout)
- [ ] Webhook notifications (withdrawal approved/processed/failed)
- [ ] Dispute resolution system
- [ ] Admin dashboard for manual processing
- [ ] Advanced analytics dashboard (withdrawal trends, fee totals)
- [ ] Recurring withdrawal scheduling
- [ ] Whitelist saved beneficiary accounts
