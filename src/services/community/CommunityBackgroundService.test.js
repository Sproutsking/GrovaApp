import communityBackgroundService from "./CommunityBackgroundService";
import dmBackgroundService from "../messages/BackgroundService";

describe("community chat backgrounds", () => {
  it("uses the same Classic Weave background as direct messages", () => {
    expect(communityBackgroundService.getTheme("classic_weave").style).toEqual(
      dmBackgroundService.getBgStyle("classic_weave"),
    );
  });
});
