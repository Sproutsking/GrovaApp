jest.mock("../../services/config/supabase", () => ({ supabase: {} }));
jest.mock("../../services/distribution/socialConnectService", () => ({ __esModule: true, default: {} }));
jest.mock("../../services/connectors/connectorRegistry", () => ({ CONNECTOR_DEFINITIONS: {} }));

const { getIdentityConnectionStatus } = require("./IdentitySection");

describe("getIdentityConnectionStatus", () => {
  it("requires a usable provider token before showing an OAuth account as connected", () => {
    expect(getIdentityConnectionStatus({ auth_status: "active", hasValidToken: true })).toBe("active");
    expect(getIdentityConnectionStatus({ auth_status: "active", hasValidToken: false })).toBe("expired");
  });

  it("keeps profile links active without an OAuth token", () => {
    expect(getIdentityConnectionStatus({
      auth_status: "active",
      connected_via: "profile_link",
      hasValidToken: false,
    })).toBe("active");
  });

  it("preserves revoked and missing connection states", () => {
    expect(getIdentityConnectionStatus({ auth_status: "revoked" })).toBe("revoked");
    expect(getIdentityConnectionStatus(null)).toBe("none");
  });
});
