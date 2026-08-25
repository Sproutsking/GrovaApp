const OneSignal = {
  init: jest.fn(),
  getUserId: jest.fn(),
  getDeviceState: jest.fn(),
  setExternalUserId: jest.fn(),
  Notifications: { requestPermission: jest.fn() },
  Slidedown: { promptPush: jest.fn() },
  User: {
    onesignalId: null,
    PushSubscription: {
      id: jest.fn(),
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.REACT_APP_ONESIGNAL_APP_ID = 'test-app-id';
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: 'granted' },
  });
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {},
  });
  window.OneSignal = OneSignal;
});

describe('onesignalService', () => {
  it('initializes the SDK with auto-registration enabled', async () => {
    OneSignal.init.mockResolvedValue(undefined);

    const { initializeOneSignal } = await import('./onesignalService');
    await initializeOneSignal('user-1');

    expect(OneSignal.init).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'test-app-id', autoRegister: true }),
    );
  });

  it('uses the current device state userId when available', async () => {
    OneSignal.init.mockResolvedValue(undefined);
    OneSignal.getUserId.mockResolvedValue(null);
    OneSignal.getDeviceState.mockResolvedValue({ userId: 'device-456' });

    const { getPlayerId } = await import('./onesignalService');
    const playerId = await getPlayerId('user-1');

    expect(playerId).toBe('device-456');
    expect(OneSignal.getDeviceState).toHaveBeenCalled();
  });

  it('falls back to OneSignal subscription id when getUserId returns null', async () => {
    OneSignal.init.mockResolvedValue(undefined);
    OneSignal.getUserId.mockResolvedValue(null);
    OneSignal.getDeviceState.mockResolvedValue(null);
    OneSignal.User.PushSubscription.id.mockResolvedValue('sub-123');

    const { getPlayerId } = await import('./onesignalService');
    const playerId = await getPlayerId('user-1');

    expect(playerId).toBe('sub-123');
    expect(OneSignal.User.PushSubscription.id).toHaveBeenCalled();
  });
});
