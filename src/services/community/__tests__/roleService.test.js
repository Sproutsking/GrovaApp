import roleService from "../roleService";
import { supabase } from "../../config/supabase";

jest.mock("../../config/supabase", () => ({
  supabase: { from: jest.fn() },
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
      { id: "owner-role", community_id: "community-1", name: "Owner", position: 4 },
      { id: "member-role", community_id: "community-1", name: "Member", position: 1 },
      { id: "default-role", community_id: "community-1", name: "Member", position: 1, is_default: true },
      { id: "other-community-role", community_id: "community-2", name: "Other", position: 0 },
    ], "community-1", "owner-1")).resolves.toBe(true);

    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(updateQuery.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ position: 0 }));
    expect(updateQuery.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ position: 1 }));
    expect(updateQuery.update).toHaveBeenNthCalledWith(3, expect.objectContaining({ position: 2 }));
  });
});
