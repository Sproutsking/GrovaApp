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