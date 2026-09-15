# Xeevia Platform Overview

## Product Definition

Xeevia turns the parts of a person's digital life that they choose to connect into a coherent, permissioned, and inspectable record of identity, contribution, relationships, and outcomes.

The user-facing experience is a social and creator platform. The deeper system is an evidence layer that helps people and organizations understand what a person has done, where they have contributed, and what supports each claim.

## The Three Layers

### Social surface

- Content creation, media, discovery, and feeds
- Communities, direct messages, group conversations, and notifications
- Creator profiles, presentation, and premium tools
- Cross-platform publishing where provider permissions and adapters support it

### Evidence layer

- User-authorized identity connections
- Provider-linked profile and activity records
- Normalized evidence items and relationships
- Source, timestamp, confidence, permission, and revocation context
- Human-readable verification dashboards and evidence trails
- XRC audit records for selected application events

### Value layer

- Xeevia wallets and EP credits
- Local payment and settlement integrations
- Web3 payment flows and confirmation tracking
- Creator rewards and profile boosts
- Campaign, attribution, and future evidence-backed settlement infrastructure

The layers are related but should not be conflated. A payment is not identity proof. A connected profile is not automatically verified activity. A hash is not external truth.

## Why It Matters

People's professional, creative, technical, social, community, and economic histories are fragmented across separate services. Xeevia aims to make authorized evidence portable and understandable without claiming ownership of a person's whole digital life.

The central product question is:

> What connected identities, contributions, relationships, and outcomes can this person demonstrate, and what evidence supports each claim?

## Identity and Google

Google Identity authenticates control of a Google account. Xeevia uses authentication as one possible input into a broader contribution record that may include multiple authorized platforms, projects, communities, domains, wallets, and outcomes.

Xeevia is not a replacement for Google authentication. It is a context and evidence layer above individual account authentication.

## Platform Integrations

Xeevia distinguishes three forms of platform support:

1. **Identity connection** - the account or profile is linked to Xeevia.
2. **Evidence ingestion** - Xeevia can collect permitted source records.
3. **Publishing** - Xeevia can publish using a valid credential, provider permission, and registered adapter.

A platform may support one, two, or all three. The current state is documented in [docs/CAPABILITY_STATUS.md](docs/CAPABILITY_STATUS.md).

## Technology

- React 18 and Create React App frontend
- Supabase authentication, database, realtime, storage, and Edge Functions
- Evidence items and edges stored in normalized tables
- XRC hash-chain utilities for selected audit records
- Provider connectors and publishing adapters
- Progressive Web App support
- Wallet, local payment, and Web3 integration services

## Product Principles

- Permission before collection
- Evidence before claims
- Explainability before scoring
- User control before exposure
- Quality before volume
- Attribution before settlement
- Native provider support before broad marketing claims

## Current Product Position

Xeevia has a substantial social, community, wallet, and integration foundation. Its strategic advantage is still being built. The highest-value work is improving native evidence coverage, evidence freshness and provenance, privacy controls, explainable decisions, attribution, and measurable outcomes.

For the current truth status, read [docs/CAPABILITY_STATUS.md](docs/CAPABILITY_STATUS.md), not historical completion summaries.
