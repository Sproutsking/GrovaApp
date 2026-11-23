jest.mock("../config/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock("./firebaseService", () => ({
  enablePushNotifications: jest.fn().mockResolvedValue(true),
  getFcmToken: jest.fn().mockResolvedValue("test-fcm-token"),
  getFirebaseLastError: jest.fn().mockReturnValue("test Firebase error"),
  initializeFirebase: jest.fn().mockResolvedValue(true),
  isFirebaseConfigured: jest.fn().mockReturnValue(true),
  isFirebaseSupported: jest.fn().mockReturnValue(true),
  requestPermission: jest.fn().mockResolvedValue(true),
  unsubscribe: jest.fn().mockResolvedValue(true),
}));

describe("pushService subscription persistence", () => {
  const originalEnv = { ...process.env };
  let originalNotification;
  let originalServiceWorker;
  let originalPushManager;
  let originalAtob;

  beforeEach(() => {
    jest.resetModules();
    originalNotification = Object.getOwnPropertyDescriptor(window, "Notification");
    originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    originalPushManager = Object.getOwnPropertyDescriptor(window, "PushManager");
    originalAtob = Object.getOwnPropertyDescriptor(window, "atob");
    process.env.REACT_APP_VAPID_PUBLIC_KEY = "B".repeat(87);

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
      [window, "atob", originalAtob],
    ]) {
      if (descriptor) Object.defineProperty(object, key, descriptor);
      else delete object[key];
    }
    process.env = { ...originalEnv };
  });

  it("falls back to legacy Web Push when FCM token registration fails", async () => {
    const { supabase } = require("../config/supabase");
    supabase.rpc.mockResolvedValue({ error: { message: "database unavailable" } });
    const subscription = {
      endpoint: "https://push.services.mozilla.com/wpush/v2/example",
      options: { applicationServerKey: null },
      toJSON: () => ({
        endpoint: "https://push.services.mozilla.com/wpush/v2/example",
        keys: { p256dh: "client-public-key", auth: "client-auth-secret" },
      }),
      unsubscribe: jest.fn().mockResolvedValue(true),
    };
    const registration = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockResolvedValue(subscription),
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });

    let savedSubscription;
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: (record) => {
        savedSubscription = record;
        return {
          select: () => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: "subscription-1" }, error: null }),
          }),
        };
      },
    }));

    jest.spyOn(global, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0;
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { pushService } = await import("./pushService");
    await expect(pushService.enablePushNotifications("user-1")).resolves.toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(4);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "register_fcm_push_subscription",
      expect.objectContaining({ p_fcm_token: "test-fcm-token" }),
    );
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(savedSubscription).toEqual(expect.objectContaining({
      user_id: "user-1",
      endpoint: subscription.endpoint,
      provider: "legacy",
      is_active: true,
    }));
    expect(pushService.getStatus().lastProvider).toBe("legacy");
  });
});
