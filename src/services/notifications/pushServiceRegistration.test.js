jest.mock("../config/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock("./firebaseService", () => ({
  enablePushNotifications: jest.fn().mockResolvedValue(true),
  getFcmToken: jest.fn().mockResolvedValue("test-fcm-token"),
  initializeFirebase: jest.fn().mockResolvedValue(true),
  isFirebaseConfigured: jest.fn().mockReturnValue(true),
  isFirebaseSupported: jest.fn().mockReturnValue(true),
  requestPermission: jest.fn().mockResolvedValue(true),
  unsubscribe: jest.fn().mockResolvedValue(true),
}));

describe("pushService subscription persistence", () => {
  let originalNotification;
  let originalServiceWorker;
  let originalPushManager;

  beforeEach(() => {
    jest.resetModules();
    originalNotification = Object.getOwnPropertyDescriptor(window, "Notification");
    originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    originalPushManager = Object.getOwnPropertyDescriptor(window, "PushManager");

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [object, key, descriptor] of [
      [window, "Notification", originalNotification],
      [navigator, "serviceWorker", originalServiceWorker],
      [window, "PushManager", originalPushManager],
    ]) {
      if (descriptor) Object.defineProperty(object, key, descriptor);
      else delete object[key];
    }
  });

  it("does not report success when the FCM token cannot be persisted", async () => {
    const { supabase } = require("../config/supabase");
    supabase.rpc.mockResolvedValue({ error: { message: "database unavailable" } });
    jest.spyOn(global, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0;
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { pushService } = await import("./pushService");
    await expect(pushService.enablePushNotifications("user-1")).resolves.toBe(false);
    expect(supabase.rpc).toHaveBeenCalledTimes(4);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "register_fcm_push_subscription",
      expect.objectContaining({ p_fcm_token: "test-fcm-token" }),
    );
  });
});
