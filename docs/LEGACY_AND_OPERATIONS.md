# Legacy and Operations Index

Root-level documents are preserved because they contain deployment history, implementation notes, migration context, and handoff information. They are not all current product specifications.

## Canonical Product Documents

Read these first:

- [Product thesis](PRODUCT_THESIS.md)
- [System architecture](SYSTEM_ARCHITECTURE.md)
- [Capability status](CAPABILITY_STATUS.md)
- [Evidence and trust principles](EVIDENCE_AND_TRUST.md)
- [Roadmap](ROADMAP.md)

## Current Operational Guides

- [Ads engine foundation](AD_ENGINE_FOUNDATION.md)
- [Help and FAQ](HELP_FAQ.md)
- [Sports and news pipelines](SPORTS_AND_NEWS_PIPELINES.md)
- [Distribution implementation guide](../src/services/distribution/README.md)
- [Web3 payment system reference](../WEB3_PAYMENT_SYSTEM_REFERENCE.md)
- [Deployment guide](../DEPLOYMENT.md)

## Root Guides by Area

### Identity, evidence, and product integration

- `XEEVIA_OVERVIEW.md` - current product overview.
- `XEEVIA_QUICK_START.md` - current contributor and operator quick start.
- `INTEGRATION_GUIDE.md` - broader integration notes.
- `FEATURES_IMPLEMENTATION.md` - feature inventory; verify against source.
- `MASSIVE_FEATURES_COMPLETED.md` - historical delivery record; not a current status authority.

### Distribution and social publishing

- `src/services/distribution/README.md` - implementation details.
- `src/services/distribution/INTEGRATION_GUIDE.js` - integration patterns.
- `XEEVIA_INTEGRATION_EXAMPLE.js` - example wiring.
- `POSTFULLSCREEN_INTEGRATION.md` - feature-specific integration notes.

### Wallet, payments, and provider deployment

- `PAYWAVE_COMPLETE_INTEGRATION.md`
- `PAYWAVE_DEPLOYMENT_GUIDE.md`
- `PAYWAVE_OPAY_FIXES.md`
- `OPAY_INTEGRATION.md`
- `WITHDRAWAL_V2_README.md`
- `WEB3_PAYMENT_SYSTEM_REFERENCE.md`
- `DEPLOYMENT_WEB3_PHASE_1C.md`
- `WEB3_PHASE_1C_COMPLETION.md`
- `FCM_DEPLOYMENT_NEXT_STEPS.md`
- `PUSH_NOTIFICATION_TROUBLESHOOTING.md`

These documents require deployment verification, environment secrets, provider configuration, and live tests before their claims can be treated as operational status.

### Profile boost and visual delivery

- `README_BOOST_SYSTEM.md`
- `BOOST_SYSTEM_COMPLETE.md`
- `BOOST_INTEGRATION_GUIDE.md`
- `IMPLEMENTATION_CHECKLIST.md`
- `DESIGN_REFERENCE.md`
- `VISUAL_OVERVIEW.md`
- `DELIVERY_SUMMARY.md`
- `PRODUCTION_READINESS_VERIFICATION.md`
- `PRODUCTION_READY_SUMMARY.md`

These are implementation and delivery records. Their “complete” language should be interpreted as the state at the time of writing and checked against current source, migrations, and deployed configuration.

### Handoffs, investigations, and historical records

- `APP_INVESTIGATION_REPORT.md`
- `HANDOFF_PHASE_1D.md`
- `PHASE_1D_HANDOFF_PROMPT.txt`
- `IMPLEMENTATION_SUMMARY.md`
- `IMPLEMENTATION_SUMMARY.txt`
- `00_DELIVERY_COMPLETE.md`
- `IMAGE_RENDERING_FIX_COMPLETE.md`
- `PR_CHECKLIST_PAYWAVE.md`
- `MEDIA_PERFORMANCE_ROADMAP_2026-08-20.md`
- `BOTTOM_NAV_PAYWAVE_DOM_APPROACH.md`

These should be retained for traceability, but they should not be used as a substitute for the current capability ledger.

## Maintenance Rule

When a feature changes:

1. Update the source and tests.
2. Update [CAPABILITY_STATUS.md](CAPABILITY_STATUS.md).
3. Update the relevant operational guide.
4. Add the date and deployment dependency if the change requires provider or Supabase configuration.
5. Avoid using “complete” or “production-ready” without executable validation and live configuration evidence.
