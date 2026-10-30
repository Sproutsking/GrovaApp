import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RolesPermissionsSection from "./RolesPermissionsSection";
import { ROLE_PERMISSION_GROUPS } from "./rolePermissionCatalog";
import { DANGEROUS_PERMS } from "../../verification/verificationConfig";

describe("RolesPermissionsSection permissions", () => {
  it("opens the requested role directly from a role-management action", () => {
    const onInitialRoleOpened = jest.fn();
    render(
      <RolesPermissionsSection
        roles={[{ id: "member", name: "Member", permissions: {} }]}
        canManageRoles
        initialRoleId="member"
        onInitialRoleOpened={onInitialRoleOpened}
      />,
    );

    expect(screen.getByDisplayValue("Member")).not.toBeNull();
    expect(onInitialRoleOpened).toHaveBeenCalled();
  });

  it("uses compact color thumbnails and reflects the selected role color", () => {
    render(
      <RolesPermissionsSection
        roles={[{ id: "member", name: "Member", color: "#667eea", permissions: {} }]}
        canManageRoles
      />,
    );

    fireEvent.click(screen.getByText("Member"));
    const palette = screen.getByRole("group", { name: "Choose role color" });
    expect(palette.querySelectorAll("button")).toHaveLength(15);
    expect(screen.getByText("#667EEA")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set role color #9cff00" }));

    expect(screen.getByRole("button", { name: "Set role color #9cff00" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("#9CFF00")).not.toBeNull();
  });

  it("removes only the selected role assignment for a member with stacked roles", async () => {
    const onRemoveRoleAssignment = jest.fn().mockResolvedValue(true);
    const selectedRole = { id: "member-custom", name: "Member", position: 1, permissions: {} };
    const duplicateRole = { id: "member-default", name: "Member", position: 1, is_default: true, permissions: {} };
    const members = [
      {
        id: "membership-1",
        user_id: "user-1",
        role_id: "member-custom",
        roles: [selectedRole, duplicateRole],
        user: { full_name: "Stacked Member", username: "stacked" },
      },
      {
        id: "membership-2",
        user_id: "user-2",
        role_id: "member-default",
        roles: [duplicateRole],
        user: { full_name: "Default Member", username: "default" },
      },
    ];
    render(
      <RolesPermissionsSection
        communityId="community-1"
        roles={[selectedRole, duplicateRole]}
        members={members}
        canManageRoles
        canAssignRoles
        onRemoveRoleAssignment={onRemoveRoleAssignment}
      />,
    );

    fireEvent.click(screen.getByText("Member"));
    fireEvent.click(screen.getByRole("button", { name: "Members" }));

    expect(screen.getByRole("button", { name: "Remove Member role from Stacked Member" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Member role from Default Member" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove Member role from Stacked Member" }));

    await waitFor(() => expect(onRemoveRoleAssignment).toHaveBeenCalledWith("user-1", "member-custom"));
    expect((await screen.findByRole("status")).textContent).toContain("remaining roles still determine access");
  });

  it("presents permissions as selectable cards and saves the chosen state", async () => {
    const onUpdateRole = jest.fn().mockResolvedValue(undefined);
    const role = { id: "member", name: "Member", permissions: {} };
    render(
      <RolesPermissionsSection
        communityId="community"
        roles={[role]}
        canManageRoles
        onUpdateRole={onUpdateRole}
      />,
    );

    fireEvent.click(screen.getByText("Member"));
    fireEvent.click(screen.getByRole("button", { name: "Permissions" }));

    const viewChannelsOn = screen.getByRole("button", { name: "View Channels permission On" });
    const viewChannelsOff = screen.getByRole("button", { name: "View Channels permission Off" });
    expect(viewChannelsOn.getAttribute("aria-pressed")).toBe("false");
    expect(viewChannelsOff.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(viewChannelsOn);
    expect(viewChannelsOn.getAttribute("aria-pressed")).toBe("true");
    expect(viewChannelsOff.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(viewChannelsOff);
    expect(viewChannelsOn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(viewChannelsOn);

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await screen.findByRole("button", { name: /Saved/ });
    expect(onUpdateRole).toHaveBeenCalledWith("member", expect.objectContaining({
      permissions: expect.objectContaining({ viewChannels: true }),
    }));
  });

  it("keeps group actions side by side and never bulk-enables high-impact permissions", () => {
    render(
      <RolesPermissionsSection
        roles={[{ id: "member", name: "Member", permissions: {} }]}
        canManageRoles
      />,
    );

    fireEvent.click(screen.getByText("Member"));
    fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search permissions" }), { target: { value: "Channels" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable safe General permissions" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search permissions" }), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "View Audit Log permission On" }).getAttribute("aria-pressed")).toBe("true");
    ROLE_PERMISSION_GROUPS.forEach((group) => {
      fireEvent.click(screen.getByRole("button", { name: `Enable safe ${group.label} permissions` }));
    });

    expect(screen.getByRole("button", { name: "View Channels permission On" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Clear General permissions" })).not.toBeNull();
    const permissions = ROLE_PERMISSION_GROUPS.flatMap((group) => group.perms);
    const dangerousOnStates = DANGEROUS_PERMS
      .map((key) => permissions.find((permission) => permission.key === key))
      .filter(Boolean)
      .map((permission) => screen.getByRole("button", { name: `${permission.label} permission On` }).getAttribute("aria-pressed"));
    expect(dangerousOnStates).toHaveLength(DANGEROUS_PERMS.length);
    expect(dangerousOnStates.every((state) => state === "false")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Administrator permission On" }));
    expect(screen.getByRole("button", { name: "Administrator permission On" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Administrator permission Off" }));
    expect(screen.getByRole("button", { name: "Administrator permission On" }).getAttribute("aria-pressed")).toBe("false");
  });
});
