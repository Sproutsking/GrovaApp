/** @jest-environment node */

import { webcrypto } from "crypto";
import { computeGenesisHash, computeRecordHash } from "./hashing";
import { createVerificationService } from "./verificationService";

Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const makeSupabase = (records) => ({
  from: () => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (key, value) => {
        filters[key] = value;
        return query;
      },
      maybeSingle: async () => ({
        data: records.find((record) => Object.entries(filters).every(([key, value]) => record[key] === value)) || null,
        error: null,
      }),
    };
    return query;
  },
});

const makeChainSupabase = (records) => ({
  from: () => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (key, value) => {
        filters[key] = value;
        return query;
      },
      order: () => query,
      limit: () => query,
      then: (resolve, reject) => Promise.resolve({
        data: records.filter((record) => Object.entries(filters).every(([key, value]) => record[key] === value)),
        error: null,
      }).then(resolve, reject),
    };
    return query;
  },
});

test("traceHistory reports a real genesis link", async () => {
  const record = {
    record_id: "first-record",
    stream_type: "XCRC",
    previous_hash: await computeGenesisHash("XCRC"),
    record_hash: "first-hash",
    version: 2,
  };
  const service = createVerificationService(makeSupabase([record]));

  await expect(service.traceHistory(record.record_id)).resolves.toMatchObject({
    depth: 1,
    reachedGenesis: true,
    brokenLink: false,
    traceLimitReached: false,
  });
});

test("traceHistory reports a missing parent instead of claiming genesis", async () => {
  const record = {
    record_id: "orphan-record",
    stream_type: "XCRC",
    previous_hash: "missing-parent-hash",
    record_hash: "orphan-hash",
    version: 2,
  };
  const service = createVerificationService(makeSupabase([record]));

  await expect(service.traceHistory(record.record_id)).resolves.toMatchObject({
    depth: 1,
    reachedGenesis: false,
    brokenLink: true,
    traceLimitReached: false,
  });
});

test("validateChain accepts a correctly hashed record linked to genesis", async () => {
  const record = {
    record_id: "first-v3-record",
    stream_type: "XCRC",
    previous_hash: await computeGenesisHash("XCRC"),
    actor_id: "user-1",
    payload: { event: "post_created" },
    timestamp: 1720000000000,
    version: 3,
    created_at: "2026-10-21T12:00:00.000Z",
  };
  record.record_hash = await computeRecordHash(record);
  const service = createVerificationService(makeChainSupabase([record]));

  await expect(service.validateChain("XCRC")).resolves.toMatchObject({
    valid: true,
    recordCount: 1,
    invalidRecords: [],
  });
});

test("validateChain flags a broken first link instead of trusting it", async () => {
  const record = {
    record_id: "orphan-v3-record",
    stream_type: "XCRC",
    previous_hash: "not-the-genesis-hash",
    actor_id: "user-1",
    payload: { event: "post_created" },
    timestamp: 1720000000000,
    version: 3,
    created_at: "2026-10-21T12:00:00.000Z",
  };
  record.record_hash = await computeRecordHash(record);
  const service = createVerificationService(makeChainSupabase([record]));

  const result = await service.validateChain("XCRC");
  expect(result.valid).toBe(false);
  expect(result.invalidRecords).toEqual(expect.arrayContaining([
    expect.objectContaining({ recordId: record.record_id, status: "broken_chain" }),
  ]));
});

test("validateChain verifies mixed v3 and sequenced v4 records in chain order", async () => {
  const legacyRecord = {
    record_id: "legacy-record",
    stream_type: "XCRC",
    previous_hash: await computeGenesisHash("XCRC"),
    actor_id: "user-1",
    payload: { event: "post_created" },
    timestamp: 1720000000000,
    version: 3,
    created_at: "2026-10-21T12:00:00.000Z",
  };
  legacyRecord.record_hash = await computeRecordHash(legacyRecord);

  const v4Record = {
    record_id: "sequenced-record",
    stream_type: "XCRC",
    previous_hash: legacyRecord.record_hash,
    actor_id: "user-1",
    payload: { event: "post_edited" },
    timestamp: 1720000001000,
    version: 4,
    created_at: "2026-10-21T12:00:01.000Z",
    event_schema_version: 1,
    idempotency_key: "db:posts:post-1:edit-1",
    source_operation: "posts.update",
    stream_sequence: 2,
  };
  v4Record.record_hash = await computeRecordHash(v4Record);
  const service = createVerificationService(makeChainSupabase([v4Record, legacyRecord]));

  await expect(service.validateChain("XCRC")).resolves.toMatchObject({
    valid: true,
    complete: true,
    recordCount: 2,
    invalidRecords: [],
    checkedUpTo: v4Record.record_id,
  });
});

test("validateChain does not call a limit-sized page a complete verification", async () => {
  const record = {
    record_id: "limited-record",
    stream_type: "XCRC",
    previous_hash: await computeGenesisHash("XCRC"),
    actor_id: "user-1",
    payload: { event: "post_created" },
    timestamp: 1720000000000,
    version: 3,
    created_at: "2026-10-21T12:00:00.000Z",
  };
  record.record_hash = await computeRecordHash(record);
  const service = createVerificationService(makeChainSupabase([record]));

  await expect(service.validateChain("XCRC", 1)).resolves.toMatchObject({
    valid: false,
    complete: false,
    recordCount: 1,
  });
});