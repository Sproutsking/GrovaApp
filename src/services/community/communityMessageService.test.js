import { supabase } from "../config/supabase";
import communityState from "./CommunityStateManager";
import communityMessageService from "./communityMessageService";

jest.mock("../config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const createQuery = (result) => {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    or: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
};

const message = (id, createdAt) => ({
  id,
  channel_id: "channel-1",
  user_id: "user-1",
  created_at: createdAt,
  content: id,
  user: { id: "user-1", username: "member" },
});

describe("communityMessageService message pagination", () => {
  beforeEach(() => {
    communityState.reset();
    supabase.from.mockReset();
  });

  it("loads only the latest 50 messages and keeps them chronologically ordered", async () => {
    const rows = Array.from({ length: 50 }, (_, index) => {
      const number = 50 - index;
      return message(`message-${number}`, `2026-01-01T00:00:${String(number).padStart(2, "0")}.000Z`);
    });
    const query = createQuery({ data: rows, error: null });
    supabase.from.mockReturnValue(query);

    const result = await communityMessageService.loadMessages("channel-1");

    expect(query.limit).toHaveBeenCalledWith(50);
    expect(query.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(result.hasMore).toBe(true);
    expect(result.messages).toHaveLength(50);
    expect(result.messages[0].id).toBe("message-1");
    expect(result.messages[49].id).toBe("message-50");
  });

  it("fetches messages before the current oldest cursor and merges them into state", async () => {
    const oldestLoaded = message("message-3", "2026-01-01T00:00:03.000Z");
    communityState.initMessages("channel-1", [oldestLoaded]);
    const query = createQuery({
      data: [
        message("message-2", "2026-01-01T00:00:02.000Z"),
        message("message-1", "2026-01-01T00:00:01.000Z"),
      ],
      error: null,
    });
    supabase.from.mockReturnValue(query);

    const result = await communityMessageService.loadOlderMessages("channel-1", oldestLoaded);

    expect(query.or).toHaveBeenCalledWith(
      "created_at.lt.2026-01-01T00:00:03.000Z,and(created_at.eq.2026-01-01T00:00:03.000Z,id.lt.message-3)",
    );
    expect(result.hasMore).toBe(false);
    expect(result.messages.map((item) => item.id)).toEqual(["message-1", "message-2", "message-3"]);
    expect(communityState.getMessages("channel-1")).toEqual(result.messages);
  });

  it("propagates database errors instead of returning an empty history", async () => {
    const query = createQuery({ data: null, error: new Error("query failed") });
    supabase.from.mockReturnValue(query);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(communityMessageService.loadMessages("channel-1")).rejects.toThrow("query failed");

    errorSpy.mockRestore();
  });
});
