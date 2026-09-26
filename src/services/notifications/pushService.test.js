describe('pushService firebase config gating', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    delete process.env.REACT_APP_FIREBASE_API_KEY;
    delete process.env.REACT_APP_FIREBASE_PROJECT_ID;
    delete process.env.REACT_APP_FIREBASE_SENDER_ID;
    delete process.env.REACT_APP_FIREBASE_APP_ID;
    delete process.env.REACT_APP_FIREBASE_MESSAGING_VAPID_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not treat missing Firebase env vars as configured', async () => {
    const { pushService } = await import('./pushService');

    expect(pushService.getStatus().firebaseConfigured).toBe(false);
  });
});
