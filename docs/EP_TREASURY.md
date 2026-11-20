# EP Treasury

The admin **Platform treasury wallet** is an internal Engagement Points (EP) ledger, not a blockchain wallet. Its partitions are accounting buckets inside Xeevia; it cannot custody or transfer USDC, USDT, or other on-chain assets. The CEO send action requires the CEO role, a verified transaction PIN, and enabled account 2FA. Database functions perform balance changes and write ledger entries atomically. Incorrect PINs are recorded and lock the PIN after five attempts for 15 minutes, including attempts through the CEO send RPC.

Setting or changing a PIN requires a fresh authenticator-app code. The server issues a five-minute, single-use authorization bound to the signed-in user and PIN-change action; the PIN form stays open and resumes after verification. A TOTP time step cannot be reused for another PIN authorization, and backup codes are consumed atomically so concurrent requests cannot reuse them. If 2FA is not enabled, the flow offers setup and returns to the pending PIN action afterward.

New PINs use bcrypt, and an existing SHA-256 PIN hash is upgraded to bcrypt after a successful verification. All server-side withdrawal and treasury PIN checks use the shared verifier so both formats work during rollout. The 2FA encryption key `TWO_FA_ENCRYPTION_KEY` must be configured as a secret with at least 32 characters; new TOTP secrets use AES-GCM, and legacy XOR secrets are upgraded after successful verification.

## Fee provenance

[`134_ep_treasury_fee_provenance.sql`](../supabase/migrations/134_ep_treasury_fee_provenance.sql) records treasury inflows by source category: transaction fees, commissions, deposit fees, withdrawal fees, or other. CEO reporting shows credits already represented in the ledger by category and source labels for recent activity. Successful wallet-withdrawal fees are credited only when the payout completes; failed payouts refund the full EP amount and do not leave a treasury fee behind. Historical withdrawal fees are not credited retroactively, because that would change treasury balances; reconcile them separately before any backfill.

The current deposit flow does not route deposit fees into this ledger. A category label does not imply a source is connected; any future deposit-fee policy must be implemented in its server-side settlement transaction before reporting it as treasury revenue.

## On-chain treasury boundary

To custody crypto, use a separate multisig treasury with a documented signer and recovery policy. Do not put private keys or signing seeds in the application, browser, or ordinary Supabase environment variables. An app-side EP ledger is not proof of on-chain ownership, and an admin role must not be able to sign blockchain transactions by itself.
