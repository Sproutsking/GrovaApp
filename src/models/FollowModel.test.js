import FollowModel from "./FollowModel";
import { supabase } from "../services/config/supabase";

jest.mock("../services/config/supabase", () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe("FollowModel.followUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the server follow RPC without writing wallet balances from the client", async () => {
    const result = { success: true, follow_id: "follow-1" };
    supabase.rpc.mockResolvedValue({ data: result, error: null });

    await expect(FollowModel.followUser("user-1", "user-2")).resolves.toEqual(result);

    expect(supabase.rpc).toHaveBeenCalledWith("process_follow", { p_following_id: "user-2" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects invalid targets without calling the server", async () => {
    await expect(FollowModel.followUser("user-1", "user-1")).resolves.toEqual({
      success: false,
      error: "Invalid follow target",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});