import { supabase } from "../config/supabase";
import settingsService from "./settingsService";

jest.mock("../config/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
      verifyOtp: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe("settingsService contact verification", () => {
  const user = { id: "user-1", email: "old@example.com", phone: "+15555550123" };

  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    supabase.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
    jest.spyOn(settingsService, "_logProfileUpdate").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses Supabase Auth to send email verification instead of exposing a client-generated code", async () => {
    const result = await settingsService.sendEmailVerificationCode("user-1", "new@example.com");

    expect(result.success).toBe(true);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(Object.keys(localStorage).some((key) => key.startsWith("verify_code_"))).toBe(false);
  });

  it("saves an email only after Supabase confirms the email-change OTP for the same user", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { ...user, email: "new@example.com" } },
      error: null,
    });
    const profileQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
    };
    supabase.from.mockReturnValue(profileQuery);

    const result = await settingsService.verifyAndChangeEmail("user-1", "new@example.com", "123456");

    expect(result.success).toBe(true);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      token: "123456",
      type: "email_change",
    });
    expect(profileQuery.update).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com" }));
  });

  it("refuses to send contact verification for a different signed-in user", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { ...user, id: "other-user" } }, error: null });

    await expect(settingsService.sendVerificationCode("user-1", "+15555550124"))
      .rejects.toThrow("Your session is no longer valid. Sign in again.");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("marks a phone verified only after the phone-change OTP is confirmed for the same user", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { ...user, phone: "+15555550124", phone_confirmed_at: "2026-11-07T10:00:00Z" } },
      error: null,
    });
    const profileQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
    };
    supabase.from.mockReturnValue(profileQuery);

    const result = await settingsService.verifyPhoneNumber("user-1", "+15555550124", "123456");

    expect(result.success).toBe(true);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+15555550124",
      token: "123456",
      type: "phone_change",
    });
    expect(profileQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      phone: "+15555550124",
      phone_verified: true,
    }));
  });

  it("does not mark a phone verified when Supabase rejects the OTP", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({
      data: null,
      error: new Error("expired token"),
    });

    const result = await settingsService.verifyPhoneNumber("user-1", "+15555550124", "123456");

    expect(result.success).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("does not save a phone when Supabase confirms a different user's OTP", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { ...user, id: "other-user", phone: "+15555550124", phone_confirmed_at: "2026-11-07T10:00:00Z" } },
      error: null,
    });

    const result = await settingsService.verifyPhoneNumber("user-1", "+15555550124", "123456");

    expect(result.success).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
