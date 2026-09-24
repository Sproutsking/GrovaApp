import { resolveAccessForRole } from "../accessService";
import { isCommunityMemberOnline } from "../communityOnlineStatusService";

describe("community access rule enforcement", () => {
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

  it("treats recent last_seen as online even when is_online is false", () => {
    const now = Date.now();
    expect(
      isCommunityMemberOnline({
        is_online: false,
        last_seen: new Date(now - 5_000).toISOString(),
      }, now),
    ).toBe(true);
  });
});
