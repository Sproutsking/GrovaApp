import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ContextMenu from "./ContextMenu";

jest.mock("./EmojiPanel", () => () => null);

const renderMenu = (props = {}) => render(
  <ContextMenu
    position={{ x: 20, y: 20 }}
    message={{ id: "message-1", user_id: "me", content: "Hello" }}
    userId="me"
    onClose={jest.fn()}
    onDelete={jest.fn()}
    {...props}
  />,
);

describe("message action menu confirmation flow", () => {
  it("shows only the delete confirmation and restores the action menu on cancel", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /delete message/i }));

    expect(screen.getByRole("dialog", { name: "Delete message?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keep message" }));

    expect(screen.queryByRole("dialog", { name: "Delete message?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
  });

  it("closes the menu before confirming deletion", () => {
    const onClose = jest.fn();
    const onDelete = jest.fn();
    renderMenu({ onClose, onDelete });

    fireEvent.click(screen.getByRole("button", { name: /delete message/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onClose).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("returns to the action menu when the delete confirmation is dismissed with Escape", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /delete message/i }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Delete message?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
  });
});
