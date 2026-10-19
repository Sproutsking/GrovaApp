import { resolveProviderLinkState } from './socialConnectService';

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
});
