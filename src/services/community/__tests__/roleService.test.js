import roleService from "../roleService";
import { supabase } from "../../config/supabase";

jest.mock("../../config/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

describe("RoleService.reorderRoles", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("rejects role data without community IDs instead of reporting a false success", async () => {
    jest.spyOn(roleService, "hasPermission").mockResolvedValue(true);

    await expect(roleService.reorderRoles(
      [{ id: "member-role", name: "Member", position: 1 }],
      "community-1",
      "owner-1",
    )).rejects.toThrow("No roles for this community could be reordered.");

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("persists contiguous positions for roles belonging to the community", async () => {
    jest.spyOn(roleService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(roleService, "getUserRole").mockResolvedValue(null);
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    supabase.from.mockReturnValue(updateQuery);

    await expect(roleService.reorderRoles([
      { id: "default-role", community_id: "community-1", name: "Novice", position: 1, is_default: true },
      { id: "member-role", community_id: "community-1", name: "Member", position: 1 },
      { id: "owner-role", community_id: "community-1", name: "Owner", position: 4 },
      { id: "other-community-role", community_id: "community-2", name: "Other", position: 0 },
    ], "community-1", "owner-1")).resolves.toBe(true);

    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(updateQuery.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ position: 0 }));
    expect(updateQuery.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ position: 1 }));
    expect(updateQuery.update).toHaveBeenNthCalledWith(3, expect.objectContaining({ position: 2 }));
    expect(updateQuery.eq.mock.calls.filter(([column]) => column === "id"))
      .toEqual([["id", "owner-role"], ["id", "member-role"], ["id", "default-role"]]);
  });

  it("removes only the requested member role assignment", async () => {
    supabase.rpc.mockResolvedValue({
      data: { success: true, effective_role_id: "remaining-role" },
      error: null,
    });

    await expect(roleService.removeMemberRole("community-1", "user-1", "role-to-remove"))
      .resolves.toEqual({ success: true, effective_role_id: "remaining-role" });

    expect(supabase.rpc).toHaveBeenCalledWith("remove_community_member_role", {
      p_community_id: "community-1",
      p_user_id: "user-1",
      p_role_id: "role-to-remove",
    });
  });

  it("reports unsuccessful role removal responses", async () => {
    supabase.rpc.mockResolvedValue({
      data: { success: false, error: "The role assignment is protected." },
      error: null,
    });

    await expect(roleService.removeMemberRole("community-1", "user-1", "protected-role"))
      .rejects.toThrow("The role assignment is protected.");
  });

  it("resolves all channel permissions using one shared role and access lookup", async () => {
    jest.spyOn(roleService, "getUserRole").mockResolvedValue({
      id: "member-role",
      name: "Member",
      permissions: {
        viewChannels: true,
        sendMessages: true,
        addReactions: true,
        attachFiles: true,
        mentionEveryone: false,
        manageMessages: false,
      },
    });
    jest.spyOn(roleService, "getAccessRulesForCommunity").mockResolvedValue([]);

    const queryFor = (data) => {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        in: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return query;
    };
    supabase.from.mockImplementation((table) => queryFor(
      table === "channel_permission_overrides"
        ? [{ permission: "sendMessages", state: "deny" }]
        : [{ permission: "attachFiles", state: "deny" }, { permission: "mentionEveryone", state: "allow" }],
    ));

    await expect(roleService.getChannelPermissions(
      "community-1",
      "user-1",
      { id: "channel-1", category_id: "category-1", is_private: false },
      ["sendMessages", "addReactions", "attachFiles", "mentionEveryone", "manageMessages"],
    )).resolves.toEqual({
      sendMessages: false,
      addReactions: true,
      attachFiles: false,
      mentionEveryone: true,
      manageMessages: false,
    });

    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
