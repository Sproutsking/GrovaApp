import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("selects a role after its rank is successfully promoted", async () => {
    const onPromoteRole = jest.fn();
    const onSelect = jest.fn();
    render(<VerificationRoleSelector roles={roles} onPromoteRole={onPromoteRole} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Ranked above default role" }));
    await waitFor(() => {
      expect(onPromoteRole).toHaveBeenCalledWith("ranked");
      expect(onSelect).toHaveBeenCalledWith("ranked");
    });
  });

  it("lets the owner select a safe below-default role from its card", async () => {
    const onPromoteRole = jest.fn().mockResolvedValue(true);
    const onSelect = jest.fn();
    render(<VerificationRoleSelector roles={roles} onPromoteRole={onPromoteRole} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Promote and select Ranked role" }));

    await waitFor(() => {
      expect(onPromoteRole).toHaveBeenCalledWith("ranked");
      expect(onSelect).toHaveBeenCalledWith("ranked");
    });
  });

  it("does not select a role when rank promotion fails", async () => {
    const onSelect = jest.fn();
    render(
      <VerificationRoleSelector
        roles={roles}
        onPromoteRole={jest.fn().mockResolvedValue(false)}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Ranked above default role" }));
    await waitFor(() => expect(onSelect).not.toHaveBeenCalled());
  });

  it("groups duplicate names and selects the eligible underlying role", () => {
    const onSelect = jest.fn();
    render(<VerificationRoleSelector roles={[
      { id: "default-member", name: "Member", is_default: true, position: 3 },
      { id: "verified-member", name: "Member", position: 1, permissions: {} },
    ]} onSelect={onSelect} />);

    const group = screen.getByRole("button", { name: "Select Member role (2 entries)" });
    expect(group.textContent).toContain("2 matching role entries");
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledWith("verified-member");
  });
});
