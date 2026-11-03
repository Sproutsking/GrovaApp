import storyService from "./storyService";
import { supabase } from "../config/supabase";
import xrcService from "../xrc";

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
  XRC_EVENTS: { storyDeleted: jest.fn(() => ({})) },
  STREAM_TYPES: { XCRC: "xrc" },
}));

describe("storyService.deleteStory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    xrcService.writeRecord.mockResolvedValue(undefined);
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "owner-1" } },
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the authenticated-owner RPC to soft-delete the story", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });

    await expect(storyService.deleteStory("story-1")).resolves.toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith("delete_own_story", { p_story_id: "story-1" });
  });

  it("does not claim success when the caller does not own the story", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(storyService.deleteStory("story-1")).rejects.toThrow("You do not have permission");
  });
});
