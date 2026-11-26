import { getPushEnableErrorMessage } from "./PushPermissionNudge";

describe("push permission failure messages", () => {
  it("explains the browser push-service registration failure", () => {
    expect(
      getPushEnableErrorMessage(
        "granted",
        "FCM token generation failed: Registration failed - push service error",
      ),
    ).toContain("Use Google services for push messaging");
  });

  it("keeps the permission-denied guidance", () => {
    expect(getPushEnableErrorMessage("denied")).toBe(
      "Notifications are blocked in your browser settings.",
    );
  });

  it("uses a generic message for unrelated registration errors", () => {
    expect(getPushEnableErrorMessage("granted", "Firebase config unavailable")).toBe(
      "Push notifications could not be enabled. Please try again or use Settings.",
    );
  });
});
