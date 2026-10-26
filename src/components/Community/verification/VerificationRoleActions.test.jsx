import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationRoleActions from "./VerificationRoleActions";

describe("VerificationRoleActions", () => {
  const role = { id: "role-1", name: "Verified" };

  it("opens the role editor from Manage role", () => {
    const onManageRole = jest.fn();
    render(<VerificationRoleActions role={role} canManage onManageRole={onManageRole} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Verified role" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Manage role" }));

    expect(onManageRole).toHaveBeenCalledWith("role-1");
  });

  it("requires confirmation before deleting a role", async () => {
    const onDeleteRole = jest.fn().mockResolvedValue(undefined);
    render(<VerificationRoleActions role={role} canManage onDeleteRole={onDeleteRole} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Verified role" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete role" }));
    expect(onDeleteRole).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("menuitem", { name: "Delete role" }));
    await waitFor(() => expect(onDeleteRole).toHaveBeenCalledWith("role-1"));
  });

  it("does not allow default or owner roles to be deleted", () => {
    render(<VerificationRoleActions role={{ ...role, is_default: true }} canManage onDeleteRole={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Verified role" }));

    expect(screen.getByRole("menuitem", { name: "Delete role" }).disabled).toBe(true);
  });

  it("shows deletion errors without closing the action menu", async () => {
    const onDeleteRole = jest.fn().mockRejectedValue(new Error("Role is still assigned."));
    render(<VerificationRoleActions role={role} canManage onDeleteRole={onDeleteRole} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Verified role" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete role" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete role" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Role is still assigned.");
  });
});
