import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import VerificationRoleSelector from "./VerificationRoleSelector";

const roles = [
  { id: "member", name: "Member", is_default: true, position: 10 },
  { id: "verified", name: "Verified", position: 3, permissions: {} },
  { id: "moderator", name: "Moderator", position: 2, permissions: { manageRoles: true } },
  { id: "ranked", name: "Ranked", position: 12, permissions: {} },
];

describe("VerificationRoleSelector", () => {
  it("shows existing community roles as selectable cards and explains unavailable roles", () => {
    const onSelect = jest.fn();
    render(<VerificationRoleSelector roles={roles} selectedRoleId="verified" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: "Select Verified role" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Unavailable Member role" }).disabled).toBe(true);
    expect(screen.getByText("Default member role cannot be granted.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Unavailable Moderator role" }).disabled).toBe(true);
    expect(screen.getByText("High-impact permissions prevent this role from being granted.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select Verified role" }));
    expect(onSelect).toHaveBeenCalledWith("verified");
  });

  it("offers rank promotion for roles below the default role", () => {
    const onPromoteRole = jest.fn();
    render(<VerificationRoleSelector roles={roles} onPromoteRole={onPromoteRole} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Ranked above default role" }));
    expect(onPromoteRole).toHaveBeenCalledWith("ranked");
  });
});
