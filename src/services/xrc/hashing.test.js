/** @jest-environment node */

import { webcrypto } from "crypto";
import { computeRecordHash, verifyRecordHash } from "./hashing";

Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const makeRecord = (payload = { event: "post_created", content: "hello" }) => ({
  record_id: "record-1",
  stream_type: "XCRC",
  previous_hash: "parent-hash",
  actor_id: "user-1",
  payload,
  timestamp: 1720000000000,
  version: 3,
  created_at: "2026-10-21T12:00:00.000Z",
});

test("v3 record hashes verify against the persisted record_hash field", async () => {
  const record = makeRecord();
  record.record_hash = await computeRecordHash(record);

  await expect(verifyRecordHash(record)).resolves.toBe(true);
});

test("payload key order does not change a v3 record hash", async () => {
  const original = makeRecord({ event: "post_created", content: "hello" });
  const reordered = makeRecord({ content: "hello", event: "post_created" });
  original.record_hash = await computeRecordHash(original);

  await expect(verifyRecordHash({ ...reordered, record_hash: original.record_hash })).resolves.toBe(true);
});

test("changed persisted data fails v3 record verification", async () => {
  const record = makeRecord();
  record.record_hash = await computeRecordHash(record);

  await expect(verifyRecordHash({ ...record, payload: { ...record.payload, content: "changed" } })).resolves.toBe(false);
});

test("legacy records are not treated as verifiable v3 records", async () => {
  await expect(verifyRecordHash({ ...makeRecord(), version: 2, record_hash: "legacy-hash" })).resolves.toBe(false);
});