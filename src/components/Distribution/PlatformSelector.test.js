jest.mock("../../services/config/supabase", () => ({ supabase: {} }));
jest.mock("../../services/distribution/distributionService", () => ({}));
jest.mock("../../services/distribution/platformAdapterFactory", () => ({ POSTABLE_PLATFORM_KEYS: [] }));
jest.mock("../Account/IdentitySection", () => ({ PLATFORMS: [] }));

const { filterReadyDestinations, resolveCommunityQuery } = require("./PlatformSelector");

describe("resolveCommunityQuery", () => {
  it("awaits Supabase thenables without relying on a Promise.catch method", async () => {
    const query = {
      then: (resolve) => Promise.resolve({ data: [{ id: "community-1" }], error: null }).then(resolve),
    };

    await expect(resolveCommunityQuery(query)).resolves.toEqual({
      data: [{ id: "community-1" }],
      error: null,
    });
  });

  it("returns rejected query errors for the destination panel to display", async () => {
    const failure = new Error("community query failed");
    const query = {
      then: (_resolve, reject) => Promise.reject(failure).then(undefined, reject),
    };

    await expect(resolveCommunityQuery(query)).resolves.toEqual({
      data: null,
      error: failure,
    });
  });
});

describe("filterReadyDestinations", () => {
  it("drops reconnect-needed platforms and unavailable community destinations", () => {
    expect(filterReadyDestinations(
      ["x", "facebook", "community:ready", "community:offline"],
      {
        x: { status: "ready", canPublish: true },
        facebook: { status: "reconnect", canPublish: false },
      },
      [
        { target: "community:ready", ready: true },
        { target: "community:offline", ready: false },
      ],
    )).toEqual(["x", "community:ready"]);
  });
});
