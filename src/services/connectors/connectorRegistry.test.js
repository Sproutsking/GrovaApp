import { getConnectorDefinitions, getLiveConnectors, getConnectorByKey } from "./connectorRegistry";

describe("connector registry", () => {
  it("exposes a broad set of connector definitions", () => {
    const connectors = getConnectorDefinitions();

    expect(connectors.x).toBeDefined();
    expect(connectors.facebook).toBeDefined();
    expect(connectors.instagram).toBeDefined();
    expect(connectors.linkedin).toBeDefined();
    expect(connectors.google).toBeDefined();
    expect(connectors.apple).toBeDefined();
    expect(connectors.github).toBeDefined();
    expect(connectors.discord).toBeDefined();
    expect(connectors.wallet).toBeDefined();
  });

  it("keeps the most practical connectors live", () => {
    const live = getLiveConnectors();
    const liveKeys = live.map((item) => item.key);

    expect(liveKeys).toEqual(expect.arrayContaining(["x", "facebook", "instagram", "linkedin", "google", "apple", "github", "discord", "wallet"]));
  });

  it("returns a connector by key", () => {
    expect(getConnectorByKey("linkedin")).toMatchObject({ key: "linkedin", name: "LinkedIn" });
  });
});
