PR checklist — PayWave / OPay changes

- [ ] Includes `migrations/opay_rpcs.sql` with new RPCs deployed to Supabase.
- [ ] `src/services/wallet/opayService.js` added and exported.
- [ ] `src/models/WalletModel.js` exports `epToNgn` helper.
- [ ] `src/services/wallet/walletService.js` updated to compute EP→NGN using `fetchPaywallConfig()`.
- [ ] Bills UI (`BillsTab.jsx`) wired to `opayService` methods.
- [ ] Unit tests added: `rates.test.js`, `opayService.test.js` — run and pass.
- [ ] Manual QA checklist completed (see below).

Manual QA checklist:
- Deploy SQL migrations to Supabase (run the SQL file).
- Verify RPCs exist in Supabase and return expected JSON shape.
- On staging, perform an airtime purchase and confirm `bill_payments` row is created and RPC returns success.
- Verify EP→NGN conversion: set `platform_settings.paywall_config.ngn_rate` to known value (e.g., 1600) and confirm 100 EP shows as ₦1600 in wallet UIs.
- Check UI validation: phone number cleaning, meter number length, min amounts enforced.
- Confirm error messages surface to users and transient RPC errors are retried (server-side recommended).

