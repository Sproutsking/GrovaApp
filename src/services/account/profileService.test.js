jest.mock("../config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

jest.mock("../shared/errorHandler", () => ({
  handleError: jest.fn((error) => error),
}));

jest.mock("../shared/mediaUrlService", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../xrc", () => ({
  __esModule: true,
  default: { writeRecord: jest.fn(() => Promise.resolve()) },
  STREAM_TYPES: { XARC: "xarc" },
  XRC_EVENTS: { profileUpdated: jest.fn((userId, fields) => ({ userId, fields })) },
}));

jest.mock("./profileTags", () => ({
  normalizeProfileTags: jest.fn((tags) => tags),
}));

const { supabase } = require("../config/supabase");
const profileService = require("./profileService").default;

describe("profileService.updateProfile", () => {
  let query;

  beforeEach(() => {
    jest.clearAllMocks();
    query = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    supabase.from.mockReturnValue(query);
  });

  it("writes bio and banner image ID to the profile row and returns the saved row", async () => {
    const savedProfile = {
      id: "user-123",
      bio: "Updated bio",
      banner_image_id: "profile/banner-123",
    };
    query.single.mockResolvedValue({ data: savedProfile, error: null });

    await expect(profileService.updateProfile("user-123", {
      bio: "Updated bio",
      banner_image_id: "profile/banner-123",
    })).resolves.toBe(savedProfile);

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      bio: "Updated bio",
      banner_image_id: "profile/banner-123",
      updated_at: expect.any(String),
    }));
    expect(query.eq).toHaveBeenCalledWith("id", "user-123");
    expect(query.select).toHaveBeenCalled();
    expect(query.single).toHaveBeenCalled();
  });

  it("surfaces database errors instead of reporting an unsaved update as successful", async () => {
    const databaseError = new Error("Profile update denied");
    query.single.mockResolvedValue({ data: null, error: databaseError });

    await expect(profileService.updateProfile("user-123", {
      bio: "Updated bio",
      banner_image_id: "profile/banner-123",
    })).rejects.toBe(databaseError);
  });
});
