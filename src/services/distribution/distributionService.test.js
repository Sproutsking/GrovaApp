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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('distributionService.getConnectedPlatforms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not treat a Supabase auth identity without a publishing token as connected', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'connections') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
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

    await expect(distributionService.getConnectedPlatforms('user-1')).resolves.toEqual([]);
  });

  it('returns only active connections with an unexpired publishing token', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'connections') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { id: 'x-connection', provider: 'twitter', auth_status: 'active', platform_user_id: 'xuser' },
                { id: 'fb-connection', provider: 'facebook', auth_status: 'active', platform_user_id: null },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'tokens') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { connection_id: 'x-connection', encrypted_token: 'x-token', expires_at: null },
                  { connection_id: 'fb-connection', encrypted_token: 'expired-token', expires_at: '2000-01-01T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(distributionService.getPlatformConnectionStates('user-1')).resolves.toEqual({
      x: { status: 'ready', platformUserId: 'xuser' },
      facebook: { status: 'reconnect', platformUserId: null },
    });
    await expect(distributionService.getConnectedPlatforms('user-1')).resolves.toEqual(['x']);
  });
});

describe('distributionService publishing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('distributionService.distributeContent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('publishes a story preview without exposing the locked full story', async () => {
      const storyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'story-1',
            user_id: 'user-1',
            title: 'A public title',
            preview: 'A short public preview',
            full_content: 'Locked story text must not be sent',
            cover_image_metadata: { url: 'https://cdn.example/cover.jpg' },
          },
          error: null,
        }),
      };
      const upsert = jest.fn().mockResolvedValue({ error: null });
      supabase.from.mockImplementation((table) => {
        if (table === 'stories') return storyQuery;
        if (table === 'content_distribution') return { upsert };
        throw new Error(`Unexpected table: ${table}`);
      });

      jest.spyOn(distributionService, 'getPublishTargets').mockResolvedValue(['x']);
      const publish = jest.spyOn(distributionService, '_publishToSinglePlatform')
        .mockResolvedValue({ platform: 'x', status: 'success' });

      await expect(
        distributionService.distributeContent('story', 'story-1', 'user-1', ['x']),
      ).resolves.toMatchObject({ success: true, targets: ['x'] });

      expect(storyQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'story-1');
      expect(storyQuery.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
      expect(publish).toHaveBeenCalledWith(
        'story-1',
        'user-1',
        expect.objectContaining({
          content: 'A public title\n\nA short public preview',
          image_metadata: [{ url: 'https://cdn.example/cover.jpg' }],
        }),
        'x',
        'story',
      );
      expect(publish.mock.calls[0][2].content).not.toContain('Locked story text');
      expect(upsert).toHaveBeenCalledWith(
        [expect.objectContaining({ content_type: 'story', content_id: 'story-1', platform: 'x' })],
        { onConflict: 'content_type,content_id,platform' },
      );
    });
  });

  it('records a failed connection without calling catch on a Supabase thenable', async () => {
    const statusQuery = {
      then: (resolve) => Promise.resolve({ error: null }).then(resolve),
    };
    supabase.from.mockImplementation((table) => {
      if (table === 'connections') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                eq: () => ({
                  limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'post_distribution') {
        return {
          update: () => ({
            eq: () => ({ eq: () => statusQuery }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      distributionService._publishToSinglePlatform('post-1', 'user-1', {}, 'x'),
    ).rejects.toThrow('Not connected to x');
    expect(supabase.from).toHaveBeenCalledWith('post_distribution');
    expect(statusQuery.catch).toBeUndefined();
  });
});
