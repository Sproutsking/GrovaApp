import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ProfilePreview from "./ProfilePreview";
import ReelProfilePreview from "./ReelProfilePreview";

describe("profile preview click payloads", () => {
  it("passes a normalized user object to ProfilePreview onClick handlers", () => {
    const onClick = jest.fn();

    render(
      <ProfilePreview
        profile={{ userId: "user-1", author: "Ada Writer", username: "adawriter", verified: true, avatar_id: null }}
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
    }));
  });

  it("passes a normalized user object to ReelProfilePreview onProfileClick handlers", () => {
    const onProfileClick = jest.fn();

    render(
      <ReelProfilePreview
        profile={{ userId: "user-2", author: "Kai Reel", username: "kaireel", verified: false, avatar_id: null }}
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
    }));
  });
});
