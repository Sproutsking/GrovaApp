# Observability checklist

## Metrics to collect
- Boundary request counts by role: identity/core/wallet
- Edge function success/error counts by function name and status code
- Payment transaction state transitions for paywave_transactions
- Wallet balance update failures and retry counts

## Suggested alert thresholds
- Edge function 5xx rate > 2% over 10 minutes
- Wallet boundary failures > 5 consecutive requests
- Payment webhook processing lag > 10 minutes

## Lightweight smoke checks
- curl the health/ready endpoint for each deployed edge function
- log HTTP status codes into a JSONL file for later aggregation
