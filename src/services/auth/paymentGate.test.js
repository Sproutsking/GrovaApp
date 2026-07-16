import { canAccessApp, isPaidProfile } from './paymentGate';

describe('payment gate access checks', () => {
  it('treats legacy is_pro profiles as paid even when payment_status is pending', () => {
    const profile = { id: 'u1', is_pro: true, payment_status: 'pending', account_status: 'active' };
    expect(isPaidProfile(profile)).toBe(true);
    expect(canAccessApp({ profile, isAdmin: false, adminData: null, paidCache: false })).toBe(true);
  });

  it('blocks suspended accounts even when they are marked paid', () => {
    const profile = { id: 'u2', is_pro: true, payment_status: 'paid', account_status: 'suspended' };
    expect(isPaidProfile(profile)).toBe(true);
    expect(canAccessApp({ profile, isAdmin: false, adminData: null, paidCache: false })).toBe(false);
  });
});
