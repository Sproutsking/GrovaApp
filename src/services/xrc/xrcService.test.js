import * as xrcGuard from "./xrcGuard.js";
import { createXRCService } from "./xrcService";

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  jest.spyOn(xrcGuard, "shouldRecord").mockReturnValue(true);
});

test("database-triggered events do not append duplicate client records", async () => {
  const rpc = jest.fn();
  const service = createXRCService({ rpc });

  await expect(
    service.writeRecord("XCRC", { event: "post_created" }, ACTOR_ID),
  ).resolves.toMatchObject({
    success: false,
    skipped: true,
    reason: "database-trigger-captured",
  });
  expect(rpc).not.toHaveBeenCalled();
});

test("non-triggered events use the server-computed v4 append RPC", async () => {
  const rpc = jest.fn().mockResolvedValue({
    data: [{ record_id: "record-1", record_hash: "server-hash", version: 4 }],
    error: null,
  });
  const service = createXRCService({ rpc });

  await expect(
    service.writeRecord(
      "XARC",
      { event: "identity_details_updated" },
      ACTOR_ID,
    ),
  ).resolves.toMatchObject({
    success: true,
    recordId: "record-1",
    hash: "server-hash",
    version: 4,
  });
  expect(rpc).toHaveBeenCalledWith(
    "append_xrc_record_v4",
    expect.objectContaining({
      p_stream_type: "XARC",
      p_actor_id: ACTOR_ID,
      p_source_operation: "client.identity_details_updated",
    }),
  );
});
