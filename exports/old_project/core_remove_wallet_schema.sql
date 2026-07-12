-- Revert wallet schema applied accidentally to the Core project
-- WARNING: Review results of the SELECTs below before running the DROP statements.
-- 1) Run the SELECT block to see row counts for each wallet-related table in the Core DB.
-- 2) If counts are zero or you confirm it's safe, run the DROP block to remove the tables.
-- Notes:
--  - This script intentionally does NOT DROP `public.profiles`, `public.connections`, or `public.xrc_records`.
--    Those are shared and may be required by Core/Identity schemas.
--  - DROPs use CASCADE to ensure dependent objects are removed; CASCADE can remove other DB objects.
--  - Back up your DB before running destructive statements if you are unsure.

-- ==========================
-- STEP 1: Inspect row counts
-- ==========================
SELECT 'wallets' AS table_name, count(*) AS rows FROM public.wallets;
SELECT 'wallet_addresses' AS table_name, count(*) AS rows FROM public.wallet_addresses;
SELECT 'wallet_history' AS table_name, count(*) AS rows FROM public.wallet_history;
SELECT 'transactions' AS table_name, count(*) AS rows FROM public.transactions;
SELECT 'payment_products' AS table_name, count(*) AS rows FROM public.payment_products;
SELECT 'payment_intents' AS table_name, count(*) AS rows FROM public.payment_intents;
SELECT 'payments' AS table_name, count(*) AS rows FROM public.payments;
SELECT 'webhook_events' AS table_name, count(*) AS rows FROM public.webhook_events;
SELECT 'subscriptions' AS table_name, count(*) AS rows FROM public.subscriptions;
SELECT 'ep_dashboard' AS table_name, count(*) AS rows FROM public.ep_dashboard;
SELECT 'ep_transactions' AS table_name, count(*) AS rows FROM public.ep_transactions;
SELECT 'ep_treasury' AS table_name, count(*) AS rows FROM public.ep_treasury;
SELECT 'ep_treasury_config' AS table_name, count(*) AS rows FROM public.ep_treasury_config;
SELECT 'withdrawal_queue' AS table_name, count(*) AS rows FROM public.withdrawal_queue;
SELECT 'p2p_payment_methods' AS table_name, count(*) AS rows FROM public.p2p_payment_methods;
SELECT 'p2p_rate_limits' AS table_name, count(*) AS rows FROM public.p2p_rate_limits;
SELECT 'p2p_reputation' AS table_name, count(*) AS rows FROM public.p2p_reputation;
SELECT 'p2p_offers' AS table_name, count(*) AS rows FROM public.p2p_offers;
SELECT 'p2p_trades' AS table_name, count(*) AS rows FROM public.p2p_trades;
SELECT 'p2p_trade_messages' AS table_name, count(*) AS rows FROM public.p2p_trade_messages;
SELECT 'p2p_escrow' AS table_name, count(*) AS rows FROM public.p2p_escrow;
SELECT 'p2p_notifications' AS table_name, count(*) AS rows FROM public.p2p_notifications;
SELECT 'paywave_admin_audit' AS table_name, count(*) AS rows FROM public.paywave_admin_audit;
SELECT 'paywave_transactions' AS table_name, count(*) AS rows FROM public.paywave_transactions;
SELECT 'platform_freeze' AS table_name, count(*) AS rows FROM public.platform_freeze;
SELECT 'platform_liquidity' AS table_name, count(*) AS rows FROM public.platform_liquidity;
SELECT 'platform_revenue' AS table_name, count(*) AS rows FROM public.platform_revenue;
SELECT 'platform_settings' AS table_name, count(*) AS rows FROM public.platform_settings;
SELECT 'liquidity_config' AS table_name, count(*) AS rows FROM public.liquidity_config;
SELECT 'boost_ep_prices' AS table_name, count(*) AS rows FROM public.boost_ep_prices;
SELECT 'admin_revenue_summary' AS table_name, count(*) AS rows FROM public.admin_revenue_summary;
SELECT 'admin_team' AS table_name, count(*) AS rows FROM public.admin_team;
SELECT 'admin_user_stats' AS table_name, count(*) AS rows FROM public.admin_user_stats;
SELECT 'audit_log' AS table_name, count(*) AS rows FROM public.audit_log;
SELECT 'audit_logs' AS table_name, count(*) AS rows FROM public.audit_logs;
SELECT 'bill_payments' AS table_name, count(*) AS rows FROM public.bill_payments;
SELECT 'deep_links' AS table_name, count(*) AS rows FROM public.deep_links;
SELECT 'distribution_deep_links' AS table_name, count(*) AS rows FROM public.distribution_deep_links;
SELECT 'ep_action_rate_limits' AS table_name, count(*) AS rows FROM public.ep_action_rate_limits;
SELECT 'ep_treasury_disbursements' AS table_name, count(*) AS rows FROM public.ep_treasury_disbursements;
SELECT 'ep_treasury_ledger' AS table_name, count(*) AS rows FROM public.ep_treasury_ledger;
SELECT 'gift_cards' AS table_name, count(*) AS rows FROM public.gift_cards;
SELECT 'profile_boosts' AS table_name, count(*) AS rows FROM public.profile_boosts;
SELECT 'reward_pools' AS table_name, count(*) AS rows FROM public.reward_pools;
SELECT 'savings_plans' AS table_name, count(*) AS rows FROM public.savings_plans;
SELECT 'staking_positions' AS table_name, count(*) AS rows FROM public.staking_positions;
SELECT 'user_cards' AS table_name, count(*) AS rows FROM public.user_cards;
SELECT 'web3_auto_payment_sessions' AS table_name, count(*) AS rows FROM public.web3_auto_payment_sessions;
SELECT 'web3_pending_confirmations' AS table_name, count(*) AS rows FROM public.web3_pending_confirmations;
SELECT 'web3_webhook_events' AS table_name, count(*) AS rows FROM public.web3_webhook_events;
SELECT 'xrc_paywave_records' AS table_name, count(*) AS rows FROM public.xrc_paywave_records;

-- ==========================
-- STEP 2: DROP wallet-related tables (run only after you reviewed counts)
-- ==========================
-- NOTE: This intentionally does NOT drop `public.profiles`, `public.connections`, or `public.xrc_records`.

DROP TABLE IF EXISTS public.wallet_history CASCADE;
DROP TABLE IF EXISTS public.wallet_addresses CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.withdrawal_queue CASCADE;
DROP TABLE IF EXISTS public.payment_intents CASCADE;
DROP TABLE IF EXISTS public.payment_products CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.webhook_events CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.ep_transactions CASCADE;
DROP TABLE IF EXISTS public.ep_dashboard CASCADE;
DROP TABLE IF EXISTS public.ep_treasury_config CASCADE;
DROP TABLE IF EXISTS public.ep_treasury CASCADE;
DROP TABLE IF EXISTS public.ep_treasury_disbursements CASCADE;
DROP TABLE IF EXISTS public.ep_treasury_ledger CASCADE;
DROP TABLE IF EXISTS public.ep_action_rate_limits CASCADE;
DROP TABLE IF EXISTS public.p2p_payment_methods CASCADE;
DROP TABLE IF EXISTS public.p2p_rate_limits CASCADE;
DROP TABLE IF EXISTS public.p2p_reputation CASCADE;
DROP TABLE IF EXISTS public.p2p_offers CASCADE;
DROP TABLE IF EXISTS public.p2p_trades CASCADE;
DROP TABLE IF EXISTS public.p2p_trade_messages CASCADE;
DROP TABLE IF EXISTS public.p2p_escrow CASCADE;
DROP TABLE IF EXISTS public.p2p_notifications CASCADE;
DROP TABLE IF EXISTS public.paywave_transactions CASCADE;
DROP TABLE IF EXISTS public.paywave_admin_audit CASCADE;
DROP TABLE IF EXISTS public.paywave_fee_config CASCADE;
DROP TABLE IF EXISTS public.platform_freeze CASCADE;
DROP TABLE IF EXISTS public.platform_liquidity CASCADE;
DROP TABLE IF EXISTS public.platform_revenue CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.liquidity_config CASCADE;
DROP TABLE IF EXISTS public.boost_ep_prices CASCADE;
DROP TABLE IF EXISTS public.admin_revenue_summary CASCADE;
DROP TABLE IF EXISTS public.admin_team CASCADE;
DROP TABLE IF EXISTS public.admin_user_stats CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.bill_payments CASCADE;
DROP TABLE IF EXISTS public.deep_links CASCADE;
DROP TABLE IF EXISTS public.distribution_deep_links CASCADE;
DROP TABLE IF EXISTS public.gift_cards CASCADE;
DROP TABLE IF EXISTS public.profile_boosts CASCADE;
DROP TABLE IF EXISTS public.reward_pools CASCADE;
DROP TABLE IF EXISTS public.savings_plans CASCADE;
DROP TABLE IF EXISTS public.staking_positions CASCADE;
DROP TABLE IF EXISTS public.user_cards CASCADE;
DROP TABLE IF EXISTS public.web3_auto_payment_sessions CASCADE;
DROP TABLE IF EXISTS public.web3_pending_confirmations CASCADE;
DROP TABLE IF EXISTS public.web3_webhook_events CASCADE;
DROP TABLE IF EXISTS public.xrc_paywave_records CASCADE;

-- End of revert script
