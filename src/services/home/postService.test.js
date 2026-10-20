import postService from "./postService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  __esModule: true,
  supabase: {
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
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

describe("postService.deletePost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
  });

  it("calls the database's authenticated-owner delete function", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });

    await expect(postService.deletePost("post-1")).resolves.toMatchObject({ success: true, postId: "post-1" });
    expect(supabase.rpc).toHaveBeenCalledWith("delete_own_post", { p_post_id: "post-1" });
  });

  it("does not claim success when the database rejects the caller's ownership", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });

    await expect(postService.deletePost("post-1")).rejects.toThrow("You do not have permission to perform this action");
  });

  it("surfaces database errors rather than hiding a failed deletion", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });

    await expect(postService.deletePost("post-1")).rejects.toThrow("You do not have permission to perform this action");
  });
});
