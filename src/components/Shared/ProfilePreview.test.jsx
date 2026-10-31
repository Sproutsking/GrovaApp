import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ProfilePreview from "./ProfilePreview";
import ReelProfilePreview from "./ReelProfilePreview";

describe("profile preview click payloads", () => {
  it("passes a normalized user object to ProfilePreview onClick handlers", () => {
    const onClick = jest.fn();

    render(
      <ProfilePreview
        profile={{ userId: "user-1", author: "Ada Writer", username: "adawriter", verified: true, avatar_id: "grova/avatars/user-1/avatar", avatar_metadata: { publicUrl: "https://images.example/avatar.png" } }}
        currentUser={null}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText("Ada Writer"));

    expect(onClick).toHaveBeenCalledTimes(1);
    const firstArg = onClick.mock.calls[0][0];
    expect(firstArg).toEqual(expect.objectContaining({
      id: "user-1",
      user_id: "user-1",
      userId: "user-1",
      author: "Ada Writer",
      username: "adawriter",
      verified: true,
      avatar_id: "grova/avatars/user-1/avatar",
      avatar_metadata: { publicUrl: "https://images.example/avatar.png" },
    }));
  });

  it("resolves avatar_url for flat profile objects", () => {
    const onClick = jest.fn();

    render(
      <ProfilePreview
        profile={{ userId: "user-3", author: "Mina Profile", username: "minaprofile", avatar_url: "https://images.example/mina-avatar.png" }}
        currentUser={null}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText("Mina Profile"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].avatar).toContain("mina-avatar.png");
    expect(onClick.mock.calls[0][0].avatar_fallback_urls).toContain("https://images.example/mina-avatar.png");
  });

  it("resolves avatar_url for nested profile objects", () => {
    const onClick = jest.fn();

    render(
      <ProfilePreview
        profile={{ user_id: "user-4", profiles: { full_name: "Noah Nested", username: "noahnested", avatar_url: "https://images.example/noah-avatar.png" } }}
        currentUser={null}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText("Noah Nested"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].avatar).toContain("noah-avatar.png");
  });

  it("passes a normalized user object to ReelProfilePreview onProfileClick handlers", () => {
    const onProfileClick = jest.fn();

    render(
      <ReelProfilePreview
        profile={{ userId: "user-2", author: "Kai Reel", username: "kaireel", verified: false, avatar_id: "grova/avatars/user-2/avatar", avatar_metadata: { publicUrl: "https://images.example/reel-avatar.png" } }}
        music="Late night"
        currentUser={null}
        onProfileClick={onProfileClick}
      />
    );

    fireEvent.click(screen.getByText("Kai Reel"));

    expect(onProfileClick).toHaveBeenCalledTimes(1);
    const firstArg = onProfileClick.mock.calls[0][0];
    expect(firstArg).toEqual(expect.objectContaining({
      id: "user-2",
      user_id: "user-2",
      userId: "user-2",
      author: "Kai Reel",
      username: "kaireel",
      verified: false,
      avatar_id: "grova/avatars/user-2/avatar",
      avatar_metadata: { publicUrl: "https://images.example/reel-avatar.png" },
    }));
  });
});
