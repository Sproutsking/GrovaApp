# Web3 wallet deposits

The Web3 option in the wallet's existing **Add Funds** flow credits Engagement Points (EP) after a server-side on-chain verification. It is separate from `web3-verify-payment`, which is for account/product activation.

## Supported deposits

- EVM: USDC and USDT on Ethereum, Polygon, Base, Arbitrum, Optimism, BNB Smart Chain, Avalanche, zkSync Era, and Fantom.
- Solana: USDC and USDT.
- Cardano: ADA.

Native ETH, BNB, SOL, TRX, and TRC-20 USDT are not enabled in this deposit flow. Do not send unsupported assets to the deposit address.

The minimum verified deposit is $1 equivalent. Stablecoins are valued at $1 per token. ADA is valued using the current CoinGecko ADA/USD price; verification fails closed if that quote is unavailable. EP is credited at 100 EP per USD, rounded down.

## Database and Edge Function setup

1. Apply `supabase/migrations/120_web3_wallet_deposits.sql` to the project database.
2. Configure the Supabase Edge Function secrets:
   - `TREASURY_WALLET_EVM` (or the existing `TREASURY_WALLET_ADDRESS`)
   - `TREASURY_WALLET_SOL`
   - `TREASURY_WALLET_ADA`
   - `ETH_RPC_URL`, `POLYGON_RPC_URL`, `BASE_RPC_URL`, `ARBITRUM_RPC_URL`, `OPTIMISM_RPC_URL`, `BSC_RPC_URL`, `AVALANCHE_RPC_URL`, `ZKSYNC_RPC_URL`, and `FANTOM_RPC_URL`
   - `BLOCKFROST_API_KEY`
   - `SOLANA_RPC_URL` is optional; the function uses Solana mainnet's public RPC if it is unset.
3. Deploy `web3-wallet-deposit` with JWT verification enabled:

   ```sh
   supabase functions deploy web3-wallet-deposit
   ```

The function also validates the caller's Supabase access token. Do not grant clients access to the deposit tables or the settlement RPC; the migration restricts them to the service role.

## Deposit verification behavior

The user signs a one-time message with the same wallet that sent the transaction. This proves wallet control but does not authorize or send a transfer. The Edge Function checks the selected network, token contract or mint, treasury recipient, sender, transaction success, and network finality before calling the atomic, idempotent settlement RPC. A transaction can be credited only once per network.

EVM deposits require the network-specific confirmation threshold. Solana deposits must be finalized. Cardano deposits require at least two blocks and a valid Blockfrost transaction record. An unconfirmed transaction remains pending and can be checked again without consuming the wallet proof.
