# XRD and XRC Data Contract

**Status:** Proposed v0.1 for product and engineering review

**Scope:** Canonical vocabulary, entity boundaries, relationships, visibility, and lifecycle states. This document does not apply database migrations or claim that the proposed model is already deployed.

## Purpose

XRD is the human-readable interface to a person's permissioned identity and contribution record. XRC is the append-only audit and integrity layer for important events in that system. Evidence and identity bindings connect claims to sources; they are not interchangeable with claims or audit events.

The contract prevents a connected account, a stored edge, a hash, or a platform-generated badge from being presented as stronger proof than it is.

## Canonical Vocabulary

| Term | Contract meaning | Does not mean |
|---|---|---|
| Profile | A person's Xeevia account and presentation surface. | A verified human identity. |
| Source | A provider, institution, first-party Xeevia subsystem, or other authority from which data can be observed. | A connection, evidence item, or claim. |
| Connection | A relationship between a Profile and an external provider account, including method, scopes, and credential state. `connections` is reserved for this meaning. | Proof that every claim or activity on the account is true. |
| Identity binding | A versioned, attributable link between a Profile and an external identity, with a stated method and assurance scope. | A provider connection by itself, or proof of personhood unless the method explicitly establishes it. |
| Evidence | A source-linked observation or artifact captured at a time, with provenance, permissions, and any verification assessment. | The claim it may support, or a universal truth. |
| XRD record | A versioned, attributable claim or fact presented about a Profile or related subject. | An XRC audit event. |
| Remark | An attributed annotation, confirmation, correction, dispute, or recognition attached to an XRD record. | A comment with authority, unless the author's relevant relationship and authority are established. |
| Verification run | An immutable attempt to check an XRD record or evidence against a named source and method. | A permanent guarantee, or a hash check. |
| Decision | A purpose-specific policy outcome that cites the policy version and evidence it used. | A universal reputation or worth score. |
| XRC event | An append-only event describing a state change or action, linked to a stream and integrity chain. | Proof that the event's original assertion was true. |
| Relationship / edge | A typed, attributable link between two identified entities. | Evidence merely because it is drawn in a graph. |

Product language must distinguish **connected**, **bound**, **tracked**, **source-reported**, **verified**, **disputed**, and **integrity-checked**. Never collapse them into one green “verified” state.

## Portable Hiring Portfolio

The owner may export selected published XRD records as an `XRDPortfolio` JSON-LD package for import into a CV, hiring, or project-review workflow. The package is a data handoff, not a signed credential or a hiring recommendation.

- Records retain their self-asserted status, lifecycle, and visibility at export. Only records explicitly selected by the owner are included; private records start unchecked and require an explicit selection.
- Structured work fields include role, organization/project, dates, and a safe HTTP(S) project/source URL.
- Linked evidence is limited to descriptive source observations and safe source URLs. Raw provider payloads, access tokens, and external account identifiers are not exported.
- Relevant identity bindings include their method, assurance scope, and status. A binding indicates only the stated account relationship; it does not establish personhood, authorship, employment, or claim truth.
- The package's relationship graph has explicit claim-to-evidence and profile-to-binding edges. Edge labels describe recorded relationships; they are not verification results.
- Every package is explicitly unsigned. A source comparison is an observation, not an issuer attestation.

This export is importable machine-readable data; receiving hiring systems must still validate its schema, obtain any necessary consent, and independently assess evidence or issuer attestations before making decisions.

## Entity Contracts

All persisted entities use stable IDs, UTC timestamps, explicit ownership/subject references, and a schema version when payload shape may evolve. Database columns use `snake_case`; service boundaries may map them to camelCase. IDs from external systems are namespaced by provider and connection so unrelated providers cannot collide.

### Source

Minimum fields: `id`, `provider_key`, `display_name`, `source_type`, `authority_url`, `connector_key`, `connector_version`, `status`, `created_at`, `updated_at`.

`source_type` is one of `provider`, `institution`, `first_party`, or `user_supplied`. A user-supplied link is explicitly not provider confirmation. Source state describes connector availability, not evidence truth.

### Connection

Minimum fields: `id`, `profile_id`, `source_id` or `provider_key`, `external_subject_id`, `connected_via`, `scopes`, `auth_status`, `connected_at`, `last_sync_at`, `credential_expires_at`, `revoked_at`.

Credentials and raw tokens are never part of XRD graph payloads. Keep credential state distinct from binding assurance. A public profile URL can create a connection record with method `profile_link`, but its state must not claim account control.

### Identity Binding

Minimum fields: `id`, `profile_id`, `connection_id` (nullable for non-OAuth proofs), `source_id`, `external_subject_id`, `binding_method`, `assurance_scope`, `status`, `evidence_refs`, `valid_from`, `valid_until`, `created_at`, `supersedes_id`.

`assurance_scope` must name what the method supports, such as `account_control`, `profile_match`, `personhood`, `institutional_attestation`, or `domain_control`. A binding may establish account control without establishing personhood or claim truth.

### Evidence

Minimum fields: `id`, `profile_id`, `connection_id`, `provider_key`, `evidence_type`, `entity_type`, `external_id`, `title`, `summary`, `source_url`, `observed_at`, `captured_at`, `expires_at`, `status`, `confidence`, `verification_method`, `visibility`, `metadata`, `raw_ref`, `created_at`, `updated_at`.

Evidence represents an observation. Preserve its source and capture time; a new observation or source response creates a new version/item rather than silently rewriting history. Raw provider payloads are private, minimized, and retained only when necessary and permitted. `confidence` is contextual to a documented method; it is not a cross-user score.

### XRD Record / Claim

Minimum fields: `id`, `profile_id`, `subject_ref`, `record_type`, `claim_text`, `structured_claim`, `valid_from`, `valid_until`, `lifecycle_status`, `visibility`, `created_by`, `created_at`, `updated_at`, `supersedes_id`, `schema_version`.

The record stores what is being asserted and by whom. It does not own its evidence or verification result; those are linked entities. Do not store a mutable `verified: true` as the sole truth state. A displayed status is derived from the latest applicable verification runs and evidence states, with the derivation shown to the viewer.

### Remark / Attestation

Minimum fields: `id`, `target_record_id`, optional `target_evidence_id`, `author_profile_id`, `remark_type`, `body`, `authority_binding_id`, `evidence_refs`, `status`, `created_at`, `withdrawn_at`, `supersedes_id`.

Supported types: `context`, `confirm`, `correction`, `dispute`, `recognition`. The author relationship and the scope of authority are explicit and inspectable. A UI assertion or role label alone does not grant authority. Owner responses are separate, attributed annotations and never overwrite an attestation.

### Verification Run

Minimum fields: `id`, `target_type`, `target_id`, `source_id`, `method`, `method_version`, `status`, `result`, `checked_fields`, `evidence_refs`, `started_at`, `completed_at`, `expires_at`, `initiated_by`, `response_ref`, `response_hash`, `created_at`.

`status` describes execution (`queued`, `running`, `completed`, `failed`, `cancelled`). `result` describes the source check (`matched`, `mismatch`, `not_found`, `unavailable`, `expired`, `revoked`, `indeterminate`). Store both; a timeout is not a mismatch. Runs are append-only. A later check creates another run.

### Decision

Minimum fields: `id`, `subject_profile_id`, `purpose`, `policy_id`, `policy_version`, `outcome`, `status`, `included_refs`, `excluded_refs`, `rationale`, `confidence`, `decided_at`, `expires_at`, `review_or_appeal_ref`, `created_at`.

`purpose` is specific, such as community access, creator qualification, or campaign eligibility. `outcome` is `eligible`, `ineligible`, `review_required`, or `indeterminate`; `status` is `draft`, `final`, `appealed`, or `superseded`. Every final decision explains its policy, evidence considered, exclusions, freshness, and correction path.

### XRC Event

Minimum fields: `record_id`, `stream_type`, `event_type`, `actor_id`, `subject_refs`, `payload`, `payload_schema_version`, `occurred_at`, `recorded_at`, `previous_hash`, `record_hash`, `signature` (when applicable), `visibility`, `created_at`.

XRC event payloads describe a state transition or action and reference affected domain entities. They do not duplicate large source payloads. Sensitive event details remain private or are redacted; a public integrity receipt may expose only the minimum safe fields. Events are immutable; corrections append a new event.

## Relationship Types

Edges have stable IDs, typed endpoints, a controlled `relation`, `created_at`, `created_by` or system actor, and optional source/evidence references. Use explicit foreign keys where endpoint types are known; use a constrained typed-edge model when polymorphic references are necessary.

| Relation | Direction | Meaning |
|---|---|---|
| `has_connection` | Profile → Connection | The profile has an external provider connection. |
| `binds_identity` | Profile → Identity binding | The binding links this profile to a source identity with stated assurance. |
| `reported_by` | Evidence → Source/Connection | Identifies where and through which connection evidence was observed. |
| `supports` | Evidence → XRD record | Evidence is offered in support of the claim; it does not prove it by itself. |
| `contradicts` | Evidence → XRD record | Evidence conflicts with a claim or field. |
| `attests_to` / `disputes` / `corrects` | Remark → XRD record | A remark annotation with separately inspectable authority. |
| `checked_by` | Verification run → XRD record/Evidence | This run checked the referenced target. |
| `decided_from` | Decision → Evidence/XRD record/Verification run | The cited input was considered by a policy decision. |
| `supersedes` | New entity → Prior entity | A new version replaces, but does not erase, the prior entity. |
| `previous_event` | New XRC event → Prior XRC event | Cryptographic stream order, not a semantic claim relationship. |

`generated` may describe that a connector returned an activity under a connected profile. It must not be presented as authorship proof unless the source method supports that claim. Provider grouping is a visualization convenience, not a stored evidentiary edge. Every edge shown as provenance must resolve to a stored relationship or an explicitly labeled derived relationship.

## Statuses and Allowed Transitions

Transitions are forward-only where they describe history. A correction, retry, reconnection, or new source response creates a new version/event instead of erasing the previous state.

| Entity | Statuses | Allowed transitions |
|---|---|---|
| Source | `active`, `degraded`, `disabled` | `active` ↔ `degraded`; either → `disabled`; re-enabling is an audited transition. |
| Connection | `pending`, `active`, `reauth_required`, `expired`, `revoked`, `disconnected`, `failed` | `pending` → `active`/`failed`; `active` → `reauth_required`/`expired`/`revoked`/`disconnected`; `reauth_required`/`expired`/`disconnected` → `pending` for a new consent attempt. Revoked consent is not silently restored. |
| Identity binding | `claimed`, `pending`, `bound`, `verified`, `disputed`, `expired`, `revoked`, `failed` | `claimed` → `pending`/`bound`; `pending` → `bound`/`failed`; `bound` → `verified` only after a method-specific check, or → `disputed`/`revoked`; `verified` → `disputed`/`expired`/`revoked`. Rebinding creates a new version. |
| Evidence | `tracked`, `verified`, `disputed`, `expired`, `revoked`, `unavailable` | `tracked` → any assessment state; `unavailable` → `tracked` after a successful new observation; `expired` may be followed by a new verified observation. Preserve each prior observation/run. |
| XRD record | `draft`, `published`, `withdrawn`, `superseded` | `draft` → `published`/`withdrawn`; `published` → `withdrawn`/`superseded`. Edits that change claim meaning create a superseding record. |
| Remark | `draft`, `published`, `withdrawn` | `draft` → `published`/`withdrawn`; `published` → `withdrawn`. A correction is a new remark; never rewrite the author's prior text. |
| Verification run | `queued`, `running`, `completed`, `failed`, `cancelled` | `queued` → `running`/`cancelled`; `running` → `completed`/`failed`/`cancelled`. Terminal runs never transition; retry creates another run. |
| Decision | `draft`, `final`, `appealed`, `superseded` | `draft` → `final`; `final` → `appealed`/`superseded`; a resolved appeal creates a new decision version. |
| XRC event | Immutable after append | No update/delete transition. Integrity is computed as `valid`, `modified`, `broken_chain`, `unverifiable`, or `missing`; those are verification results, not event lifecycle states. |

For `Evidence`, `verified` is permitted only when a named method/source and completed verification run support it. Connector presence, OAuth, owner input, an edge, or an XRC hash check alone cannot set it.

## Visibility and Access

Use these canonical audience values: `private`, `public`, `followers`, `approved_viewers`, and `verifiers`. `connections` means provider account connections only; do not use it as an audience label. A `custom` audience is represented by explicit grants and is not an implicit sixth policy.

| Entity/data | Default | Rules |
|---|---|---|
| Profile presentation fields | Owner-controlled | Each field may have its own audience; public does not imply all linked records are public. |
| Source connection and scopes | `private` | Public UI may show a provider name and coarse state only if the owner opts in. Never expose tokens or private scopes. |
| Identity binding | `private` | Publish only the minimum identity, method, and assurance details selected by the owner. Never expose secrets or proof material. |
| Evidence and XRD records | `private` | Explicitly publish or grant access. `verified` does not automatically make content public. |
| Raw source payload | `private` | Not directly readable from public clients; minimize, redact, or delete according to retention rules. |
| Remarks | `public` only when published under the remark policy | Respect the target record's access. An owner's response does not upgrade the remark's authority. |
| Verification details | `private` by default | A public summary may show method, time, result, and safe source reference; raw responses stay private. |
| Decisions | `private` by default | Share with the named decision audience only, with policy/rationale appropriate to that audience. |
| XRC events | `private` or authorized by event class | Public integrity receipts must be redacted and must not reveal private payloads, identifiers, or low-entropy secrets. |

Access is evaluated by the server, not only hidden in the UI. A graph node or edge is visible only if the viewer may see its endpoints and the relationship itself. Hidden endpoints must not leak through labels, counts, IDs, search results, or Oracle context. A grant is scoped to an explicit entity/viewer and can be revoked; revocation blocks future reads but does not pretend an already disclosed copy can be recalled.

## XRC Integrity Contract

- Append events only after the domain action has a durable outcome, or use an outbox/transactional RPC so the action and audit intent cannot silently diverge.
- Serialize stream-head advancement. Reading a head, inserting a record, and asynchronously updating the head is not sufficient under concurrent writes.
- Verify record hash, previous-hash linkage, supported payload version, actor/authority, and stream type separately.
- Use idempotency keys for retried writes. A failed XRC append must be observable and repairable; silently dropping it is not an audit guarantee.
- Keep XRC verification separate from source verification and claim truth. A valid chain means integrity under the implemented threat model, not external notarization or truth.
- Define retention, privacy, correction, deletion, and redaction rules before putting sensitive profile or payment data in event payloads.

The app records XRD identity-detail edits in XARC using changed field names and visibility only; it does not copy biography or other field values into the chain. Platform link, unlink, and imported-identity lifecycle events are recorded in XARC with provider, connection method, and an explicit assurance scope; access tokens and external platform account identifiers are excluded. Xeevia follow and unfollow actions are recorded in XERC with the two Xeevia profile IDs. These events attest to app-recorded state changes, not to the truth of profile claims or external platform data.

XRC intentionally skips writes in test and development builds (including hosted previews running `NODE_ENV=development`) unless `REACT_APP_XRC_FORCE_DEV=true` is set. A skipped write is not a recorded event; the XRD identity editor now reports this distinction after a successful save. Enable the flag only when development actions should be appended to the configured database.

## Current Schema Mapping

| Current implementation | Contract mapping | Gap / caution |
|---|---|---|
| `connections`, `tokens` | Connection and credential state | Connection state is provider-oriented; it is not yet a full identity-binding record. Tokens must remain inaccessible to XRD presentation. |
| `evidence_items` | Evidence | Current schema has useful source/profile/connection fields, but lifecycle, capture/expiry, method, and visibility are partly represented in free-form metadata/boolean fields. |
| `evidence_edges` | Typed evidence-to-evidence relationships | Current table only references evidence items. It cannot natively link records, bindings, remarks, decisions, or XRC events. |
| `xrd_identity_details` | Owner-supplied profile detail | These values are self-asserted profile fields, not external identity bindings. |
| `xrd_remarks` | Remark | Current target is a title and optional evidence item, not a first-class XRD record; authority relationship is not a required FK. |
| `xrd_access_requests`, `xrd_evidence_grants` | Access workflow | Useful foundation; grants currently target evidence items. Apply and test the privacy migrations in the deployed database. |
| `xrc_records`, `xrc_root_chain` | XRC events and stream heads | Definitions were found in the schema reference, but not in an active migration. The reference schema's default version also differs from the current v3 hashing requirement. Confirm deployed schema before relying on it. |
| Verification UI/service state | Verification run | No durable verification-run table was identified in the active migrations inspected for this contract. UI-computed or transient results are not an audit history. |
| Eligibility/reputation surfaces | Decision | No general purpose-bound decision entity was identified. Do not represent a universal score as a substitute. |

## Decisions To Confirm

These are product decisions, not implementation details to guess:

1. Does `followers` mean any follower or mutual followers? Use separate audience names if both are needed.
2. Which exact XRD record types are first-class at launch (employment, education, project, credential, contribution, community, achievement)?
3. Which sources/methods may produce `verified` for each record type, and who may attest to each type?
4. Is public XRD available to anonymous visitors, authenticated viewers, or both? Evidence access may remain stricter than record visibility.
5. What is the default visibility for new records, evidence, bindings, and remarks? This proposal defaults sensitive entities to private.
6. Which XRC streams/events are required for the first integrity slice, and what fields may be public in a redacted receipt?
7. Which data may be retained as raw payload, for how long, and how do deletion/revocation obligations interact with audit retention?

## Acceptance Gate

Treat this contract as ready for implementation when the team agrees on the seven decisions above and can test these invariants:

- Every claim shown as verified links to a completed, method-specific verification run and inspectable allowed evidence.
- Every external identity link reports exactly what its binding method establishes.
- Every graph edge has a typed meaning, permitted endpoints, and an explanation; visual grouping is labeled as grouping.
- Visibility and grants are enforced in database policies and APIs, including graph traversal and Oracle context.
- Every decision names its purpose, policy version, inputs, exclusions, and review path.
- Every XRC event can be idempotently appended, hash-checked, chain-checked, and audited without implying the event's claim is true.
- The deployed schema and migration state match the documented contract; a reference SQL dump is not accepted as deployment proof.