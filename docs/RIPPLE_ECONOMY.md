# Xeevia Ripple Economy

## Status

**Architecture and first settlement slice.** The canonical implementation begins with migration `052_recursive_engagement_economy.sql` and the `process_ripple_engagement` RPC. The system is not complete until the migration is deployed, the client paths are migrated, and the economic invariants are tested against real database state.

## Core Idea

Most platforms treat engagement as a counter. Xeevia treats participation as a genealogy of economic events.

A post can produce a comment. A comment can produce a reply. A reply can produce another reply, a relationship, a qualified action, or an economic outcome. Each event has a parent, a root, a generation, a direct economic weight, and a settlement state.

```text
Post
  -> Comment
      -> Reply
          -> Reply
              -> Qualified outcome
```

The system measures what an action causes, not only what happened immediately on the action itself.

## Event Model

An engagement event contains:

- `actor_id` - the participant who performed the action.
- `content_type` and `content_id` - the object acted on.
- `action_type` - like, comment, reply, or share.
- `parent_event_id` - the preceding economic event when known.
- `root_content_type` and `root_content_id` - the originating post, reel, or story.
- `generation` - distance from the root content.
- `action_cost` - resolved by the server, never trusted from the client.
- `protocol_fee` - the portion removed before allocation.
- `distributable_value` - the one-time pool available for allocation.
- `rule_version` - the settlement rule used.
- `status` - settled, self-action, reversed, or disputed.
- `idempotency_key` - prevents duplicate settlement.

The event is the source of truth. Cumulative impact is derived from events and must not mint the same value again.

## First Settlement Rule

The initial Ripple v1 rule is deliberately conservative:

```text
like     = 2 EP
comment  = 4 EP
reply    = 2 EP
share    = 10 EP
protocol fee = 20% of a non-self action
```

For a non-self action:

```text
Distributable = Action cost - Protocol fee
```

If the directly affected contributor is also the root creator, that person receives the distributable amount once. If they are different people, the direct contributor receives 60% of the distributable amount and the root creator receives the remainder.

This means a reply can recognize both the person whose contribution was directly extended and the original creator whose work generated the conversation, without double-crediting the same person.

These values are a versioned starting policy, not a universal economic truth. Future policies may add quality, freshness, campaign, community, or fraud coefficients.

## Recursive Value Is a Measurement

For an action node $A$ with direct value $D(A)$ and children $C(A)$:

$$
V(A) = D(A) + \sum_{c \in C(A)} V(c)
$$

For a root genealogy:

$$
V_{root} = \sum_{g=0}^{n} \sum_{A \in G_g(root)} D(A)
$$

This is a measurement of activity and downstream impact. It is not permission to credit every ancestor with the full sum as spendable EP.

The economic conservation rule is:

```text
Actor debit = protocol fee + all allocation rows
```

Every settlement must reconcile exactly. A cumulative impact number may influence ranking, reputation, eligibility, or campaign attribution, but it must not create unbacked currency.

## Why This Matters

The system can distinguish:

- Immediate participation
- Direct contribution value
- Descendant activity
- Downstream impact
- Root content value
- Qualified outcome value
- Settlement value

A small action can become strategically important if it creates valuable activity later. That is the Ripple Economy's core insight.

## Required Hardening

Before claiming this is a complete economic protocol, Xeevia needs:

- Deployment of migration 052.
- A single server-authoritative action resolver.
- Idempotent handling for every UI action.
- Reversal and moderation settlement rules.
- Anti-farming and coordinated-activity detection.
- Freshness and quality coefficients.
- Campaign attribution windows.
- Reconciliation reports for wallets, EP transactions, allocations, and platform fees.
- Load, concurrency, and failure tests.
- A user-facing explanation of why an action costs and allocates a given amount.

## Strategic Position

The product statement is:

> **Most platforms measure engagement. Xeevia models the economic consequences of engagement.**

The long-term moat would come from a trusted history of contribution and outcomes, not from the equation alone. The system must prove that it improves creator qualification, community health, attribution, or campaign outcomes compared with ordinary reach and engagement metrics.
