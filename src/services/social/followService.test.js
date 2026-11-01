import FollowModel from "../../models/FollowModel";
import followService from "./followService";
import { supabase } from "../config/supabase";
import xrcService, { XRC_EVENTS } from "../xrc";

jest.mock("../../models/FollowModel", () => ({
  __esModule: true,
  default: {
    getFollowing: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
  },
}));

jest.mock("../config/supabase", () => ({
  __esModule: true,
  supabase: { from: jest.fn(), rpc: jest.fn().mockResolvedValue({ error: null }) },
}));

jest.mock("../notifications/pushService", () => ({
  __esModule: true,
  default: { sendPushToUser: jest.fn() },
}));

jest.mock("../xrc", () => ({
  __esModule: true,
  default: { writeRecord: jest.fn().mockResolvedValue({ success: true }) },
  STREAM_TYPES: { XERC: "XERC" },
  XRC_EVENTS: {
    followAdded: jest.fn((followerId, followingId) => ({ event: "follow_added", follower_id: followerId, following_id: followingId })),
    followRemoved: jest.fn((followerId, followingId) => ({ event: "follow_removed", follower_id: followerId, following_id: followingId })),
  },
}));

describe("followService.getSharedFollowing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns people both the viewer and profile follow, in profile-follow order", async () => {
    FollowModel.getFollowing
      .mockResolvedValueOnce([
        { following_id: "person-1" },
        { following_id: "person-3" },
      ])
      .mockResolvedValueOnce([
        { following_id: "person-2", profiles: { id: "person-2" } },
        { following_id: "person-1", profiles: { id: "person-1" } },
        { following_id: "person-3", profiles: { id: "person-3" } },
      ]);

    await expect(followService.getSharedFollowing("viewer", "profile", 1)).resolves.toEqual([
      { following_id: "person-1", profiles: { id: "person-1" } },
    ]);
    expect(FollowModel.getFollowing).toHaveBeenNthCalledWith(1, "viewer", 1000);
    expect(FollowModel.getFollowing).toHaveBeenNthCalledWith(2, "profile", 1000);
  });

  it("does not load shared follows for the same or missing viewer", async () => {
    await expect(followService.getSharedFollowing("profile", "profile")).resolves.toEqual([]);
    await expect(followService.getSharedFollowing(null, "profile")).resolves.toEqual([]);
    expect(FollowModel.getFollowing).not.toHaveBeenCalled();
  });
});

describe("followService XRC history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    xrcService.writeRecord.mockResolvedValue({ success: true });
    XRC_EVENTS.followAdded.mockImplementation((followerId, followingId) => ({
      event: "follow_added", follower_id: followerId, following_id: followingId,
    }));
    XRC_EVENTS.followRemoved.mockImplementation((followerId, followingId) => ({
      event: "follow_removed", follower_id: followerId, following_id: followingId,
    }));
  });

  it("records a follow after the relationship is successfully created", async () => {
    FollowModel.followUser.mockResolvedValue({ success: true });
    const profileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { username: "follower" }, error: null }),
    };
    supabase.from.mockReturnValue(profileQuery);

    await expect(followService.followUser("follower-1", "following-1"))
      .resolves.toMatchObject({ success: true });

    expect(XRC_EVENTS.followAdded).toHaveBeenCalledWith("follower-1", "following-1");
    expect(xrcService.writeRecord).toHaveBeenCalledWith(
      "XERC",
      { event: "follow_added", follower_id: "follower-1", following_id: "following-1" },
      "follower-1",
    );
  });

  it("records an unfollow after the relationship is successfully removed", async () => {
    FollowModel.unfollowUser.mockResolvedValue({ success: true });

    await expect(followService.unfollowUser("follower-1", "following-1"))
      .resolves.toMatchObject({ success: true });

    expect(XRC_EVENTS.followRemoved).toHaveBeenCalledWith("follower-1", "following-1");
    expect(xrcService.writeRecord).toHaveBeenCalledWith(
      "XERC",
      { event: "follow_removed", follower_id: "follower-1", following_id: "following-1" },
      "follower-1",
    );
  });
});
