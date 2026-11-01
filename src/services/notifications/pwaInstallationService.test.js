jest.mock("../config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from "../config/supabase";
import { getPwaInstallationId, reportPwaInstallation } from "./pwaInstallationService";

describe("pwaInstallationService", () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(window, "crypto");

  beforeAll(() => {
    Object.defineProperty(window, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (bytes) => bytes.fill(7),
      },
    });
  });

  afterAll(() => {
    if (cryptoDescriptor) {
      Object.defineProperty(window, "crypto", cryptoDescriptor);
    } else {
      delete window.crypto;
    }
  });

  beforeEach(() => {
    window.localStorage.clear();
    supabase.from.mockReset();
  });

  it("reuses a browser-profile installation ID", () => {
    const firstId = getPwaInstallationId(window.localStorage);

    expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
    expect(getPwaInstallationId(window.localStorage)).toBe(firstId);
  });

  it("reports the profile installation to the signed-in account", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert });

    const installationId = await reportPwaInstallation("account-123");

    expect(supabase.from).toHaveBeenCalledWith("pwa_install_reports");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "account-123",
        installation_id: installationId,
      }),
      { onConflict: "user_id,installation_id" },
    );
  });
});
