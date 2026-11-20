# Founders Cards

## What users receive

Founders Cards are Xeevia-recorded digital assets. Ownership is stored in the Xeevia database and shown in the user's wallet. This implementation does not mint an NFT or provide ownership on a public blockchain. Transfers, when enabled, move ownership between Xeevia accounts only. No resale price, appreciation, or future monetary value is guaranteed.

The wallet lists cards by tier and serial, and the marketplace shows the fixed supply and current availability. The lowest available serials are reserved in order. Ownership is assigned only after server-side payment verification.

Card checkouts are tagged as `founders_card_purchase` and linked to their order and provider reference. They do not use wallet-deposit records or credit EP. Verified blockchain transaction hashes are globally claimed across card and product payments; migration 133 seeds the claim registry from previously completed Web3 payments to block historical transaction reuse.

The wallet asks each account to select a native currency before continuing. This preference is saved per account on the current device; PayWave is shown for Nigerian profiles or accounts using NGN. The Assets action opens wallet balances and owned cards, while Collections opens the Founders marketplace.

## CEO setup

The **Founders Cards** admin section is restricted to the active `ceo_owner` role.

1. Confirm migrations 131 and 132 are already applied. Apply only pending migrations 133 and 134 after the client/function rollout is coordinated; do not replay older migrations or use a blanket `db push` against production.
2. Deploy `web3-verify-payment`, `verify-2fa-login`, `generate-2fa`, and `verify-2fa-setup` with JWT verification enabled. Keep `paystack-webhook` callable without JWT because it authenticates Paystack's HMAC signature. Configure `TWO_FA_ENCRYPTION_KEY` as a secret with at least 32 characters. Do not use a blanket `--no-verify-jwt` setting.
3. Import the supplied `founders_cards.csv` once. The registry must contain all 1,400 cards: 900 Silver, 300 Gold, 150 Diamond, and 50 VIP. Card codes are private and are not returned in the public catalog.
4. Confirm the currency and price for each tier. The supplied prices are `12`, `25`, `50`, and `100`, but their original currency was unspecified. Prices are therefore unset by default, and sales start disabled.
5. Save the USD price and per-user purchase limit for each tier. The **Sales on/off** switch saves immediately; enabling is blocked until the complete registry and a saved USD price are present. Catalog updates are broadcast to authenticated clients, and an open marketplace refreshes without a page reload.
6. Configure the transfer setting for each tier. This enables Xeevia account transfers, not blockchain transfers.
7. Test checkout, payment verification, expiry, refund follow-up, and wallet issuance in a non-production environment before enabling sales.

Sales cannot be enabled until the full tier registry is imported and USD is explicitly selected. Before import, the marketplace can preview the planned serial slots, but they are not registered or purchasable; availability remains pending rather than displaying zero inventory. Paystack checkout converts the USD price to NGN using `platform_settings.paywall_config.ngn_rate`; verify that setting before sales because the function has a fallback rate. Crypto card checkout is EVM-only (USDC on Polygon, Base, Arbitrum, and Optimism). The authenticated buyer must pay from an EVM address already verified and linked to that Xeevia account; the server checks the transfer sender, token, recipient, amount, and network, then globally claims the transaction hash to prevent reuse across payment types. It requires the corresponding RPC configuration and `TREASURY_WALLET_ADDRESS`.

Turning sales off immediately blocks new reservations at the database. Existing orders retain their reserved price and may complete or expire under their original reservation deadline; a sales toggle does not silently cancel a payment already in progress. Price edits apply to new orders after the database confirms the save. The database rechecks CEO authority, price, currency, registry completeness, and per-user limits; the browser is not the security boundary.

## Reservation and late-payment handling

Reservations expire according to the CEO-configured duration (24 hours by default). Paystack checkout initialization and the first crypto verification attempt refresh that deadline using the current policy. Expired serials are released when a catalog, admin, order, purchase, or payment request runs the expiry routine.

If Paystack confirms payment after the reservation expires, the webhook follows the CEO-configured refund policy instead of issuing a serial that may already belong to another order. Refunds that need manual follow-up appear in the CEO admin section. A crypto transaction still awaiting verification at expiry is flagged for review; a confirmed late crypto payment is recorded as requiring a manual refund and does not issue a card. Reconcile all late-payment entries before closing the related support cases.

## Artwork status

The marketplace currently uses in-app tier previews. The supplied artwork folder is incomplete for production display, so workspace-only artwork paths are not linked from the deployed UI. Publish and verify the complete tier artwork set before replacing the previews.

## Production boundary

This feature is not production-ready until the migration and edge-function changes are deployed, payment secrets and treasury/RPC configuration are verified, provider refunds are tested, and the registry and price currencies are confirmed. Keep sales disabled until those checks pass.
