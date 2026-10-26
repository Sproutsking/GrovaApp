import distributionService from './distributionService';
import { supabase } from '../config/supabase';
import socialConnectService from './socialConnectService';

jest.mock('../config/supabase', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('./socialConnectService', () => ({
  __esModule: true,
  default: { getConnections: jest.fn() },
}));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('distributionService.getConnectedPlatforms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not treat a Supabase auth identity without a publishing token as connected', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

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
    supabase.rpc.mockResolvedValue({
      data: [
        { provider: 'twitter', auth_status: 'active', platform_user_id: 'xuser', has_valid_token: true },
        { provider: 'facebook', auth_status: 'active', platform_user_id: null, has_valid_token: false },
      ],
      error: null,
    });

    await expect(distributionService.getPlatformConnectionStates('user-1')).resolves.toEqual({
      x: { status: 'ready', canPublish: true, platformUserId: 'xuser' },
      facebook: { status: 'reconnect', canPublish: false, platformUserId: null },
    });
    await expect(distributionService.getConnectedPlatforms('user-1')).resolves.toEqual(['x']);
  });

  it('falls back cleanly when the readiness RPC has not been deployed yet', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.get_distribution_connection_states(p_user_id) in the schema cache',
      },
    });
    socialConnectService.getConnections.mockResolvedValue({
      x: { auth_status: 'active', platform_user_id: 'xuser', hasValidToken: true },
      facebook: { auth_status: 'expired', platform_user_id: 'page-1', hasValidToken: false },
      linkedin: { auth_status: 'revoked', platform_user_id: 'member-1', hasValidToken: false },
    });

    await expect(distributionService.getPlatformConnectionStates('user-1')).resolves.toEqual({
      x: { status: 'ready', canPublish: true, platformUserId: 'xuser' },
      facebook: { status: 'reconnect', canPublish: false, platformUserId: 'page-1' },
    });
    await expect(distributionService.getConnectedPlatforms('user-1')).resolves.toEqual(['x']);
  });
});

describe('distributionService.getPublishTargets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes only to ready selected platforms and skips stale selections', async () => {
    jest.spyOn(distributionService, 'getPlatformPreferences').mockResolvedValue({});
    jest.spyOn(distributionService, 'getConnectedPlatforms').mockResolvedValue(['facebook']);

    await expect(distributionService.getPublishTargets('user-1', ['x', 'facebook']))
      .resolves.toEqual(['facebook']);
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

  it('upserts per-platform rows so repeated distribution does not duplicate records', async () => {
    const postQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'post-1', user_id: 'user-1', content: 'hello' },
        error: null,
      }),
    };
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const updateQuery = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve({ error: null }).then(resolve),
    };
    const update = jest.fn(() => updateQuery);
    supabase.from.mockImplementation((table) => {
      if (table === 'posts') return postQuery;
      if (table === 'post_distribution') return { upsert, update };
      if (table === 'distribution_queue') throw new Error('queue unavailable');
      throw new Error(`Unexpected table: ${table}`);
    });
    supabase.functions.invoke.mockResolvedValue({ data: { externalId: 'remote-post-1' }, error: null });
    jest.spyOn(distributionService, 'getPublishTargets').mockResolvedValue(['x']);

    await expect(
      distributionService.distributePost('post-1', 'user-1', ['x']),
    ).resolves.toMatchObject({ success: true, targets: ['x'] });
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ post_id: 'post-1', user_id: 'user-1', platform: 'x', status: 'pending' })],
      { onConflict: 'post_id,platform' },
    );
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
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'No active x publishing connection was found.' },
    });

    await expect(
      distributionService._publishToSinglePlatform('post-1', 'user-1', {}, 'x'),
    ).resolves.toMatchObject({
      platform: 'x',
      status: 'fallback',
      error: 'No active x publishing connection was found.',
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('publish-social-post', {
      body: { contentType: 'post', contentId: 'post-1', platform: 'x' },
    });
    expect(supabase.from).not.toHaveBeenCalledWith('tokens');
    expect(statusQuery.catch).toBeUndefined();
  });

  it('records the server-published post ID and returns success', async () => {
    const statusQuery = {
      then: (resolve) => Promise.resolve({ error: null }).then(resolve),
    };
    supabase.from.mockImplementation((table) => {
      if (table === 'post_distribution') {
        return { update: () => ({ eq: () => ({ eq: () => statusQuery }) }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    supabase.functions.invoke.mockResolvedValue({ data: { externalId: 'remote-post-1' }, error: null });

    await expect(
      distributionService._publishToSinglePlatform('post-1', 'user-1', {}, 'x'),
    ).resolves.toMatchObject({ platform: 'x', status: 'success', externalId: 'remote-post-1' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('publish-social-post', {
      body: { contentType: 'post', contentId: 'post-1', platform: 'x' },
    });
  });
});
