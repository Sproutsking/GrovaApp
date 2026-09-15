# Evidence and Trust Principles

## Purpose

Xeevia should help people and organizations make better decisions without turning the platform into an unexplained authority. Evidence is the product primitive. Trust is a context-specific conclusion drawn from evidence and policy.

## Evidence States

Every connected source should be represented honestly:

- **Connected:** A relationship or profile reference exists.
- **Tracked:** Xeevia has stored a source-linked record, but the claim has not passed a stronger verification method.
- **Verified:** A documented source-specific method supports the claim.
- **Expired:** The credential or evidence is outside its freshness or permission window.
- **Revoked:** The user or provider withdrew access.
- **Disputed:** A claim is challenged or conflicts with another record.
- **Unavailable:** The provider could not be queried or the required data was not returned.

The interface must not collapse all of these into a green badge.

## Evidence Quality Dimensions

A useful evidence record should be evaluated across:

1. **Source authority** - who supplied the data?
2. **Permission** - what did the user and provider authorize?
3. **Recency** - when was the data observed?
4. **Continuity** - was the account connected during the relevant event?
5. **Specificity** - does the record prove identity, activity, ownership, or outcome?
6. **Corroboration** - do independent sources support the same claim?
7. **Integrity** - has the record changed since collection?
8. **Reversibility** - can revocation, deletion, dispute, or correction be represented?

## Trust Decisions

Xeevia should produce explainable decisions for a stated purpose, such as:

- Community access
- Creator eligibility
- Campaign qualification
- Contribution attribution
- Payment or settlement eligibility

A decision should identify:

- The policy used
- The evidence considered
- The evidence excluded and why
- The confidence and freshness
- The decision time
- The appeal or correction path

There should be no universal Xeevia score that claims to summarize a person's worth.

## Privacy Rules

- Collect only what the stated purpose requires.
- Request the narrowest provider scopes available.
- Never infer access to private messages from a general social connection.
- Separate public profile evidence from private account metadata.
- Do not expose raw provider payloads by default.
- Make revocation and deletion meaningful.
- Give users a way to inspect and export the evidence attached to their profile.

## Anti-Gaming Rules

Trust and contribution systems should resist:

- High-volume low-value actions
- Coordinated engagement rings
- Purchased or synthetic activity
- Duplicate identities
- Sudden unexplained bursts
- Repeated self-referential evidence
- Historical claims made after the fact
- Provider data that cannot be independently refreshed

Economic rewards should use diminishing returns and quality-weighted contribution rather than raw activity volume.

## Product Language

Prefer:

- “Evidence from connected sources”
- “Tracked contribution”
- “Source-linked record”
- “Confidence: medium”
- “Provider-confirmed profile”
- “Permission revoked”

Avoid:

- “Trust score” without context
- “Certified” without a named certifier
- “Proof” when the record is only a user-supplied link
- “Verified identity” when only an OAuth account exists
- “Immutable truth” when only an application hash exists
