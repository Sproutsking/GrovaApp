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

    render(<UpdatesChannelPanel channelId="updates" />);

    await screen.findByText("An image update");
    expect(screen.getByRole("img", { name: "Social media update" }).getAttribute("src"))
      .toBe("https://cdn.example/image.jpg");
    expect(screen.getByLabelText("Update video").getAttribute("src"))
      .toBe("https://cdn.example/video.mp4");
  });

  it("uses a dark provider-accented card for Facebook updates", async () => {
    socialUpdatesService.listPosts.mockResolvedValue([
      {
        id: "facebook-post",
        provider: "facebook",
        content: "A Facebook update",
        activity_type: "post",
      },
    ]);

    render(<UpdatesChannelPanel channelId="updates" />);

    const post = await screen.findByRole("article", { name: "Update from Facebook" });
    expect(post.getAttribute("data-provider")).toBe("facebook");
    expect(post.getAttribute("style")).toContain("#1877f2");
    expect(screen.getByText("Facebook")).not.toBeNull();
  });
});
