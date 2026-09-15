# Xeevia Development Roadmap

This roadmap turns the product thesis into measurable work. The order matters: reliable evidence must come before reputation, and attribution must come before settlement.

## Phase 1: Truthful Foundation

- Keep identity connection, evidence, and publishing states separate.
- Maintain complete connector registration without fabricating provider activity.
- Record provider, connection method, permission state, timestamps, and revocation.
- Audit XRC writers and verification field names as one schema contract.
- Review RLS, raw payload retention, and public evidence visibility.
- Add connector health, sync failure, and freshness observability.

**Exit condition:** A user can inspect exactly what Xeevia knows, where it came from, when it was collected, and what remains unverified.

## Phase 2: Native Evidence Wedge

Prioritize a small number of high-value providers rather than claiming every integration at once. For each provider, implement:

- OAuth scopes and consent explanation
- Profile retrieval
- Activity retrieval where permitted
- Pagination and rate limits
- Token refresh and revocation
- Provider fixtures and integration tests
- Normalization into common evidence types
- Source-specific verification rules

**Exit condition:** Xeevia can produce a better, more explainable contribution record for one clearly defined user segment than a resume, follower count, or screenshot collection.

## Phase 3: Portable Contribution Story

- Build timeline views from evidence with explicit dates.
- Link identity, activity, projects, communities, and outcomes.
- Add evidence freshness, decay, contradiction, and dispute states.
- Let users select what is public, private, or selectively shared.
- Export a portable evidence packet with source references and confidence.

**Exit condition:** A user can present a useful, inspectable record of contribution to a person or organization outside Xeevia.

## Phase 4: Explainable Decisions

- Define context-specific eligibility policies.
- Show which evidence caused an eligibility result.
- Add appeals, corrections, and human review.
- Measure false positives, false negatives, fraud, and user harm.
- Keep universal reputation scores out of the core product.

**Exit condition:** A community or campaign operator can make a better decision with Xeevia evidence than with ordinary profile claims.

## Phase 5: Attribution and Settlement

- Record qualified actions and outcome windows.
- Connect campaign delivery to evidence and attribution records.
- Apply diminishing returns and fraud resistance.
- Reconcile creator, community, protocol, and user allocations.
- Write auditable settlement events to the appropriate record stream.

**Exit condition:** A live campaign demonstrates improved qualified outcomes, lower fraud, or fairer contribution allocation with independently inspectable records.

## Phase 6: Defensibility

- Document the exact technical mechanism behind the contribution graph.
- Conduct a professional prior-art search.
- Preserve invention disclosures and dated architecture records.
- Measure the data and outcome advantages accumulated through operation.
- File intellectual-property protection only around specific, technically supported mechanisms.

The goal is not to patent a slogan. The goal is to protect a working method that converts permissioned, multi-source evidence into explainable decisions and attributable value.
