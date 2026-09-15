# Xeevia

Xeevia is a permissioned identity, contribution, and creator platform. It turns the parts of a person's digital life that they choose to connect into a coherent, inspectable record of identity, contribution, relationships, and outcomes.

The product has a familiar social surface, but its deeper purpose is accountability: connect permitted sources, preserve provenance, explain evidence quality, and use that evidence to support communities, creators, attribution, and value exchange.

## Read First

- [Documentation home](docs/README.md)
- [Product thesis](docs/PRODUCT_THESIS.md)
- [System architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Capability status](docs/CAPABILITY_STATUS.md)
- [Evidence and trust principles](docs/EVIDENCE_AND_TRUST.md)
- [Development roadmap](docs/ROADMAP.md)
- [Xeevia platform overview](XEEVIA_OVERVIEW.md)

## Repository Areas

- `src/` - React application, product services, connectors, evidence, distribution, wallet, and community features.
- `supabase/` - Database migrations and Edge Functions.
- `docs/` - Canonical product, architecture, trust, and operational documentation.
- Root-level guides - Deployment notes, integration guides, handoffs, and historical delivery records.

## Development

```bash
npm install
npm start
npm test -- --watchAll=false --runInBand
npm run build
```

## Important Capability Boundaries

- A connected provider is not automatically a verified identity or verified activity.
- Evidence coverage is broader than native provider activity ingestion.
- A platform appears in post distribution only when it has an active connection, valid publishing credential, and registered adapter.
- XRC records can provide tamper-evident application history; they do not independently prove that an external claim is true.
- Payments, provider OAuth, API scopes, RLS, and Edge Functions require deployed configuration outside this repository.

## Documentation Discipline

The canonical status document is [docs/CAPABILITY_STATUS.md](docs/CAPABILITY_STATUS.md). Older documents may describe a historical milestone and should not override the current source code or capability ledger.
