jest.mock("../config/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from "../config/supabase";
import { fetchDirectMessageUnreadSummary } from "./unreadMessageService";

describe("fetchDirectMessageUnreadSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the unread count and conversation IDs from one RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: { unread_count: 3, conversation_ids: ["conversation-a", "conversation-b"] },
      error: null,
    });

    const result = await fetchDirectMessageUnreadSummary();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("get_direct_message_unread_summary");
    expect(result).toEqual({
      count: 3,
      convSet: new Set(["conversation-a", "conversation-b"]),
    });
  });

  it("surfaces RPC errors instead of reporting a success-shaped zero", async () => {
    const rpcError = new Error("RPC unavailable");
    supabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(fetchDirectMessageUnreadSummary()).rejects.toBe(rpcError);
  });

  it("rejects malformed RPC responses", async () => {
    supabase.rpc.mockResolvedValue({
      data: { unread_count: -1, conversation_ids: "not-an-array" },
      error: null,
    });

    await expect(fetchDirectMessageUnreadSummary()).rejects.toThrow(
      "Unread message summary returned invalid fields.",
    );
  });
});
