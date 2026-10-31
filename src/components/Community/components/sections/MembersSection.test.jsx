import { groupMembersByDisplayRole, groupRolesForDisplay } from "./MembersSection";

jest.mock("../CommunityProfileModal", () => () => null);
jest.mock("../../../Modals/UserProfileModal", () => () => null);

describe("MembersSection role grouping", () => {
  it("displays duplicate Novice role records as one role group with all effective members", () => {
    const novice = { id: "novice", name: "Novice", is_default: true };
    const duplicateNovice = { id: "legacy-novice", name: "Novis" };
    const owner = { id: "owner", name: "Owner" };
    const roles = [owner, novice, duplicateNovice];
    const members = [
      { id: "membership-1", role_id: novice.id },
      { id: "membership-2", role_id: duplicateNovice.id },
      { id: "membership-3", role_id: owner.id },
    ];

    const groups = groupMembersByDisplayRole(roles, members);
    const noviceGroups = groups.filter((group) => group.role.name === "Novice");

    expect(groupRolesForDisplay(roles)).toHaveLength(2);
    expect(noviceGroups).toHaveLength(1);
    expect(noviceGroups[0].members.map((member) => member.id)).toEqual([
      "membership-1",
      "membership-2",
    ]);
  });

  it("does not list a member twice in a role group", () => {
    const novice = { id: "novice", name: "Novice", is_default: true };
    const member = {
      id: "membership-1",
      role_id: novice.id,
      role: novice,
      roles: [novice],
    };

    const groups = groupMembersByDisplayRole([novice], [member]);

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(1);
  });
});
