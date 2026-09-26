import distributionService from './distributionService';
import { supabase } from '../config/supabase';

jest.mock('../config/supabase', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('distributionService.getConnectedPlatforms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats a Supabase auth identity as a connected platform for distribution', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'connections') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'tokens') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          identities: [{ provider: 'twitter', identity_data: { user_name: 'xuser' } }],
        },
      },
      error: null,
    });

    await expect(distributionService.getConnectedPlatforms('user-1')).resolves.toEqual(['x']);
  });
});
