# Xeevia Quick Start

## Understand the Product

1. Read [Xeevia Overview](XEEVIA_OVERVIEW.md).
2. Read the [Product Thesis](docs/PRODUCT_THESIS.md).
3. Read the [System Architecture](docs/SYSTEM_ARCHITECTURE.md).
4. Check [Capability Status](docs/CAPABILITY_STATUS.md) before describing a feature as live.
5. Read the [Evidence and Trust Principles](docs/EVIDENCE_AND_TRUST.md).

## Run the Application

```bash
npm install
npm start
```

The application expects the required Supabase environment variables and any provider-specific configuration used by the selected flow.

## Validate the Application

```bash
npm test -- --watchAll=false --runInBand
npm run build
```

For integration work, test the relevant provider, migration, Edge Function, and permission path in addition to the frontend build.

## Core Product Flows

### Connect an identity

A user connects a provider or supplies a profile reference. Xeevia stores the connection state and, where allowed, the provider credential relationship. A connection creates a source-linked identity record but does not automatically verify all activity or claims.

### Build evidence

The evidence layer synchronizes active connections. Native connectors collect permitted provider data. Connected-identity connectors create honest profile-level records where native activity ingestion is not available. Evidence is stored with provider, connection, source, confidence, and metadata context.

### Distribute a post

The Create flow shows only destinations with an active connection, valid publishing credential, and registered publishing adapter. A platform can be available for verification evidence without being available for publishing.

### Inspect verification

The verification dashboard presents evidence sections and relationships. Read the source and confidence state behind each record. “Tracked” and “Verified” are intentionally different states.

## Before a Release

- Confirm the affected capability in [Capability Status](docs/CAPABILITY_STATUS.md).
- Run focused tests and the production build.
- Check Supabase migrations, RLS, OAuth providers, redirect URLs, and Edge Function secrets.
- Test revoked, expired, missing, and provider-error states.
- Confirm that user-facing language matches the evidence actually available.
- Update the relevant operational document.

## Further Reading

Use [Legacy and Operations Index](docs/LEGACY_AND_OPERATIONS.md) to find deployment guides, payment references, boost documentation, handoffs, and historical implementation records.
