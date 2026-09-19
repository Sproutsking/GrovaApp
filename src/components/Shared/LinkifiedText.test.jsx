import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import LinkifiedText, { SharedContentMessage, getExternalUrls, parseSharedContent } from "./LinkifiedText";
import ParsedText from "./ParsedText";

describe("LinkifiedText", () => {
  it("renders HTTP links as safe clickable anchors and preserves punctuation", () => {
    render(<LinkifiedText>Shared post: https://app.xeevia.com/share/post/abc-123.</LinkifiedText>);

    const link = screen.getAllByRole("link", { name: "Open link" })[0];
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

  it("activates URLs in published-content text", () => {
    render(<ParsedText text="Read more at https://preeb.cloud/about." />);
    const link = screen.getAllByRole("link", { name: "Open link" })[0];
    expect(link.getAttribute("href")).toBe("https://preeb.cloud/about");
    expect(link.style.color).toBe("rgb(163, 230, 53)");
  });

  it("keeps the selected link visible and appends its preview below the full text", () => {
    render(
      <ParsedText
        displayMode="embed"
        text="Read this first. https://preeb.cloud/about Then keep reading."
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("https://preeb.cloud/about");
    expect(links[0].textContent).toContain("https://preeb.cloud/about");
    expect(links[1].textContent).toContain("preeb.cloud link");
    expect(screen.getByText("Then keep reading.")).toBeTruthy();
  });

  it("shows previews by default for external links", () => {
    render(<LinkifiedText>Visit https://preeb.cloud/about</LinkifiedText>);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getAllByRole("link")[0].textContent).toContain("https://preeb.cloud/about");
  });

  it("does not duplicate internal Xeevia navigation links", () => {
    render(<LinkifiedText>Open https://app.xeevia.com/post/abc-123</LinkifiedText>);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("extracts only external URLs for message-level preview placement", () => {
    expect(getExternalUrls("https://app.xeevia.com/post/1 https://preeb.cloud/about")).toEqual(["https://preeb.cloud/about"]);
  });
});
