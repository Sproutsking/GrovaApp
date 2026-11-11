import { buildPublicXrdLink, buildXrcDeepLink, getPublicXrdShare, normalizeXrdShareHandle } from "./xrdPublicShareService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

describe("xrdPublicShareService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("normalizes an optional @ prefix and rejects URL fragments", () => {
    expect(normalizeXrdShareHandle("@ada")).toBe("ada");
    expect(() => normalizeXrdShareHandle("ada/private")).toThrow("valid XRD profile handle");
  });

  it("loads only the database public-share projection and validates its profile", async () => {
    supabase.rpc
      .mockResolvedValueOnce({
        data: {
          profile: { id: "profile-1", username: "ada" },
          claims: [{ id: "claim-1" }],
          evidenceItems: [{ id: "evidence-1" }],
          bindings: [{ id: "binding-1" }],
          identityDetails: { headline: "Builder", privateField: 42 },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "link-1", category: "social", label: "GitHub", url: "https://github.com/ada", visibility: "public" }],
        error: null,
      });

    await expect(getPublicXrdShare("@ada")).resolves.toEqual({
      profile: { id: "profile-1", username: "ada" },
      claims: [{ id: "claim-1" }],
      evidenceItems: [{ id: "evidence-1" }],
      bindings: [{ id: "binding-1" }],
      links: [{ id: "link-1", category: "social", label: "GitHub", url: "https://github.com/ada", visibility: "public" }],
      linksWarning: "",
      identityDetails: { headline: "Builder" },
    });
    expect(supabase.rpc).toHaveBeenCalledWith("get_public_xrd_share", { p_username: "ada" });
    expect(supabase.rpc).toHaveBeenCalledWith("get_public_xrd_links", { p_username: "ada" });
  });

  it("surfaces public-link endpoint failures", async () => {
    const failure = new Error("Links unavailable");
    supabase.rpc
      .mockResolvedValueOnce({
        data: { profile: { id: "profile-1", username: "ada" } },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: failure });

    await expect(getPublicXrdShare("ada")).rejects.toBe(failure);
  });

  it("keeps the public XRD available and reports when the optional public-links migration is missing", async () => {
    supabase.rpc
      .mockResolvedValueOnce({
        data: { profile: { id: "profile-1", username: "ada" }, evidenceItems: [{ id: "evidence-1" }] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.get_public_xrd_links(p_username) in the schema cache" },
      });

    await expect(getPublicXrdShare("ada")).resolves.toEqual(expect.objectContaining({
      profile: { id: "profile-1", username: "ada" },
      evidenceItems: [{ id: "evidence-1" }],
      links: [],
      linksWarning: expect.stringContaining("database migration"),
    }));
  });

  it("returns not-found for unknown handles and surfaces database failures", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPublicXrdShare("missing")).resolves.toBeNull();

    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("RPC unavailable") });
    await expect(getPublicXrdShare("ada")).rejects.toThrow("RPC unavailable");
  });

  it("builds an authenticated XRC destination that retains the requested record", () => {
    expect(buildXrcDeepLink({
      username: "@ada",
      profileId: "profile-1",
      section: "Records",
      xrdRecordId: "claim-1",
    })).toBe("/xrc/ada?profileId=profile-1&section=Records&xrdRecordId=claim-1");
  });

  it("builds a shareable public XRD URL", () => {
    expect(buildPublicXrdLink("@ada", "https://xeevia.example"))
      .toBe("https://xeevia.example/xrd/ada");
  });
});
