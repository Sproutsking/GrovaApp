import LikeModel from "./LikeModel";
import { supabase } from "../services/config/supabase";

jest.mock("../services/config/supabase", () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../services/shared/errorHandler", () => ({
  handleError: (error) => error,
}));

jest.mock("../services/notifications/pushService", () => ({
  __esModule: true,
  default: { sendPushToUser: jest.fn() },
}));

describe("LikeModel.toggleLike", () => {
  let query;

  beforeEach(() => {
    jest.clearAllMocks();
    LikeModel.likeCache.clear();
    query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    supabase.from.mockReturnValue(query);
    supabase.rpc.mockResolvedValue({ error: null });
  });

  it("waits for the database write before resolving and updates the count", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    query.single
      .mockResolvedValueOnce({ data: { id: "like-1" }, error: null })
      .mockResolvedValueOnce({ data: { likes: 8 }, error: null });

    await expect(LikeModel.toggleLike("post", "post-1", "user-1", { notify: false }))
      .resolves.toEqual({ liked: true, newCount: 8, success: true });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      post_id: "post-1",
      user_id: "user-1",
    }));
    expect(supabase.rpc).toHaveBeenCalledWith("increment_likes", {
      table_name: "posts",
      content_id: "post-1",
    });
  });

  it("rejects a failed like insert without incrementing the counter", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    query.single.mockResolvedValue({ data: null, error: new Error("permission denied") });

    await expect(LikeModel.toggleLike("post", "post-1", "user-1"))
      .rejects.toThrow("permission denied");

    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});