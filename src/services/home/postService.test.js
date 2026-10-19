import postService from "./postService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  __esModule: true,
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock("../shared/cacheService", () => ({
  __esModule: true,
  default: { invalidate: jest.fn(), invalidatePattern: jest.fn() },
}));

jest.mock("../notifications/pushService", () => ({
  __esModule: true,
  default: { sendPushToUser: jest.fn() },
}));

jest.mock("../xrc", () => ({
  __esModule: true,
  default: { writeRecord: jest.fn(() => Promise.resolve()) },
  XRC_EVENTS: { postDeleted: jest.fn(() => ({})) },
  STREAM_TYPES: { XCRC: "xrc" },
}));

const makePostsQuery = ({ post, deletedPost } = {}) => {
  const updateQuery = {
    eq: jest.fn(() => updateQuery),
    is: jest.fn(() => updateQuery),
    select: jest.fn(() => updateQuery),
    maybeSingle: jest.fn().mockResolvedValue({ data: deletedPost || null, error: null }),
  };
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: post, error: null }),
      })),
    })),
    update: jest.fn(() => updateQuery),
    updateQuery,
  };
};

describe("postService.deletePost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
  });

  it("soft-deletes only a still-active post owned by the authenticated user", async () => {
    const query = makePostsQuery({
      post: { id: "post-1", user_id: "owner-1", deleted_at: null },
      deletedPost: { id: "post-1" },
    });
    supabase.from.mockReturnValue(query);

    await expect(postService.deletePost("post-1")).resolves.toMatchObject({ success: true, postId: "post-1" });
    expect(query.updateQuery.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(query.updateQuery.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("rejects attempts to delete another user's post before issuing an update", async () => {
    const query = makePostsQuery({ post: { id: "post-1", user_id: "owner-2", deleted_at: null } });
    supabase.from.mockReturnValue(query);

    await expect(postService.deletePost("post-1")).rejects.toThrow("You can only delete your own posts");
    expect(query.update).not.toHaveBeenCalled();
  });

  it("reports an update that matched no owned active post instead of claiming success", async () => {
    const query = makePostsQuery({ post: { id: "post-1", user_id: "owner-1", deleted_at: null } });
    supabase.from.mockReturnValue(query);

    await expect(postService.deletePost("post-1")).rejects.toThrow("The requested item was not found");
  });
});
