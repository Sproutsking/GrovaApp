import socialConnectService, { getPlatformConfig, resolveProviderLinkState, validateProfileUrl } from './socialConnectService';
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getPlatformConfig', () => {
  it('keeps XRD account linking read-only', () => {
    expect(getPlatformConfig('x', { readOnly: true }).scopes).toBe('tweet.read users.read offline.access');
    expect(getPlatformConfig('x', { readOnly: true }).scopes).not.toContain('tweet.write');
    expect(getPlatformConfig('x').provider).toBe('x');
    expect(getPlatformConfig('linkedin', { readOnly: true }).scopes).not.toContain('w_member_social');
  });

  it('uses Supabase OAuth providers for Twitch and Spotify connectors', () => {
    expect(getPlatformConfig('twitch')).toMatchObject({ provider: 'twitch', scopes: 'user:read:email' });
    expect(getPlatformConfig('spotify')).toMatchObject({ provider: 'spotify' });
    expect(getPlatformConfig('tiktok')).toBeNull();
    expect(socialConnectService._providerToPlatform('twitch')).toBe('twitch');
    expect(socialConnectService._providerToPlatform('spotify')).toBe('spotify');
    expect(socialConnectService._providerToPlatform('x')).toBe('x');
  });

  it('has OAuth configuration for each app connector backed by a Supabase provider', () => {
    ['x', 'facebook', 'instagram', 'linkedin', 'google', 'apple', 'github', 'gitlab', 'bitbucket', 'figma', 'notion', 'discord', 'twitch', 'spotify']
      .forEach((platform) => expect(getPlatformConfig(platform)).not.toBeNull());
    expect(getPlatformConfig('gitlab').scopes).toBe('read_user');
    expect(getPlatformConfig('figma').scopes).toBe('current_user:read');
    expect(getPlatformConfig('notion').provider).toBe('notion');
    expect(getPlatformConfig('bitbucket').provider).toBe('bitbucket');
    ['gitlab', 'bitbucket', 'figma', 'notion'].forEach((provider) => {
      expect(socialConnectService._providerToPlatform(provider)).toBe(provider);
    });
  });

  describe('validateProfileUrl', () => {
    it('accepts a specific HTTPS profile on the selected platform', () => {
      expect(validateProfileUrl('twitch', 'https://www.twitch.tv/sproutsking'))
        .toBe('https://www.twitch.tv/sproutsking');
    });

    it('rejects insecure, unrelated, and homepage-only URLs', () => {
      expect(() => validateProfileUrl('twitch', 'http://twitch.tv/sproutsking'))
        .toThrow('HTTPS');
      expect(() => validateProfileUrl('twitch', 'https://twitch.tv.attacker.example/sproutsking'))
        .toThrow('profile URL from');
      expect(() => validateProfileUrl('twitch', 'https://twitch.tv/'))
        .toThrow('specific public profile');
    });
  });

  it('preserves publishing scopes for existing distribution callers', () => {
    expect(getPlatformConfig('x').scopes).toContain('tweet.write');
    expect(getPlatformConfig('instagram').scopes).toContain('pages_show_list');
    expect(getPlatformConfig('instagram').provider).toBe('facebook');
    expect(getPlatformConfig('instagram').scopes).toContain('instagram_content_publish');
    expect(getPlatformConfig('linkedin').scopes).toContain('w_member_social');
    expect(getPlatformConfig('unknown')).toBeNull();
  });
});

describe('resolveProviderLinkState', () => {
  it('does not treat a Supabase auth identity as publish-ready without a token', () => {
    const state = resolveProviderLinkState({
      platform: 'google',
      identities: [{ provider: 'google', identity_data: { email: 'user@example.com' } }],
      connections: {},
    });

    expect(state).toMatchObject({ alreadyConnected: false, source: 'supabase_identity' });
  });

  it('recognizes a direct connection only when it has a valid publishing token', () => {
    const state = resolveProviderLinkState({
      platform: 'x',
      identities: [],
      connections: { x: { provider: 'x', auth_status: 'active', hasValidToken: true } },
    });

    expect(state).toMatchObject({ alreadyConnected: true, source: 'connections_table' });
  });

  it('allows a sign-in identity with a missing token to be reconnected', () => {
    const state = resolveProviderLinkState({
      platform: 'x',
      identities: [{ provider: 'twitter', identity_data: { user_name: 'xuser' } }],
      connections: { x: { provider: 'x', auth_status: 'active', hasValidToken: false } },
    });

    expect(state).toMatchObject({ alreadyConnected: false, source: 'supabase_identity' });
  });

  it("refreshes the publishing token for an already-active identity connection", async () => {
    const connectionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: "connection-x", auth_status: "active" },
        error: null,
      }),
    };
    const tokenQuery = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          identities: [{ provider: "twitter", id: "x-user", identity_data: { user_name: "xuser" } }],
        },
      },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { app_metadata: { provider: "twitter" } },
          provider_token: "fresh-provider-token",
          provider_refresh_token: "fresh-refresh-token",
        },
      },
    });
    supabase.from.mockImplementation((table) => (
      table === "connections" ? connectionQuery : tokenQuery
    ));

    await expect(socialConnectService.checkAndImportExistingIdentities("user-1"))
      .resolves.toEqual({ x: true });

    expect(tokenQuery.upsert).toHaveBeenCalledWith({
      connection_id: "connection-x",
      encrypted_token: "fresh-provider-token",
      refresh_token: "fresh-refresh-token",
      expires_at: null,
      revoked: false,
    }, { onConflict: "connection_id" });
  });
});

describe('linkPlatform', () => {
  it('reopens OAuth for an existing connection whose publishing token is missing', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [] } },
      error: null,
    });
    jest.spyOn(socialConnectService, 'getConnections').mockResolvedValue({
      x: { id: 'connection-x', auth_status: 'active', hasValidToken: false },
    });
    const popup = jest.spyOn(socialConnectService, '_openOAuthPopup')
      .mockResolvedValue({ platform: 'x', platformUserId: 'x-user' });

    await expect(socialConnectService.linkPlatform('user-1', 'x'))
      .resolves.toEqual({ platform: 'x', platformUserId: 'x-user' });

    expect(popup).toHaveBeenCalledWith(
      'user-1',
      'x',
      expect.objectContaining({ provider: 'x' }),
      undefined,
    );
  });
});
