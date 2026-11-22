import { supabase } from "../config/supabase";
import channelService from "./channelService";

jest.mock("../config/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("ChannelService channel cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    channelService.clearCache();
  });

  const channelQuery = (data, error = null) => {
    const result = { data, error };
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      is: jest.fn(() => query),
      order: jest.fn(() => query),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
  };

  it("can bypass its in-memory cache to reconcile newly created channels", async () => {
    supabase.from
      .mockReturnValueOnce(channelQuery([{ id: "general", name: "general" }]))
      .mockReturnValueOnce(channelQuery([
        { id: "general", name: "general" },
        { id: "new-channel", name: "new-channel" },
      ]));

    await channelService.fetchChannels("community-1", { forceRefresh: true });
    const freshChannels = await channelService.fetchChannels("community-1", { forceRefresh: true });

    expect(freshChannels.map((channel) => channel.id)).toEqual(["general", "new-channel"]);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("reserves the built-in general channel name", async () => {
    await expect(
      channelService.createChannel({ name: " General " }, "community-1"),
    ).rejects.toThrow("#general is a reserved community channel name.");
  });

  it("does not report a cached list as fresh when a forced refresh fails", async () => {
    supabase.from
      .mockReturnValueOnce(channelQuery([{ id: "general", name: "general" }]))
      .mockReturnValueOnce(channelQuery(null, new Error("Network unavailable")));

    await channelService.fetchChannels("community-1", { forceRefresh: true });

    await expect(
      channelService.fetchChannels("community-1", { forceRefresh: true }),
    ).rejects.toThrow("Network unavailable");
  });
});
