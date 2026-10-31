import { buildContentShareUrl } from "./shareLinks";

describe("buildContentShareUrl", () => {
  it("creates a profile link using the public username when available", () => {
    expect(buildContentShareUrl("profile", { id: "profile-id", username: "ada-builds" }))
      .toBe(`${window.location.origin}/profile/ada-builds`);
  });

  it("falls back to the profile id when there is no username", () => {
    expect(buildContentShareUrl("profile", { id: "profile-id" }))
      .toBe(`${window.location.origin}/profile/profile-id`);
  });

  it("does not use the profile modal's placeholder username as the share URL", () => {
    expect(buildContentShareUrl("profile", { id: "profile-id", username: "unknown" }))
      .toBe(`${window.location.origin}/profile/profile-id`);
  });
});
