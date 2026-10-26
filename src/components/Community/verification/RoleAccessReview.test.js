import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RoleAccessReview from "./RoleAccessReview";

jest.mock("../components/sections/RoleAccessPanel", () => function MockRoleAccessPanel({ canManage }) {
  return <div>{canManage ? "Editable channel access" : "Read-only channel access"}</div>;
});

describe("RoleAccessReview", () => {
  it("edits the role's shared permission state and saves it", async () => {
    const role = {
      id: "verified",
      name: "Verified",
      permissions: { viewChannels: true },
    };
    const onUpdateRole = jest.fn().mockResolvedValue(role);
    render(
      <RoleAccessReview
        role={role}
        communityId="community"
        roles={[role]}
        canManage
        onUpdateRole={onUpdateRole}
      />,
    );

    expect(screen.getByRole("button", { name: "View Channels permission On" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Send Messages permission On" }));
    expect(screen.getByRole("button", { name: "Send Messages permission On" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Save role permissions" }));
    await screen.findByText("Saved");
    expect(onUpdateRole).toHaveBeenCalledWith("verified", {
      permissions: expect.objectContaining({ viewChannels: true, sendMessages: true }),
    });
    expect(screen.getByText("Editable channel access")).not.toBeNull();
  });

  it("keeps permission controls read-only without role-management access", () => {
    render(
      <RoleAccessReview
        role={{ id: "verified", name: "Verified", permissions: {} }}
        communityId="community"
      />,
    );

    expect(screen.getByRole("button", { name: "View Channels permission On" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Save role permissions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Read-only channel access")).not.toBeNull();
  });
});
