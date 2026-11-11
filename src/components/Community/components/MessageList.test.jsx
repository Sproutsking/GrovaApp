import React from "react";
import { render, screen } from "@testing-library/react";
import MessageList from "./MessageList";

jest.mock("../../../services/shared/mediaUrlService", () => ({
  resolveAvatarUrl: jest.fn(() => null),
}));

jest.mock("../../Shared/LinkifiedText", () => {
  const ReactModule = require("react");
  return {
    __esModule: true,
    default: ({ children, previewOnly }) => previewOnly
      ? ReactModule.createElement("span", { className: "mock-link-preview" }, children)
      : ReactModule.createElement(ReactModule.Fragment, null, children),
    SharedContentMessage: ({ children }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    getExternalUrls: (text = "") => String(text).match(/https?:\/\/[^\s]+/g) || [],
    parseSharedContent: () => null,
  };
});

jest.mock("./ReactionSystem", () => ({
  MessageReactionArea: ({ children, className = "" }) => (
    <div className={`mra-wrapper ${className}`}>{children({ reactionRow: null })}</div>
  ),
}));

jest.mock("../../Shared/BoostAvatarRing", () => () => null);
jest.mock("../../Shared/VerifiedBadges", () => ({
  VerifiedBadgeCircle: () => null,
}));
jest.mock("../verification/WelcomeMemberCard", () => ({
  __esModule: true,
  default: () => null,
  getWelcomeMemberId: () => null,
}));
jest.mock("../communityMentions", () => ({
  COMMUNITY_MENTION_PATTERN: /$^/,
  resolveCommunityMention: () => null,
}));

const makeMessage = (overrides = {}) => ({
  id: "message-1",
  user_id: "friend",
  content: "Hello",
  created_at: "2026-11-05T10:00:00.000Z",
  user: { id: "friend", full_name: "Friend" },
  ...overrides,
});

const renderList = (messages, messageMode = "community") => render(
  <MessageList
    messages={messages}
    pendingMessages={[]}
    loading={false}
    userId="me"
    currentUser={{ id: "me", fullName: "Me" }}
    messagesEndRef={React.createRef()}
    messageMode={messageMode}
  />,
);

describe("MessageList presentation", () => {
  it("uses the full-width direct-message layout without repeated profile identity", () => {
    const messages = [
      makeMessage(),
      makeMessage({ id: "message-2", user_id: "me", content: "Hi", user: { id: "me", full_name: "Me" } }),
    ];

    const { container } = renderList(messages, "direct");

    expect(container.querySelector(".direct-message-list")).toBeTruthy();
    expect(container.querySelectorAll(".msg-avatar")).toHaveLength(0);
    expect(container.querySelectorAll(".msg-avatar-spacer")).toHaveLength(0);
    expect(container.querySelectorAll(".msg-user-name")).toHaveLength(0);
  });

  it("keeps link previews inside the message bubble and labels shared GIFs as content", () => {
    const { container } = renderList([
      makeMessage({ content: "Check this https://media.giphy.com/media/example/giphy.gif" }),
    ], "direct");

    const preview = container.querySelector(".msg-external-preview");
    const bubble = container.querySelector(".msg-bubble");

    expect(preview).toBeTruthy();
    expect(bubble.contains(preview)).toBe(true);
    expect(container.querySelector(".mra-wrapper").classList.contains("has-external-preview")).toBe(true);
  });

  it("places community message tails at the top and direct-message tails at the bottom", () => {
    const community = renderList([makeMessage()], "community");
    expect(community.container.querySelector(".msg-bubble.has-tail").classList.contains("tail-top")).toBe(true);
    community.unmount();

    const direct = renderList([makeMessage()], "direct");
    expect(direct.container.querySelector(".msg-bubble.has-tail").classList.contains("tail-bottom")).toBe(true);
  });

  it("fits image attachments to the bubble with compact spacing in direct and community messages", () => {
    const message = makeMessage({
      content: "Image note",
      attachments: [{ type: "image", url: "https://example.test/photo.png" }],
    });
    const direct = renderList([message], "direct");
    const directBubble = direct.container.querySelector(".msg-bubble");

    expect(directBubble.classList.contains("has-attachments")).toBe(true);
    expect(directBubble.classList.contains("has-visual-attachments")).toBe(true);
    expect(directBubble.classList.contains("has-message-body")).toBe(true);
    expect(direct.container.querySelector(".mra-wrapper").classList.contains("has-visual-attachments")).toBe(true);
    expect(direct.container.querySelector(".msg-image-grid.single")).toBeTruthy();
    expect(direct.container.querySelector(".msg-image-item").getAttribute("aria-label")).toBe("Open image in full size");
    expect(direct.container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-image-frame img { position:absolute; inset:0; display:block; width:100%; height:100%;",
    );
    expect(direct.container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-list-wrapper .msg-item:not(.announcement) .mra-wrapper.has-visual-attachments { flex: 0 1 auto; width: min(320px, calc(100% - 40px));",
    );
    expect(direct.container.querySelector(".msg-list-wrapper style").textContent).not.toContain(
      ".msg-list-wrapper.direct-message-list .msg-item .mra-wrapper.has-visual-attachments",
    );
    direct.unmount();

    const community = renderList([message], "community");
    const communityBubble = community.container.querySelector(".msg-bubble");

    expect(communityBubble.classList.contains("has-attachments")).toBe(true);
    expect(communityBubble.classList.contains("has-visual-attachments")).toBe(true);
    expect(community.container.querySelector(".mra-wrapper").classList.contains("has-visual-attachments")).toBe(true);
    expect(community.container.querySelector(".msg-card-header")).toBeTruthy();
    expect(community.container.querySelector(".msg-image-grid.single")).toBeTruthy();
    expect(community.container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-list-wrapper .msg-item:not(.announcement) .mra-wrapper.has-visual-attachments { flex: 0 1 auto; width: min(320px, calc(100% - 40px));",
    );
    expect(community.container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-bubble.has-attachments .msg-card-header { padding-top: 1px; margin-bottom: 1px;",
    );
    expect(community.container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-bubble.has-attachments .msg-footer { margin-top: 1px; }",
    );
  });

  it("keeps text-only message widths natural and applies the media width rule to video messages", () => {
    const textOnly = renderList([makeMessage({ content: "A long text-only message should retain its normal sizing." })]);
    expect(textOnly.container.querySelector(".mra-wrapper").classList.contains("has-visual-attachments")).toBe(false);
    textOnly.unmount();

    const video = renderList([makeMessage({
      content: "A longer description should wrap to the visual card width.",
      attachments: [{ type: "video", url: "https://example.test/clip.mp4" }],
    })]);
    expect(video.container.querySelector(".mra-wrapper").classList.contains("has-visual-attachments")).toBe(true);
    expect(video.container.querySelector(".msg-bubble").classList.contains("has-visual-attachments")).toBe(true);
  });

  it("lays out multi-image messages as balanced grids with a remaining-image count", () => {
    const attachments = Array.from({ length: 6 }, (_, index) => ({
      type: "image",
      url: `https://example.test/photo-${index + 1}.png`,
    }));
    const { container } = renderList([makeMessage({ attachments })], "direct");

    expect(container.querySelector(".msg-image-grid")).not.toBeNull();
    expect(container.querySelector(".msg-image-grid").classList.contains("three")).toBe(false);
    expect(container.querySelectorAll(".msg-image-item")).toHaveLength(4);
    expect(container.querySelector(".msg-image-more").textContent).toBe("+2");
    expect(container.querySelector(".msg-image-item[aria-label='Open image, and 2 more images']")).not.toBeNull();
  });

  it("uses a main image with two stacked images for three-image messages", () => {
    const attachments = Array.from({ length: 3 }, (_, index) => ({
      type: "image",
      url: `https://example.test/photo-${index + 1}.png`,
    }));
    const { container } = renderList([makeMessage({ attachments })], "direct");

    expect(container.querySelector(".msg-image-grid.three")).not.toBeNull();
    expect(container.querySelectorAll(".msg-image-item")).toHaveLength(3);
    expect(container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-image-grid.three .msg-image-item:first-child { grid-row:span 2; }",
    );
  });

  it("shows sender identity at the start of a new or ten-minute-separated Community message cluster", () => {
    const first = makeMessage({ created_at: "2026-11-05T10:00:00.000Z" });
    const clustered = makeMessage({ id: "message-2", created_at: "2026-11-05T10:09:59.000Z" });
    const afterGap = makeMessage({ id: "message-3", created_at: "2026-11-05T10:20:01.000Z" });
    const { container } = renderList([first, clustered, afterGap], "community");

    expect(container.querySelectorAll(".msg-avatar")).toHaveLength(2);
    expect(container.querySelectorAll(".msg-user-name")).toHaveLength(2);
    expect(container.querySelectorAll(".msg-item.clustered")).toHaveLength(1);
    expect(container.querySelector(".msg-item.different-author-next").style.marginBottom).toBe("");
    expect(container.querySelector(".msg-list-wrapper style").textContent).toContain(
      ".msg-item.different-author-next { margin-bottom: 10px; }",
    );
  });

  it("shows the sender name for a new cluster when the message lacks its embedded user relation", () => {
    const message = makeMessage({ user: undefined });
    const { container } = render(
      <MessageList
        messages={[message]}
        pendingMessages={[]}
        loading={false}
        userId="me"
        currentUser={{ id: "me", fullName: "Me" }}
        communityMembers={[{ user_id: "friend", user: { id: "friend", full_name: "Friend from membership" } }]}
        messagesEndRef={React.createRef()}
        messageMode="community"
      />,
    );

    expect(screen.getByText("Friend from membership")).toBeTruthy();
    expect(screen.getByLabelText("View Friend from membership's profile")).toBeTruthy();
  });

  it("shows a media thumbnail and readable excerpt inside a reply preview", () => {
    const messages = [
      makeMessage({
        id: "original",
        content: "Here is the receipt",
        attachments: [{ type: "image", url: "https://example.test/receipt.png" }],
      }),
      makeMessage({
        id: "reply",
        user_id: "me",
        content: "Thanks",
        reply_to_id: "original",
        user: { id: "me", full_name: "Me" },
        created_at: "2026-11-05T10:01:00.000Z",
      }),
    ];

    renderList(messages, "direct");

    expect(screen.getByText("Replying to Friend")).toBeTruthy();
    expect(document.querySelector(".msg-reply-quote-preview strong").textContent).toBe("Here is the receipt");
    expect(document.querySelector(".msg-reply-quote-thumb").getAttribute("src")).toBe(
      "https://example.test/receipt.png",
    );
  });

  it("keeps sender avatars but shows the author label only once per same-sender cluster", () => {
    const messages = [
      makeMessage(),
      makeMessage({ id: "message-2", content: "One more", created_at: "2026-11-05T10:01:00.000Z" }),
    ];

    const { container } = renderList(messages);

    expect(container.querySelectorAll(".msg-avatar")).toHaveLength(1);
    expect(container.querySelectorAll(".msg-user-name")).toHaveLength(1);
    expect(container.querySelectorAll(".msg-item.clustered")).toHaveLength(1);
  });
});
