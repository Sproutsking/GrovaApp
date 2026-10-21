import mediaUrlService from "./mediaUrlService";

describe("mediaUrlService avatar URL resolution", () => {
  beforeEach(() => {
    mediaUrlService.cloudName = "test-cloud";
    mediaUrlService.clearAvatarCache();
  });

  it("resolves legacy avatar IDs to unmodified Supabase Storage URLs", () => {
    const storageUrl = "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png";
    const storageResolver = jest.spyOn(mediaUrlService, "getAvatarStorageUrl").mockReturnValue(storageUrl);

    expect(mediaUrlService.resolveAvatarUrl("user-1/avatar.png", 200)).toBe(storageUrl);
    expect(storageResolver).toHaveBeenCalledWith("user-1/avatar.png", 200);
  });

  it("resolves new grova avatar IDs through Cloudinary", () => {
    expect(mediaUrlService.resolveAvatarUrl("grova/avatars/user-1/avatar", 200)).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/",
    );
  });

  it("includes an untransformed Cloudinary candidate for accounts that reject transformations", () => {
    expect(mediaUrlService.resolveAvatarUrls("grova/avatars/user-1/avatar", 200)).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/grova/avatars/user-1/avatar",
    );
  });

  it("does not append transformations to Supabase public URLs", () => {
    const url = "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png";
    expect(mediaUrlService.getOptimizedImageUrl(url, { width: 200 })).toBe(url);
  });
});