# Xeevia Documentation

Xeevia is a permissioned identity, contribution, and creator platform. Its long-term purpose is to turn fragmented digital activity into an understandable, inspectable record of identity, contribution, relationships, and outcomes.

This directory contains the canonical product and architecture documents. Root-level implementation notes and deployment guides remain useful, but they should be read as operational or historical material rather than as the product definition.

## Start Here

1. [Product Thesis](PRODUCT_THESIS.md) - what Xeevia is, who it serves, and why it matters.
2. [System Architecture](SYSTEM_ARCHITECTURE.md) - how identity, evidence, XRC, distribution, communities, and economics fit together.
3. [Capability Status](CAPABILITY_STATUS.md) - what is shipped, partial, planned, or dependent on external providers.
4. [Evidence and Trust Principles](EVIDENCE_AND_TRUST.md) - the rules that keep Xeevia honest and useful.
5. [Development Roadmap](ROADMAP.md) - the order of work required to turn the thesis into measurable advantage.
6. [Legacy and Operations Index](LEGACY_AND_OPERATIONS.md) - deployment guides, historical records, and specialist implementation notes.
7. [Ripple Economy](RIPPLE_ECONOMY.md) - the engagement genealogy, settlement rules, and economic invariants.
8. [Patent Invention Disclosure](PATENT_INVENTION_DISCLOSURE.md) - confidential technical disclosure draft for qualified patent counsel.

## Operational Guides

- [Ads Engine Foundation](AD_ENGINE_FOUNDATION.md) - trust-weighted campaign model and explicit build boundary.
- [Help and FAQ](HELP_FAQ.md) - user-facing support content.
- [Sports and News Pipelines](SPORTS_AND_NEWS_PIPELINES.md) - domain-specific pipeline notes.
- [Distribution README](../src/services/distribution/README.md) - cross-platform publishing implementation.
- [Web3 Payment Reference](../WEB3_PAYMENT_SYSTEM_REFERENCE.md) - payment architecture and security model.

## Root Documentation

The root directory contains deployment guides, migration handoffs, integration notes, and historical completion records. These files are intentionally preserved for traceability. When a root document says a feature is "complete" or "production-ready," verify it against [Capability Status](CAPABILITY_STATUS.md) and the source code before treating that claim as current.

## Documentation Rules

- Product claims must distinguish shipped behavior from intended behavior.
- "Verified" must name its source, method, timestamp, and confidence.
- Platform support must distinguish identity connection, evidence ingestion, and publishing permission.
- Payment and trust claims must be backed by deployed migrations, tests, and observable records.
- Historical handoffs should not be used as current capability statements.
