import socialConnectService, { getPlatformConfig, resolveProviderLinkState } from './socialConnectService';
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

describe('getPlatformConfig', () => {
  it('keeps XRD account linking read-only', () => {
    expect(getPlatformConfig('x', { readOnly: true }).scopes).toBe('tweet.read users.read offline.access');
    expect(getPlatformConfig('x', { readOnly: true }).scopes).not.toContain('tweet.write');
    expect(getPlatformConfig('linkedin', { readOnly: true }).scopes).not.toContain('w_member_social');
  });

  it('preserves publishing scopes for existing distribution callers', () => {
    expect(getPlatformConfig('x').scopes).toContain('tweet.write');
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
