jest.mock('react-onesignal', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getUserId: jest.fn(),
    getDeviceState: jest.fn(),
    setExternalUserId: jest.fn(),
    showSlidedownPrompt: jest.fn(),
    showNativePrompt: jest.fn(),
    Notifications: { requestPermission: jest.fn() },
    User: {
      PushSubscription: {
        id: jest.fn(),
      },
    },
  },
}));

import OneSignal from 'react-onesignal';

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
});

describe('onesignalService getPlayerId', () => {
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
