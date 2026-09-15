import { getConnector, listConnectors } from "../connectorRegistry";
import { CONNECTOR_DEFINITIONS } from "../../connectors/connectorRegistry";
import { registerDefaultConnectors } from "./index";

describe("evidence connector coverage", () => {
  beforeEach(() => {
    registerDefaultConnectors();
  });

  it("registers an evidence connector for every declared platform", () => {
    Object.keys(CONNECTOR_DEFINITIONS).forEach((provider) => {
      expect(getConnector(provider)).toBeDefined();
    });

    expect(listConnectors()).toHaveLength(Object.keys(CONNECTOR_DEFINITIONS).length);
  });

  it("keeps generic connectors honest about unsupported activity", async () => {
    const connector = getConnector("instagram");
    const result = await connector.sync({ profileId: "https://instagram.example/user" });

    expect(result.profile).toMatchObject({
      id: "https://instagram.example/user",
      verified: false,
    });
    expect(result.activity).toEqual([]);
  });
});
