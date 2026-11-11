# Wallet withdrawals

## Current flow

Only Nigerian bank payouts through Paystack are enabled. Crypto and PayPal are
not available until their payout, failure, and refund paths are implemented.
New withdrawals are initiated immediately; reward level controls eligibility
and per-request limits, not payout priority. Historical queued or batched
records are not automatically released or paid and require reconciliation.

The withdrawal screen submits an authenticated request to
`initiate_direct_withdrawal`. The database function derives the user's reward
level and the current fee, exchange rate, and limits from server-side
configuration. In one transaction it validates the request and PIN, checks
the wallet balance and rate limits, records the transaction, debits EP, and
writes wallet and EP ledger entries.

The withdrawal row starts in `processing` with a server-generated,
stable Paystack reference and a `ready` payout state. The
`withdraw-paystack-init` Edge Function claims it once, creates the Paystack
recipient, and submits the bank transfer using that same reference. Transfer
success, failure, and reversal events are settled through
`settle_withdrawal_paystack_event`, which atomically updates the withdrawal,
transaction, wallet, and ledgers. Duplicate provider events are idempotent.

If Paystack definitively rejects a request before accepting the transfer, the
same settlement function refunds the full EP amount atomically. If the
provider response is ambiguous (for example, a network timeout after submit),
the EP remains reserved and the record is marked for reconciliation rather
than risking a duplicate payout or an incorrect refund.

## Policy defaults

These are defaults from `liquidity_config`; the server enforces the current
configured values.

- Minimum request: 500 EP ($5 at 100 EP per USD)
- Per-request caps: Silver $1,000, Gold $10,000, Diamond $50,000
- Platform fee: 2% flat
- Daily cap: 50,000 EP per account
- Cooldown: five minutes between requests, up to six per hour
- PIN required for requests of 10,000 EP or more

The server stores the exchange-rate quote with each request. Later changes to
the configured rate do not change an existing payout amount.

## Deployment requirements

Before enabling withdrawals in production:

1. Review and apply `supabase/migrations/127_fair_immediate_withdrawals.sql`
   against the actual database schema.
2. Deploy `withdraw-paystack-init` and `withdraw-paystack-webhook`.
3. Configure `PAYSTACK_SECRET_KEY` and register the webhook URL in Paystack.
4. Verify the Paystack transfer balance, bank resolution, success/failure/
   reversal webhooks, and refund ledger entries in a controlled environment.
5. Monitor records marked `reconciliation_required`; do not refund or retry
   them until the Paystack reference has been checked.

The code changes alone do not mean the migration or Edge Functions are live.
Production deployment and provider reconciliation have not been verified from
this repository.
