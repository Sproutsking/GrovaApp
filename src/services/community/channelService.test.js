import { supabase } from "../config/supabase";
import channelService from "./channelService";

jest.mock("../config/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("ChannelService default channels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("restores About Us and Official Links as announcement channels", async () => {
    let insertedChannels;
    const query = {
      insert: jest.fn((channels) => {
        insertedChannels = channels;
        return query;
      }),
      select: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
    };
    supabase.from.mockReturnValue(query);

    await channelService.restoreDefaultChannels("community-1");

    expect(insertedChannels).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "about-us", type: "announcement", community_id: "community-1" }),
      expect.objectContaining({ name: "official-links", type: "announcement", community_id: "community-1" }),
    ]));
  });
});
