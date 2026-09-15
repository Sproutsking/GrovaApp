# Xeevia Capability Status

**Status date:** 2026-09-15

This document is the source of truth for whether a capability is shipped, partial, planned, or dependent on external configuration. A feature is not considered production-ready merely because a component or guide exists.

## Shipped or Operationally Present

| Capability | Current state | Evidence in repository |
|---|---|---|
| React application shell | Shipped | `src/App.jsx`, lazy-loaded views, service worker support |
| Supabase authentication | Shipped with provider configuration dependency | `src/services/config/supabase.js`, Auth components |
| Xeevia social publishing surface | Shipped | Create, feed, explore, community, messaging components |
| Wallet and local payment workflows | Broadly implemented; provider deployment still required | Wallet services, Supabase functions, Paystack/OPay guides |
| Identity connection records | Shipped | `connections`, `tokens`, identity and linking services |
| Token-gated distribution destinations | Shipped in application logic | Distribution service, adapter factory, platform selector |
| Evidence item and edge storage | Shipped in schema and services | `evidence_items`, `evidence_edges`, evidence services |
| Complete declared-platform connector registration | Shipped | Native connectors plus connected-identity fallback connectors |
| Human-readable verification dashboard | Shipped | Verification dashboard components and model |
| XRC record verification utilities | Present and usable where records are written correctly | `src/services/xrc/verificationService.js`, hashing and chain services |
| Community verification modes | Shipped at the configured feature level | Community verification components and migrations |

## Partial or Limited

| Capability | Current limitation | Required proof before calling it complete |
|---|---|---|
| Native multi-platform evidence ingestion | Native coverage is narrower than the platform registry; many providers currently produce identity-level evidence | Provider-specific connectors, fixtures, scopes, rate-limit handling, and live sync metrics |
| Cross-platform publishing | Adapters exist for a limited set of providers and require valid external credentials | End-to-end tests with real provider sandboxes, permission checks, media handling, retries, and failure recovery |
| Evidence verification | Some records are tracked rather than verified; confidence is not yet a full policy engine | Source-specific verification rules, freshness, revocation, contradiction handling, and explainable decisions |
| XRC integrity | Hash and chain verification utilities exist, but all event writers and field names must be audited together | Consistent schema contract, append-only enforcement, integration tests, and tamper tests |
| Advertising engine | Foundation and campaign surface exist; delivery, attribution, fraud scoring, and settlement are not complete | Live measured campaigns and reconciliation tests |
| Reputation | Product language describes reputation, but a complete, tested policy model is not established | Context-specific scoring, anti-gaming rules, appeals, decay, and outcome validation |
| Privacy controls | RLS and connection boundaries exist, but evidence visibility and raw payload retention need a full privacy review | Public/private policy matrix, deletion flow, consent logs, and security review |
| Partner relationships | Provider APIs and OAuth settings are external dependencies | Named provider approvals, terms, scopes, and operational contacts |

## Planned

- Provider-native evidence connectors for high-value platforms beyond current native coverage.
- Evidence freshness and decay policies.
- Contradiction and dispute handling.
- User-facing evidence export and selective disclosure.
- Privacy-preserving proofs for narrow eligibility claims.
- Measured creator qualification and campaign attribution.
- Evidence-backed settlement records connected to XRC audit events.
- Provider health dashboards and connector observability.

## Status Language

Use these terms consistently:

- **Connected:** The user has an active relationship or supplied profile reference.
- **Evidence-capable:** The system can create a record from the connection.
- **Verified:** A defined source-specific method supports the claim.
- **Publishable:** A valid provider credential and adapter can perform the requested action.
- **Production-ready:** Deployed configuration, real-provider testing, security review, monitoring, and recovery behavior are complete.

Never use “fully complete,” “certified,” “zero risk,” or “production-ready” without the corresponding operational evidence.
