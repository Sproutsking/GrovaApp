# Wallet Authentication

Xeevia supports EVM, Solana, and Cardano wallet sign-in as a separate authentication option. This does not replace the existing OAuth providers and does not change wallet connection, deposits, withdrawals, or payment flows.

## Sign-in flow

EVM wallets use Supabase Auth's SIWE (EIP-4361) flow. The SDK signs with the wallet's active EIP-155 chain ID, so Base and other EVM networks do not need chain-specific auth buttons. Solana wallets use Supabase Auth's SIWS-compatible flow.

Cardano uses CIP-30 `signData` and CIP-8 COSE signatures. The `cardano-auth` Edge Function issues a short-lived, single-use challenge, verifies the signature and address/payment key binding server-side, and then generates a one-time Supabase magic-link token. The browser exchanges that token for a normal Supabase session. This bridge does not use OIDC and does not trust a client-provided address or signature. Key-based Shelley base, enterprise, and pointer addresses are supported; script and Byron addresses are rejected because a single CIP-8 payment-key signature cannot prove control of them.

The auth page has one custom wallet picker. It detects injected wallets (including EIP-6963 multi-provider wallets), lists them by chain, and offers WalletConnect/Reown connection options for EVM and Solana wallets that are not injected into the current browser. Desktop users can connect by QR code; mobile users can hand off to a supported wallet app. Cardano remains a CIP-30 wallet-browser flow.

All wallet sign-ins request a message signature only; they do not submit a blockchain transaction or approve a token. Wallet-only accounts have no email recovery, and a wallet connected for payments is not automatically used to authenticate or recover the account. Users must retain access to the wallet used for sign-in.

## Cross-device wallet connection

EVM and Solana QR/deep-link connections use Reown AppKit and its WalletConnect wallet directory. Create a project in the [Reown dashboard](https://dashboard.reown.com), add the production and development domains to its allowed-domain list, and provide its public project ID as `REACT_APP_REOWN_PROJECT_ID` in the frontend build environment. The ID is public configuration, not a secret. Rebuild/redeploy the frontend after setting it.

The configured WalletConnect networks include Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BNB Smart Chain, Gnosis, Linea, Scroll, zkSync, Celo, Fantom, Mantle, Moonbeam, Mode, and Solana. Injected EVM providers use their active chain; WalletConnect connections are limited to the configured network set. The wallet picker continues to show injected EVM/Solana and CIP-30 Cardano wallets if the Reown project ID is missing, but remote/QR connections remain unavailable.

Wallet handoff depends on the selected wallet app, browser, operating system, and Reown's wallet directory. A wallet must support the relevant chain and message-signing method. Cardano does not use this EVM/Solana WalletConnect route; users need a compatible CIP-30 wallet injected into the browser or must open Xeevia in that wallet's built-in browser. No website can guarantee app switching or extension injection in every browser/device configuration.

## Supabase configuration

The repository config enables Ethereum and Solana Web3 auth and sets the Web3 rate limit to 30 requests per IP address per five minutes. For hosted Supabase, verify these settings in the project's Authentication Providers and Rate Limits dashboards; deploying frontend code does not change hosted Auth settings.

1. Enable the Web3 Wallet provider, including Ethereum and Solana.
2. Register the exact sign-in URI with a trailing slash in Auth redirect URLs:
   - `https://app.xeevia.com/`
   - `http://localhost:3000/` and/or `http://127.0.0.1:3000/` for local development.
3. Configure the `cardano-auth` Edge Function secrets:
   - `WEB3_AUTH_ALLOWED_ORIGINS` — comma-separated exact origins, such as `https://app.xeevia.com,http://localhost:3000,http://127.0.0.1:3000` (no trailing slashes).
   - `CARDANO_AUTH_EMAIL_SECRET` — a randomly generated secret of at least 32 characters. Keep it stable; it derives the private synthetic email used to map a Cardano address to its Supabase account and HMACs client IPs for short-window rate limiting. Rotating it will prevent existing Cardano accounts from being found.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the standard Edge Function secrets; never expose the service-role key to the browser.
4. Apply migrations `118_web3_signup_bonus_guard.sql` and `119_cardano_wallet_auth_challenges.sql`.
5. Deploy the Edge Function with JWT verification disabled (it verifies its own one-time wallet challenge):
   ```sh
   supabase functions deploy cardano-auth --no-verify-jwt
   ```
6. Keep rate limits enabled and monitor sign-up volume. Wallet accounts are inexpensive to create and can be used for Sybil abuse. Wallet-authenticated accounts are excluded from the one-time 10 EP welcome grant; other engagement and wallet functionality remains unchanged.

If hosted Web3 auth is not enabled, the UI reports that configuration requirement rather than falling back to trusting a wallet address. Cardano auth fails closed if the Edge Function secrets, allowed origins, challenge migration, or deployment are missing. Existing OAuth sign-in remains available.

## Linking wallets to an existing account

The Account → Identity section can link EVM, Solana, and CIP-30 Cardano wallets to the currently signed-in Xeevia account. This is separate from authentication and from payment-wallet records: linking does not switch accounts or grant token/transaction permissions. The wallet signs a short-lived, single-use message challenge, and the `wallet-identity` Edge Function verifies the signature before recording the link. A wallet address can be linked to only one Xeevia account at a time.

Apply migration `124_verified_wallet_identities.sql`, deploy the `wallet-identity` Edge Function, and configure its `WEB3_AUTH_ALLOWED_ORIGINS`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. The allowed origins can use the same value as `cardano-auth`. The function verifies the signed message separately for EVM, Solana Ed25519, and Cardano CIP-8/CIP-30; the browser's wallet list includes compatible wallets injected into the current browser. Users can unlink a verified wallet from the same Identity section.

## Account and recovery considerations

Wallet authentication proves control of the wallet at sign-in time; it does not establish a person's civil identity, unique personhood, or ownership of other connected accounts. Users who lose access to their signing wallet may lose access to their Xeevia account. The synthetic email used internally for Cardano's Supabase session exchange is not deliverable and cannot be used for recovery.
