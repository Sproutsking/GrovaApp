const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR', err.message));
  await page.goto('https://app.xeevia.com/', { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(5000);
  const result = await page.evaluate(async () => {
    const info = {
      hasNotification: typeof Notification !== 'undefined',
      permission: Notification ? Notification.permission : 'n/a',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasOneSignal: typeof window.OneSignal !== 'undefined',
      oneSignalKeys: window.OneSignal ? Object.keys(window.OneSignal).slice(0, 30) : [],
      userAgent: navigator.userAgent,
    };
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      info.registrations = regs.map(r => ({ scope: r.scope, active: !!r.active, installing: !!r.installing, waiting: !!r.waiting }));
    } catch (e) {
      info.registrationsError = String(e);
    }
    try {
      const api = window.OneSignal || null;
      if (api) {
        info.initMethod = typeof api.init;
        info.getUserIdMethod = typeof api.getUserId;
        info.getDeviceStateMethod = typeof api.getDeviceState;
        info.notificationsMethod = api.Notifications ? typeof api.Notifications.requestPermission : 'none';
      }
    } catch (e) {
      info.apiError = String(e);
    }
    return info;
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
