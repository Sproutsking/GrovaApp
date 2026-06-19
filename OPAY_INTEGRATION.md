# OPay Integration — Notes

This document describes the current OPay bill-payment integration added for Grova PayWave.

New Supabase RPCs in `migrations/opay_rpcs.sql`:
- `opay_buy_airtime(p_user_id uuid, p_network text, p_phone text, p_amount numeric)`
- `opay_buy_data(p_user_id uuid, p_network text, p_phone text, p_plan_id text, p_amount numeric)`
- `opay_buy_electricity(p_user_id uuid, p_provider text, p_meter_number text, p_meter_type text, p_amount numeric, p_customer_name text)`
- `opay_buy_cable(p_user_id uuid, p_provider text, p_smart_card text, p_package_id text, p_amount numeric)`

Client-side changes:
- `src/services/wallet/opayService.js` implements `buyAirtime`, `buyData`, `buyElectricity`, and `buyCable` wrappers.
- `src/components/wallet/paywave/tabs/BillsTab.jsx` now calls `opayService` instead of inserting directly into `bill_payments`.
- `src/models/WalletModel.js` adds `epToNgn(ngnRate, epAmount)` and keeps the PayWave conversion helper consistent with the app's canonical rates.
- `src/services/wallet/walletService.js` now derives NGN wallet values from `platform_settings.paywall_config.ngn_rate`.

Testing:
- `src/services/wallet/__tests__/rates.test.js`
- `src/services/wallet/__tests__/opayService.test.js`

Notes:
- The SQL RPC implementations currently record bill payments in `bill_payments` and return a consistent JSON response.
- In production, replace the RPC bodies with actual OPay API calls, webhooks, and stronger server-side validation.
