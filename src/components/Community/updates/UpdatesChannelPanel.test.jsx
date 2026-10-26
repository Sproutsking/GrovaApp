import React from "react";
import { render, screen } from "@testing-library/react";
import UpdatesChannelPanel from "./UpdatesChannelPanel";
import socialUpdatesService from "../../../services/community/socialUpdatesService";

jest.mock("../../../services/community/socialUpdatesService", () => ({
  __esModule: true,
  default: { listPosts: jest.fn() },
}));

jest.mock("../../../services/shared/mediaUrlService", () => ({
  __esModule: true,
  default: { getImageUrl: jest.fn((id) => `/image/${id}`), getVideoUrl: jest.fn((id) => `/video/${id}`) },
}));

describe("UpdatesChannelPanel media", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders direct image and video media URLs from connected providers", async () => {
    socialUpdatesService.listPosts.mockResolvedValue([
      {
        id: "image-post",
        provider: "instagram",
        content: "An image update",
        activity_type: "post",
        media: { url: "https://cdn.example/image.jpg" },
      },
      {
        id: "video-post",
        provider: "instagram",
        content: "A video update",
        activity_type: "video",
        media: { url: "https://cdn.example/video.mp4" },
      },
    ]);

    const { container } = render(<UpdatesChannelPanel channelId="updates" />);

    await screen.findByText("An image update");
    expect(container.querySelector('[data-post-id="image-post"] img').getAttribute("src"))
      .toBe("https://cdn.example/image.jpg");
    expect(container.querySelector('[data-post-id="video-post"] video').getAttribute("src"))
      .toBe("https://cdn.example/video.mp4");
  });
});
