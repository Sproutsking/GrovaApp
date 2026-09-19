import {
  isOAuthCallbackUrl,
  cleanOAuthCallbackParams,
} from "./oauthUrl";

describe("oauthUrl helpers", () => {
  it("treats a real PKCE code as an OAuth callback", () => {
    expect(isOAuthCallbackUrl("?code=abc123def456ghi789&state=oauth-state")).toBe(true);
    expect(isOAuthCallbackUrl("?state=oauth-state&code=abc123def456ghi789")).toBe(true);
  });

  it("ignores OAuth error URLs and strips the callback params", () => {
    const cleaned = cleanOAuthCallbackParams(
      "https://app.xeevia.com/?error=access_denied&error_code=access_denied&state=abc&code=xyz",
    );

    expect(isOAuthCallbackUrl("?error=access_denied&error_code=access_denied&state=abc&code=xyz")).toBe(false);
    expect(cleaned.searchParams.has("error")).toBe(false);
    expect(cleaned.searchParams.has("error_code")).toBe(false);
    expect(cleaned.searchParams.has("code")).toBe(false);
    expect(cleaned.searchParams.has("state")).toBe(false);
  });
});
