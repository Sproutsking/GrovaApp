import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CommunityMessageInput from "./CommunityMessageInput";

const originalMatchMedia = window.matchMedia;

const mockMobileViewport = (matches) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn().mockReturnValue({ matches }),
  });
};

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  } else {
    delete window.matchMedia;
  }
});

describe("CommunityMessageInput keyboard submission", () => {
  it("does not focus the composer automatically on mobile", () => {
    mockMobileViewport(true);

    render(<CommunityMessageInput value="" onChange={jest.fn()} onSend={jest.fn()} />);

    expect(screen.getByPlaceholderText("Type a message...")).not.toHaveFocus();
  });

  it("continues focusing the composer automatically on desktop", () => {
    mockMobileViewport(false);

    render(<CommunityMessageInput value="" onChange={jest.fn()} onSend={jest.fn()} />);

    expect(screen.getByPlaceholderText("Type a message...")).toHaveFocus();
  });

  it("sends on Enter and preserves Shift+Enter for a newline", async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    render(<CommunityMessageInput value="Hello" onChange={jest.fn()} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows announcement styling and preview controls for announcement channels", () => {
    render(
      <CommunityMessageInput
        value="Community details"
        onChange={jest.fn()}
        onSend={jest.fn()}
        channelType="announcement"
        canManageAnnouncement
      />,
    );

    expect(screen.getByText("Border")).not.toBeNull();
    expect(screen.getByPlaceholderText("Announcement title (optional)")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    expect(screen.getByText("How your post will appear")).not.toBeNull();
  });

  it("keeps the message field dark while animating only its gradient border", () => {
    render(<CommunityMessageInput value="" onChange={jest.fn()} onSend={jest.fn()} />);

    expect(screen.getByPlaceholderText("Type a message...")).toHaveClass("comm-textarea");

    // The test inspects an inline style tag, which is not exposed as accessible UI.
    // eslint-disable-next-line testing-library/no-node-access
    const componentStyles = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("\n");
    expect(componentStyles).toContain("linear-gradient(#080b09, #080b09) padding-box");
    expect(componentStyles).toContain("@keyframes commInputBorderDrift");
    expect(componentStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});