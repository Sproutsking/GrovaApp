import RoleModel from "../RoleModel";

describe("RoleModel", () => {
  it("omits the id when creating a fresh role record", () => {
    const role = new RoleModel({
      id: null,
      community_id: "11111111-1111-1111-1111-111111111111",
      name: "Support",
      color: "#00FF00",
      permissions: { viewChannels: true },
    });

    expect(role.toJSON()).not.toHaveProperty("id");
    expect(role.toJSON().name).toBe("Support");
  });

  it("removes null-like ids before insert so Supabase never gets a null primary key", () => {
    const role = new RoleModel({
      id: "null",
      community_id: "11111111-1111-1111-1111-111111111111",
      name: "Support",
      color: "#00FF00",
      permissions: { viewChannels: true },
    });

    expect(role.toJSON()).not.toHaveProperty("id");
  });

  it("uses numeric role position for hierarchy and treats Owner names case-insensitively", () => {
    const owner = new RoleModel({ name: "OWNER", position: 8 });
    const member = new RoleModel({ name: "Member", position: 3 });

    expect(owner.isOwner()).toBe(true);
    expect(owner.canManageRole(member)).toBe(true);
    expect(member.canManageRole(owner)).toBe(false);
  });

  it("recognizes the administrator permission itself as effective", () => {
    const admin = new RoleModel({ name: "Admin", permissions: { administrator: true } });

    expect(admin.hasPermission("administrator")).toBe(true);
    expect(admin.hasPermission("viewChannels")).toBe(true);
    expect(admin.hasPermission("sendMessages")).toBe(true);
    expect(admin.hasPermission("addReactions")).toBe(true);
    expect(admin.hasPermission("manageMessages")).toBe(true);
    expect(admin.hasPermission("manageChannels")).toBe(true);
  });
});
