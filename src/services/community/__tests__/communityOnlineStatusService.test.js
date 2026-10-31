import communityOnlineStatusService from "../communityOnlineStatusService";
import { supabase } from "../../config/supabase";

jest.mock("../../config/supabase", () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn().mockResolvedValue("ok"),
    from: jest.fn(),
  },
}));

describe("CommunityOnlineStatusService presence subscription", () => {
  afterEach(() => {
    jest.useRealTimers();
    communityOnlineStatusService.stop();
    jest.clearAllMocks();
  });

  it("uses realtime presence without starting recurring database reads or writes", () => {
    const channel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      untrack: jest.fn().mockResolvedValue("ok"),
    };
    supabase.channel.mockReturnValue(channel);
    jest.useFakeTimers();

    communityOnlineStatusService.start("user-1", "community-1");

    expect(supabase.channel).toHaveBeenCalledWith("community:community-1:presence");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
