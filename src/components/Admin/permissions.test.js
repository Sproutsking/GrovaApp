import { getVisibleSections } from "./permissions";

describe("Community Premium admin access", () => {
  test("shows the section to the CEO", () => {
    expect(getVisibleSections({ role: "ceo_owner" })).toContain("premium");
  });

  test("does not grant the section to other roles, including admins with all permissions", () => {
    expect(getVisibleSections({ role: "super_admin", permissions: ["all"] })).not.toContain("premium");
    expect(getVisibleSections({ role: "admin", permissions: ["manage_settings"] })).not.toContain("premium");
  });
});
