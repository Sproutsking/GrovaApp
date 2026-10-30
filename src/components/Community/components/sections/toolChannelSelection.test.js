import { getSelectedToolChannelIds } from "./toolChannelSelection";

describe("getSelectedToolChannelIds", () => {
  it("falls back to the legacy channel when configured destinations are empty", () => {
    expect(getSelectedToolChannelIds({
      channel_id: "legacy-channel",
      config: { channel_ids: [] },
    })).toEqual(new Set(["legacy-channel"]));
  });

  it("uses configured destinations instead of a stale legacy channel", () => {
    expect(getSelectedToolChannelIds({
      channel_id: "old-channel",
      config: { channel_ids: ["new-channel"] },
    })).toEqual(new Set(["new-channel"]));
  });

  it("returns no destination when neither config nor legacy channel has one", () => {
    expect(getSelectedToolChannelIds({ config: { channel_ids: [] } })).toEqual(new Set());
  });
});
