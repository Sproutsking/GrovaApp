import RoleModel from "../RoleModel";

describe("RoleModel", () => {
  it("omits the id when creating a fresh role record", () => {
    const role = new RoleModel({
      community_id: "11111111-1111-1111-1111-111111111111",
      name: "Support",
      color: "#00FF00",
      permissions: { viewChannels: true },
    });

    expect(role.toJSON()).not.toHaveProperty("id");
    expect(role.toJSON().name).toBe("Support");
  });
});
