import { supabase } from "../config/supabase";
import socialUpdatesService from "./socialUpdatesService";

jest.mock("../config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

describe("socialUpdatesService public profile connections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires linked accounts for OAuth-only providers", async () => {
    await expect(socialUpdatesService.saveProfileConnection({
      communityId: "community-1",
      userId: "user-1",
      provider: "x",
      profileUrl: "https://x.com/example",
    })).rejects.toThrow("X requires a linked account");

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("saves supported public profile sources", async () => {
    const source = { id: "source-1", provider: "github" };
    const single = jest.fn().mockResolvedValue({ data: source, error: null });
    const select = jest.fn(() => ({ single }));
    const upsert = jest.fn(() => ({ select }));
    supabase.from.mockReturnValue({ upsert });

    await expect(socialUpdatesService.saveProfileConnection({
      communityId: "community-1",
      userId: "user-1",
      provider: "github",
      profileUrl: "https://github.com/example",
    })).resolves.toBe(source);

    expect(supabase.from).toHaveBeenCalledWith("community_social_connections");
    expect(upsert.mock.calls[0][0]).toMatchObject({
      community_id: "community-1",
      provider: "github",
      source_url: "https://github.com/example",
    });
  });
});
