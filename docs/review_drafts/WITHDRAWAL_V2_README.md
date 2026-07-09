# Trimmed draft: WITHDRAWAL_V2_README.md
# Withdrawal System V2 — Production-Grade Model

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)

## Overview


### Key Improvements

✅ **Smart Queueing** — Queue only when system detects genuine congestion
✅ **Tier-Based Limits** — Different limits for free, silver, gold, diamond tiers
✅ **Spam Protection** — Rate limiting, cooldowns, daily caps per tier
✅ **Robust Error Handling** — Automatic retries, audit trails, clear user feedback
✅ **Production Ready** — Handles edge cases, scales, fails gracefully

---

## Tier Configuration

### FREE Tier

### SILVER Tier
- **Processing Fee:** 2%
- **Estimated Time:** ~24 hours

### GOLD Tier
- **Processing Fee:** 1.5%
- **Estimated Time:** ~4 hours

### DIAMOND Tier
- **Daily Limit:** Unlimited
- **Processing Fee:** 1%
- **Estimated Time:** ~1 hour

---

## Spam & Rate Protection

### Protections Implemented

   - Silver: 5 minutes
   - Gold: 3 minutes
   - Diamond: 1 minute

2. **Hourly Rate Limits** (tier-dependent)
   - Diamond: unlimited

3. **Daily Amount & Count Limits** (tier-specific)
   - Enforced per user per day (UTC midnight reset)
   - Prevents account takeover abuse

4. **Cooldown Backoff**
   - Rapid-fire attempts trigger escalating delays

### User Experience

```javascript
// Example: User tries to withdraw again too soon
{
  allowed: false,
  cooldownSeconds: 245
}
```

---

## Smart Queueing Logic

### When to Queue


   - Too many processing; queue for fairness

2. **Recent Error Rate > 30%** (system instability)
   - Pause new processing; let system recover


4. **Database Under Resource Strain** (infrastructure limit)
   - Detected via connection pool or query latency

### User Experience

```javascript
// Healthy system — immediate processing
{
  status: "processing",
  systemWasHealthy: true,
  estimatedHours: 4
}

// Congested system — queued
{
  status: "queued",
  systemWasHealthy: false,
  estimatedHours: 12
}
```

---

## API Usage


```javascript

  userId: "user-uuid",
  usdAmount: 100,
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
//   status: "processing" or "queued",
//   grossUSD: 100,
//   feeUSD: 1.5,
//   netUSD: 98.5,
//   netEP: 9850,
//   estimatedHours: 4,
//   systemWasHealthy: true,
//   dailyRemaining: 9900,
//   dailyCount: 1
// }
```


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

### Update Your Components

```javascript
// OLD

// NEW
```

---

## Error Handling

### Tier-Related Errors

```javascript
// User is on free tier
"Your tier cannot withdraw"



// Daily limit reached
```

### Rate Limit Errors

```javascript
// User tried to withdraw too soon

