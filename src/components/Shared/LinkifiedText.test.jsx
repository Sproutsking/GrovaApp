import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import LinkifiedText, { SharedContentMessage, parseSharedContent } from "./LinkifiedText";

describe("LinkifiedText", () => {
  it("renders HTTP links as safe clickable anchors and preserves punctuation", () => {
    render(<LinkifiedText>Shared post: https://app.xeevia.com/share/post/abc-123.</LinkifiedText>);

    const link = screen.getByRole("link", { name: "Open link" });
      expect(link.getAttribute("href")).toBe("https://app.xeevia.com/share/post/abc-123");
    expect(link.getAttribute("target")).toBe("_self");
    expect(link.getAttribute("rel")).toBe("noopener");
      expect(link.parentElement.textContent).toContain(".");
  });

  it("does not bubble link clicks into the message row", () => {
    const onParentClick = jest.fn();
    render(
      <div onClick={onParentClick}>
        <LinkifiedText>https://app.xeevia.com/share/post/abc-123</LinkifiedText>
      </div>,
    );

    fireEvent.click(screen.getByRole("link"));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("normalizes legacy share messages and presents a compact content action", () => {
    const legacy = "📎 Shared a post: \"🔥\"\nhttps://app.xeevia.com/post/abc-123";
    expect(parseSharedContent(legacy)).toMatchObject({ senderName: "Someone", contentLabel: "a post" });

    render(<SharedContentMessage>{"Emmanuel shared a post\nhttps://app.xeevia.com/post/abc-123"}</SharedContentMessage>);
    expect(screen.getByText("Emmanuel shared a post")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View post" })).toBeTruthy();
  });

  it("uses the actual share type and sender ownership for received and sent content", () => {
    const onNavigate = jest.fn();

    render(
      <SharedContentMessage onNavigate={onNavigate} senderDisplayName="Ava">
        {"Ava shared a reel\nhttps://app.xeevia.com/reel/abc-123"}
      </SharedContentMessage>,
    );
    expect(screen.getByText("Ava shared a reel")).toBeTruthy();
    const reelLink = screen.getByRole("link", { name: "View reel" });
    expect(reelLink).toBeTruthy();
    fireEvent.click(reelLink);
    expect(onNavigate).toHaveBeenCalledWith("/reel/abc-123");

    render(
      <SharedContentMessage onNavigate={onNavigate} isMine showSender senderDisplayName="You">
        {"You shared a profile\nhttps://app.xeevia.com/profile/tina"}
      </SharedContentMessage>,
    );
    expect(screen.getByText("You shared a profile")).toBeTruthy();
    const profileLink = screen.getByRole("link", { name: "View profile" });
    expect(profileLink).toBeTruthy();
    fireEvent.click(profileLink);
    expect(onNavigate).toHaveBeenLastCalledWith("/profile/tina");
  });
});
