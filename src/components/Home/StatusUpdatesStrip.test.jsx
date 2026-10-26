import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { StatusBubble } from "./StatusUpdatesStrip";

jest.mock("../../services/config/supabase", () => ({
  supabase: {},
}));

jest.mock("../../services/shared/mediaUrlService", () => ({
  __esModule: true,
  default: {
    resolveAvatarUrls: jest.fn((source) => {
      if (source === "avatar-id") return ["https://storage.example/avatar", "https://cdn.example/avatar"];
      return typeof source === "string" && /^https?:\/\//i.test(source) ? [source] : [];
    }),
    getAvatarUrl: jest.fn(() => null),
    getImageUrl: jest.fn(() => null),
  },
}));

jest.mock("../../services/messages/statusUpdateService", () => ({
  __esModule: true,
  default: {},
  isVideoStatus: jest.fn(() => false),
}));

describe("StatusBubble profile avatar", () => {
  beforeEach(() => {
    mediaUrlService.resolveAvatarUrls.mockImplementation((source) => {
      if (source === "avatar-id") return ["https://storage.example/avatar", "https://cdn.example/avatar"];
      return typeof source === "string" && /^https?:\/\//i.test(source) ? [source] : [];
    });
    mediaUrlService.getAvatarUrl.mockReturnValue(null);
  });

  it("renders the signed-in profile image instead of its initial", () => {
    render(
      <StatusBubble
        group={{ profile: { name: "Yemi", avatar: "https://cdn.example/yemi.jpg" }, statuses: [] }}
        isMe
      />,
    );

    const avatar = screen.getByAltText("");
    expect(avatar.getAttribute("src")).toBe("https://cdn.example/yemi.jpg");
    expect(avatar.style.objectFit).toBe("cover");
    expect(avatar.style.objectPosition).toBe("center");
    expect(screen.queryByText("Y")).toBeNull();
  });

  it("tries the next avatar URL when the first image fails", () => {
    render(
      <StatusBubble
        group={{ profile: { full_name: "Yemi", avatar_id: "avatar-id" }, statuses: [] }}
        isMe
      />,
    );

    const avatar = screen.getByAltText("");
    expect(avatar.getAttribute("src")).toBe("https://storage.example/avatar");
    fireEvent.error(avatar);
    expect(screen.getByAltText("").getAttribute("src")).toBe("https://cdn.example/avatar");
  });
});
