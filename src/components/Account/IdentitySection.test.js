jest.mock("../../services/config/supabase", () => ({ supabase: {} }));
jest.mock("../../services/distribution/socialConnectService", () => ({ __esModule: true, default: {} }));
jest.mock("../../services/connectors/connectorRegistry", () => ({ CONNECTOR_DEFINITIONS: {} }));
jest.mock("../../services/identity/walletIdentityService", () => ({ __esModule: true, default: {} }));

const { getIdentityConnectionStatus } = require("./IdentitySection");

describe("getIdentityConnectionStatus", () => {
  it("keeps an externally connected identity active when publishing credentials are absent", () => {
    expect(getIdentityConnectionStatus({ auth_status: "active", hasValidToken: true })).toBe("active");
    expect(getIdentityConnectionStatus({ auth_status: "active", hasValidToken: false })).toBe("active");
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
