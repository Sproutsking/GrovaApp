import { CLOUDINARY_CONFIG } from './cloudinary';
import { isPlaceholderValue } from './securityGuards';

describe('security guards', () => {
  it('never exposes the Cloudinary API secret to browser bundle code', () => {
    expect(CLOUDINARY_CONFIG).not.toHaveProperty('API_SECRET');
  });

  it('treats placeholder Supabase values as unsafe in production', () => {
    expect(isPlaceholderValue('demo-anon-key')).toBe(true);
    expect(isPlaceholderValue('https://example.supabase.co')).toBe(true);
    expect(isPlaceholderValue('https://rxtijxlvacqjiocdwzrh.supabase.co')).toBe(false);
  });
});
