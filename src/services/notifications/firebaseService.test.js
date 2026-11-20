jest.mock("../config/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

describe("firebaseService runtime configuration", () => {
  let originalServiceWorker;
  let originalNotification;
  let originalFirebase;

  beforeEach(() => {
    jest.resetModules();
    originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    originalNotification = Object.getOwnPropertyDescriptor(window, "Notification");
    originalFirebase = window.firebase;

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" },
    });
    window.firebase = {
      apps: [],
      initializeApp: jest.fn((options) => {
        const app = { name: "[DEFAULT]", options };
        window.firebase.apps.push(app);
        return app;
      }),
      messaging: jest.fn(() => ({})),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      delete navigator.serviceWorker;
    }

    if (originalNotification) {
      Object.defineProperty(window, "Notification", originalNotification);
    } else {
      delete window.Notification;
    }

    if (originalFirebase === undefined) delete window.firebase;
    else window.firebase = originalFirebase;
    delete window.__firebaseDebug;
  });

  it("loads only public Firebase settings from the authenticated Edge Function", async () => {
    const { supabase } = require("../config/supabase");
    supabase.functions.invoke.mockResolvedValue({
      data: {
        firebase: {
          apiKey: "public-api-key",
          projectId: "xeevia-project",
          messagingSenderId: "123456",
          appId: "app-id",
        },
        vapidKey: "public-vapid-key",
      },
      error: null,
    });

    const { initializeFirebase, isFirebaseConfigured } = await import("./firebaseService");
    await expect(initializeFirebase("user-1")).resolves.toBe(true);

    expect(supabase.functions.invoke).toHaveBeenCalledWith("get-push-config", {
      body: {},
    });
    expect(window.firebase.initializeApp).toHaveBeenCalledWith({
      apiKey: "public-api-key",
      projectId: "xeevia-project",
      messagingSenderId: "123456",
      appId: "app-id",
    });
    expect(isFirebaseConfigured()).toBe(true);
  });

  it("refuses to initialize when runtime configuration is incomplete", async () => {
    const { supabase } = require("../config/supabase");
    supabase.functions.invoke.mockResolvedValue({
      data: { firebase: { projectId: "xeevia-project" } },
      error: null,
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { initializeFirebase } = await import("./firebaseService");
    await expect(initializeFirebase("user-1")).resolves.toBe(false);
    expect(window.firebase.initializeApp).not.toHaveBeenCalled();
  });
});
