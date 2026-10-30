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
});
