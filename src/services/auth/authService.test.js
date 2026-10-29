import authService from "./authService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
    },
  },
}));

jest.mock("../config/authConfig", () => ({
  getCallbackUrl: () => "https://app.example/auth/callback",
}));

describe("AuthService X OAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("uses the current X OAuth provider and profile scopes for main sign-in", async () => {
    await authService.signInOAuth("x");

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "x",
      options: {
        redirectTo: "https://app.example/auth/callback",
        skipBrowserRedirect: false,
        scopes: "tweet.read users.read users.email offline.access",
      },
    });
  });
});
