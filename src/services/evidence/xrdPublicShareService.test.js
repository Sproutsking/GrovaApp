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
    supabase.rpc.mockResolvedValue({
      data: {
        profile: { id: "profile-1", username: "ada" },
        claims: [{ id: "claim-1" }],
        evidenceItems: [{ id: "evidence-1" }],
        bindings: [{ id: "binding-1" }],
        identityDetails: { headline: "Builder", privateField: 42 },
      },
      error: null,
    });

    await expect(getPublicXrdShare("@ada")).resolves.toEqual({
      profile: { id: "profile-1", username: "ada" },
      claims: [{ id: "claim-1" }],
      evidenceItems: [{ id: "evidence-1" }],
      bindings: [{ id: "binding-1" }],
      identityDetails: { headline: "Builder" },
    });
    expect(supabase.rpc).toHaveBeenCalledWith("get_public_xrd_share", { p_username: "ada" });
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
