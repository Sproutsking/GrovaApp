import backgroundService from "./BackgroundService";

describe("chat conversation backgrounds", () => {
  it("uses the Classic Weave artwork for the default background", () => {
    const defaultBackground = backgroundService.getConversationBackground(
      "background-service-test-default",
    );

    expect(defaultBackground).toBe("classic_weave");
    expect(backgroundService.getBgStyle(defaultBackground)).toMatchObject({
      backgroundSize: "320px 320px",
      backgroundPosition: "center center",
      backgroundRepeat: "repeat",
      backgroundColor: "#030404",
    });
    expect(backgroundService.getBgStyle(defaultBackground).backgroundImage).toMatch(
      /^url\(/,
    );
  });

  it("keeps the Nova background available as a separate option", () => {
    expect(backgroundService.getBgStyle("nova_weave").background).toContain(
      "radial-gradient",
    );
  });
});
