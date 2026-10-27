import { accessRuleAllowsPermission, compareEffectiveRoles, resolveAccessForRole, resolveChannelPermission } from "../accessService";
import { isCommunityMemberOnline } from "../communityOnlineStatusService";

describe("community access rule enforcement", () => {
  it("selects the same effective role as the database when role positions tie", () => {
    const roles = [
      { id: "later", name: "Verified", position: 1, created_at: "2026-02-01T00:00:00Z" },
      { id: "earlier", name: "Member", position: 1, created_at: "2026-01-01T00:00:00Z" },
      { id: "owner", name: "Owner", position: 10, created_at: "2026-03-01T00:00:00Z" },
    ];

    expect(roles.sort(compareEffectiveRoles).map((role) => role.id))
      .toEqual(["owner", "earlier", "later"]);
  });

  it("blocks role access when category has rules and the user role is not allowed", () => {
    const result = resolveAccessForRole({
      roleId: "member-role",
      channel: { id: "channel-1", category_id: "category-1" },
      categoryId: "category-1",
      rules: [
        { target_type: "category", target_id: "category-1", role_id: "admin-role", can_view: true, can_send: true },
      ],
    });

    expect(result.canView).toBe(false);
    expect(result.canSend).toBe(false);
  });

  it("allows the role if its channel rule grants view and send access", () => {
    const result = resolveAccessForRole({
      roleId: "member-role",
      channel: { id: "channel-1", category_id: "category-1" },
      categoryId: "category-1",
      rules: [
        { target_type: "channel", target_id: "channel-1", role_id: "member-role", can_view: true, can_send: true },
      ],
    });

    expect(result.canView).toBe(true);
    expect(result.canSend).toBe(true);
  });

  it("falls back to a category rule when the channel itself is open", () => {
    const result = resolveAccessForRole({
      roleId: "admin-role",
      channel: { id: "channel-2", category_id: "category-2" },
      categoryId: "category-2",
      rules: [
        { target_type: "category", target_id: "category-2", role_id: "admin-role", can_view: true, can_send: false },
      ],
    });

    expect(result.canView).toBe(true);
    expect(result.canSend).toBe(false);
  });

  it("keeps reaction access independent from message-send access", () => {
    const viewOnlyAccess = { restricted: true, canView: true, canSend: false };

    expect(accessRuleAllowsPermission(viewOnlyAccess, "addReactions")).toBe(true);
    expect(accessRuleAllowsPermission(viewOnlyAccess, "sendMessages")).toBe(false);
    expect(accessRuleAllowsPermission({ ...viewOnlyAccess, canView: false }, "addReactions")).toBe(false);
  });

  it("uses channel overrides before category overrides and role defaults", () => {
    expect(resolveChannelPermission({
      access: { restricted: false },
      permission: "viewChannel",
      channelOverride: { state: "deny" },
      categoryOverride: { state: "allow" },
      roleDefault: true,
    })).toBe(false);
    expect(resolveChannelPermission({
      access: { restricted: false },
      permission: "viewChannel",
      categoryOverride: { state: "allow" },
      roleDefault: false,
    })).toBe(true);
  });

  it("keeps explicit access rules authoritative while allowing a narrower deny override", () => {
    const access = { restricted: true, canView: true, canSend: true };
    expect(resolveChannelPermission({ access, permission: "viewChannel", roleDefault: false })).toBe(true);
    expect(resolveChannelPermission({ access, permission: "viewChannel", channelOverride: { state: "deny" }, roleDefault: true })).toBe(false);
    expect(resolveChannelPermission({ access: { ...access, canView: false }, permission: "viewChannel", channelOverride: { state: "allow" }, roleDefault: true })).toBe(false);
  });

  it("treats recent last_seen as online even when is_online is false", () => {
    const now = Date.now();
    expect(
      isCommunityMemberOnline({
        is_online: false,
        last_seen: new Date(now - 5_000).toISOString(),
      }, now),
    ).toBe(true);
  });

  it("does not treat an old online flag as active after its last_seen expires", () => {
    const now = Date.now();
    expect(
      isCommunityMemberOnline({
        is_online: true,
        last_seen: new Date(now - 2 * 60_000).toISOString(),
      }, now),
    ).toBe(false);
  });
});
