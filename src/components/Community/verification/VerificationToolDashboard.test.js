import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationToolDashboard from "./VerificationToolDashboard";

describe("VerificationToolDashboard", () => {
  it("explains why an enabled method cannot be used by members", () => {
    render(
      <VerificationToolDashboard
        value={{ methods: { quick: { enabled: true } } }}
        roles={[{ id: "default", name: "Novice", position: 2, is_default: true, permissions: {} }]}
      />,
    );

    expect(screen.getByText("Choose at least one role members can unlock.")).not.toBeNull();
    expect(screen.getByText("Choose at least one role members can unlock.")).not.toBeNull();
  });

  it("does not save role selection when no eligible role is selected", () => {
    const onSave = jest.fn();
    render(
      <VerificationToolDashboard
        focusMode="role_grant"
        value={{ roleGrant: { enabled: false, roleIds: [] } }}
        roles={[{ id: "default", name: "Novice", position: 2, is_default: true, permissions: {} }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByLabelText("Enable verified role selection"));
    fireEvent.click(screen.getByRole("button", { name: "Save reward roles" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Choose at least one eligible role");
  });

  it("shows the saved check as ready when returning to the setup overview", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const props = {
      value: {
        roleGrant: { enabled: true, roleIds: ["verified"] },
        methods: { quick: { enabled: false } },
      },
      roles: [
        { id: "default", name: "Novice", position: 2, is_default: true, permissions: {} },
        { id: "verified", name: "Verified", position: 1, permissions: {} },
      ],
      selectedChannelIds: ["verification"],
      onSave,
    };
    const { rerender } = render(<VerificationToolDashboard {...props} focusMode="quick" />);

    fireEvent.click(screen.getByRole("radio", { name: /Obsidian/ }));
    fireEvent.change(screen.getByLabelText("Congratulations heading"), { target: { value: "Access granted!" } });
    fireEvent.click(screen.getByLabelText("Activate Quick Verify"));
    fireEvent.click(screen.getByRole("button", { name: "Save Quick Verify" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      panel: expect.objectContaining({ theme: "obsidian" }),
      completion: expect.objectContaining({ title: "Access granted!" }),
      methods: expect.objectContaining({ quick: expect.objectContaining({ enabled: true }) }),
    })));

    rerender(<VerificationToolDashboard {...props} focusMode={null} />);

    expect(screen.getByText("Ready")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Quick verify/ })).not.toBeNull();
  });

  it("shows a useful error when saving a verification check fails", async () => {
    render(
      <VerificationToolDashboard
        focusMode="quick"
        value={{ methods: { quick: { enabled: true } } }}
        onSave={jest.fn().mockRejectedValue(new Error("Database unavailable"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Quick Verify" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Database unavailable");
  });

  it("shows a useful error when promoting an existing role fails", async () => {
    render(
      <VerificationToolDashboard
        focusMode="quick"
        value={{ methods: { quick: { enabled: true } } }}
        roles={[
          { id: "member", name: "Member", position: 1, is_default: true, permissions: {} },
          { id: "existing", name: "Existing team", position: 2, permissions: {} },
        ]}
        onPromoteRole={jest.fn().mockRejectedValue(new Error("Role hierarchy update denied"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Existing team above default role" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Role hierarchy update denied");
  });

  it("saves the role selected for Quick Verify", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <VerificationToolDashboard
        focusMode="quick"
        roles={[
          { id: "member", name: "Member", position: 2, is_default: true, permissions: {} },
          { id: "verified", name: "Verified", position: 1, permissions: {} },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Verified role" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Quick Verify" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      methods: expect.objectContaining({
        quick: expect.objectContaining({ roleId: "verified" }),
      }),
    })));
  });

  it("shows entry-channel selection inside the selected verification option", () => {
    const onToggleChannel = jest.fn();
    const channels = ["general", "announcements", "verify", "rules", "welcome", "support"]
      .map((name) => ({ id: name, name, type: "text" }));
    render(<VerificationToolDashboard focusMode="quick" channels={channels} onToggleChannel={onToggleChannel} />);

    expect(screen.getByText("Send the verification panel to")).not.toBeNull();
    expect(screen.getByText("Member panel preview")).not.toBeNull();
    expect(screen.getByRole("button", { name: /#verify/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /#verify/ }));
    expect(onToggleChannel).toHaveBeenCalledWith("verify");
  });

  it("saves the configured check before publishing its verification panel", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onPublish = jest.fn().mockResolvedValue(undefined);
    render(
      <VerificationToolDashboard
        focusMode="quick"
        channels={[{ id: "verify", name: "verify", type: "text" }]}
        value={{ roleGrant: { enabled: true, roleIds: ["verified"] } }}
        roles={[
          { id: "member", name: "Member", position: 2, is_default: true, permissions: {} },
          { id: "verified", name: "Verified", position: 1, permissions: {} },
        ]}
        selectedChannelIds={["verify"]}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByLabelText("Activate Quick Verify"));
    fireEvent.click(screen.getByRole("button", { name: "Save and publish panel" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalled());
  expect(screen.getByText("Member panel preview")).not.toBeNull();
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onPublish.mock.invocationCallOrder[0]);
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({
      methods: expect.objectContaining({ quick: expect.objectContaining({ enabled: true }) }),
    }));
  });

  it("switches the live member preview between mobile and desktop", () => {
    render(
      <VerificationToolDashboard
        focusMode="quick"
        value={{ methods: { quick: { enabled: true } } }}
      />,
    );

    expect(screen.getByRole("group", { name: "Preview device" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    expect(screen.getByText("Desktop")).not.toBeNull();
  });

  it("creates and selects a safe role in the role-grant workspace", async () => {
    const roles = [{ id: "member", name: "Member", position: 2, is_default: true, permissions: {} }];
    const createdRole = { id: "verified", name: "Verified", position: 1, permissions: {} };
    const onCreateRole = jest.fn(async () => {
      roles.push(createdRole);
      return createdRole;
    });

    render(
      <VerificationToolDashboard
        focusMode="role_grant"
        value={{ roleGrant: { enabled: false, roleIds: [] } }}
        roles={roles}
        onCreateRole={onCreateRole}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create a safe role" }));
    fireEvent.change(screen.getByLabelText("New role name"), { target: { value: "Verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => expect(onCreateRole).toHaveBeenCalledWith("Verified"));
    expect(screen.getByRole("checkbox", { name: /Verified/ }).checked).toBe(true);
  });

  it("selects an existing role after promoting it above the default rank", async () => {
    const onPromoteRole = jest.fn().mockResolvedValue(true);
    render(
      <VerificationToolDashboard
        focusMode="role_grant"
        value={{ roleGrant: { enabled: false, roleIds: [] } }}
        roles={[
          { id: "owner", name: "Owner", position: 0, permissions: { administrator: true } },
          { id: "member", name: "Member", position: 1, is_default: true, permissions: {} },
          { id: "existing", name: "Existing team", position: 2, permissions: {} },
        ]}
        canManageRoles
        onPromoteRole={onPromoteRole}
      />,
    );

    expect(screen.getByText("Existing team")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /Existing team/ }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /Existing team/ }));
    await waitFor(() => {
      expect(onPromoteRole).toHaveBeenCalledWith("existing");
      expect(screen.getByRole("checkbox", { name: /Enable verified role selection/ }).checked).toBe(true);
      expect(screen.getByRole("checkbox", { name: /Existing team/ }).checked).toBe(true);
    });
  });

  it("saves the selected role for Picture Check", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <VerificationToolDashboard
        focusMode="picture"
        roles={[{ id: "verified", name: "Verified", position: 1, permissions: {} }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Verified role" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Picture Check" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      methods: expect.objectContaining({ picture: expect.objectContaining({ roleId: "verified" }) }),
    })));
  });

  it("keeps unsafe roles visible for review, but blocks granting them until their permissions are safe", async () => {
    const defaultRole = { id: "member", name: "Member", position: 2, is_default: true, permissions: {} };
    const unsafeRole = { id: "unsafe", name: "Power role", position: 1, permissions: { manageRoles: true } };
    const safeRole = { ...unsafeRole, permissions: { manageRoles: false } };
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onUpdateRole = jest.fn().mockResolvedValue(safeRole);
    const baseProps = {
      focusMode: "role_grant",
      value: { roleGrant: { enabled: true, roleIds: ["unsafe"] } },
      canManageRoles: true,
      onSave,
      onUpdateRole,
    };
    const { rerender } = render(<VerificationToolDashboard {...baseProps} roles={[defaultRole, unsafeRole]} />);

    expect(screen.getByText(/High-impact permissions prevent this role from being granted/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Review permissions & channels/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save reward roles" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Remove roles marked unavailable");

    fireEvent.click(screen.getByRole("button", { name: /Review permissions & channels/ }));
    fireEvent.click(screen.getByRole("button", { name: "Manage Roles permission Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Save role permissions" }));
    await screen.findByText("Saved");

    rerender(<VerificationToolDashboard {...baseProps} roles={[defaultRole, safeRole]} />);
    fireEvent.click(screen.getByRole("button", { name: "Save reward roles" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("offers safe grant roles within the selected check and previews the member panel", () => {
    const roles = [
      { id: "member", name: "Member", position: 2, is_default: true, permissions: {} },
      { id: "verified", name: "Verified", position: 1, permissions: {} },
    ];
    render(<VerificationToolDashboard focusMode="quick" roles={roles} />);

    expect(screen.getByLabelText("Role granted after this check")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Select Verified role" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Unavailable Member role" }).disabled).toBe(true);
    expect(screen.getByText("Member panel preview")).not.toBeNull();
  });
});
