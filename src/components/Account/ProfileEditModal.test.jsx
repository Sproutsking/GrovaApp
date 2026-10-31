import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileEditModal from "./ProfileEditModal";
import uploadService from "../../services/upload/uploadService";
import profileService from "../../services/account/profileService";

jest.mock("../../services/config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

jest.mock("../../services/upload/uploadService", () => ({
  __esModule: true,
  default: {
    uploadImage: jest.fn(),
    getImageUrl: jest.fn(),
  },
}));

jest.mock("../../services/account/profileService", () => ({
  __esModule: true,
  default: { updateProfile: jest.fn() },
}));

describe("ProfileEditModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists the bio and banner, then returns the uploaded banner URL", async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    uploadService.uploadImage.mockResolvedValue({
      id: "profile/banner-123",
      url: "https://images.example.test/banner-123.png",
    });
    profileService.updateProfile.mockResolvedValue({
      full_name: "Dinaries Queen",
      username: "dinaries_queen",
      bio: "A new bio",
      profile_tags: [],
      banner_image_id: "profile/banner-123",
    });

    render(
      <ProfileEditModal
        userId="user-123"
        currentProfile={{
          fullName: "Dinaries Queen",
          username: "dinaries_queen",
          bio: "Old bio",
          profileTags: [],
          bannerImageUrl: null,
          bannerImageId: null,
        }}
        onSuccess={onSuccess}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/What's your story/), {
      target: { value: "A new bio" },
    });
    const bannerInput = document.querySelector('input[accept="image/jpeg,image/png,image/gif,image/webp"]');
    const bannerFile = new File(["banner"], "banner.png", { type: "image/png" });
    fireEvent.change(bannerInput, { target: { files: [bannerFile] } });

    await waitFor(() => {
      expect(screen.getByText("banner.png")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Save Changes/ })[0]);

    await waitFor(() => {
      expect(profileService.updateProfile).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          bio: "A new bio",
          banner_image_id: "profile/banner-123",
        }),
      );
    });
    expect(uploadService.uploadImage).toHaveBeenCalledWith(
      bannerFile,
      "xeevia/profile-banners",
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      bio: "A new bio",
      bannerImageId: "profile/banner-123",
      bannerImageUrl: "https://images.example.test/banner-123.png",
    }));
    expect(onClose).toHaveBeenCalled();
  });
});
