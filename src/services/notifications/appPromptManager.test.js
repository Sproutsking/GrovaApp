import { shouldSuppressInstallPrompt } from "./appPromptManager";

describe("appPromptManager", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("suppresses install prompts when the app is marked as installed", () => {
    window.localStorage.setItem("xv_pwa_installed", "1");

    expect(shouldSuppressInstallPrompt(window.localStorage)).toBe(true);
  });

  it("suppresses install prompts when the user has dismissed install prompts permanently", () => {
    window.localStorage.setItem(
      "xv_prompt_state_v1",
      JSON.stringify({ never: { install: true } })
    );

    expect(shouldSuppressInstallPrompt(window.localStorage)).toBe(true);
  });
});
