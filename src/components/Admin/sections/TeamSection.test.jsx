import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminOnlinePanel } from "../AdminUI.jsx";
import TeamSection from "./TeamSection.jsx";

describe("admin team dashboard", () => {
  it("adds a selected user from name search by profile id", async () => {
    const user = {
      id: "profile-123",
      full_name: "Amina Yusuf",
      username: "aminay",
      email: "amina@example.com",
    };
    const searchUsers = jest.fn().mockResolvedValue([user]);
    const addMember = jest.fn().mockResolvedValue(undefined);
    const teamMgmt = {
      team: [],
      loading: false,
      error: null,
      load: jest.fn(),
      searchUsers,
      addMember,
      removeMember: jest.fn(),
      updateRole: jest.fn(),
    };

    render(
      <TeamSection
        adminData={{ role: "ceo_owner", user_id: "ceo-profile", permissions: ["all"] }}
        teamMgmt={teamMgmt}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add Member" })[0]);
    fireEvent.change(screen.getByLabelText("Search users to add to the admin team"), {
      target: { value: "Amina" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /Amina Yusuf/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add Member" }).at(-1));

    await waitFor(() => {
      expect(addMember).toHaveBeenCalledWith(expect.objectContaining({
        userId: "profile-123",
        email: "amina@example.com",
        role: "b_admin",
      }));
    });
  });

  it("keeps email-based admin addition available", async () => {
    const addMember = jest.fn().mockResolvedValue(undefined);
    const teamMgmt = {
      team: [],
      loading: false,
      error: null,
      load: jest.fn(),
      searchUsers: jest.fn().mockResolvedValue([]),
      addMember,
      removeMember: jest.fn(),
      updateRole: jest.fn(),
    };

    render(
      <TeamSection
        adminData={{ role: "ceo_owner", user_id: "ceo-profile", permissions: ["all"] }}
        teamMgmt={teamMgmt}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add Member" })[0]);
    fireEvent.change(screen.getByPlaceholderText("admin@example.com"), {
      target: { value: "new-admin@example.com" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add Member" }).at(-1));

    await waitFor(() => {
      expect(addMember).toHaveBeenCalledWith(expect.objectContaining({
        userId: "",
        email: "new-admin@example.com",
      }));
    });
  });

  it("shows a real online count and lists recently seen admins", () => {
    render(
      <AdminOnlinePanel
        currentAdminUserId="profile-1"
        team={[
          {
            id: "team-1",
            user_id: "profile-1",
            full_name: "Online Admin",
            role: "admin",
            is_online: true,
          },
          {
            id: "team-2",
            user_id: "profile-2",
            full_name: "Away Admin",
            role: "support",
            is_online: false,
            last_active: new Date().toISOString(),
          },
        ]}
      />
    );

    expect(screen.getByText("1 Online")).not.toBeNull();
    expect(screen.getByText("Online Admin")).not.toBeNull();
    expect(screen.getByText("Away Admin")).not.toBeNull();
  });
});
