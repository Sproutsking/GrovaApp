import { canAccessCommunityMenuView, getCommunityMenuAccess } from "./communityMenuAccess";

describe("community menu access", () => {
  it("does not grant management entries before permissions load", () => {
    const access = getCommunityMenuAccess({ administrator: true }, { permissionsLoaded: false });

    expect(access.canManageTools).toBe(false);
    expect(canAccessCommunityMenuView("tools", access)).toBe(false);
  });

  it("keeps ordinary members out of setup and management views", () => {
    const access = getCommunityMenuAccess({
      viewMembers: true,
      sendMessages: true,
    });

    expect(canAccessCommunityMenuView("members", access)).toBe(true);
    expect(canAccessCommunityMenuView("help", access)).toBe(false);
    expect(canAccessCommunityMenuView("tools", access)).toBe(false);
    expect(canAccessCommunityMenuView("roles", access)).toBe(false);
  });

  it("grants administrators every management menu", () => {
    const access = getCommunityMenuAccess({ administrator: true });

    ["help", "settings", "analytics", "roles", "tools", "channels", "categories"].forEach((view) => {
      expect(canAccessCommunityMenuView(view, access)).toBe(true);
    });
  });

  it("limits delegated managers to the menus covered by their permissions", () => {
    const access = getCommunityMenuAccess({ manageChannels: true });

    expect(canAccessCommunityMenuView("channels", access)).toBe(true);
    expect(canAccessCommunityMenuView("categories", access)).toBe(false);
    expect(canAccessCommunityMenuView("tools", access)).toBe(false);
    expect(canAccessCommunityMenuView("settings", access)).toBe(false);
  });

  it("allows analytics-only access without exposing community settings", () => {
    const access = getCommunityMenuAccess({ viewAnalytics: true });

    expect(canAccessCommunityMenuView("analytics", access)).toBe(true);
    expect(canAccessCommunityMenuView("settings", access)).toBe(false);
    expect(canAccessCommunityMenuView("help", access)).toBe(false);
  });
});
