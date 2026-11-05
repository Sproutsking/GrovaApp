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
    default: ({ children }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    SharedContentMessage: ({ children }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    getExternalUrls: () => [],
    parseSharedContent: () => null,
  };
});

jest.mock("./ReactionSystem", () => ({
  MessageReactionArea: ({ children }) => children({ reactionRow: null }),
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
