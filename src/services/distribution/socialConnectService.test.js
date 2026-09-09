import { resolveProviderLinkState } from './socialConnectService';

describe('resolveProviderLinkState', () => {
  it('recognizes a provider already connected through Supabase auth identities', () => {
    const state = resolveProviderLinkState({
      platform: 'google',
      identities: [{ provider: 'google', identity_data: { email: 'user@example.com' } }],
      connections: {},
    });

    expect(state).toMatchObject({ alreadyConnected: true, source: 'supabase_identity' });
  });

  it('keeps a direct DB connection as already connected for the same provider', () => {
    const state = resolveProviderLinkState({
      platform: 'x',
      identities: [],
      connections: { x: { provider: 'x', auth_status: 'active' } },
    });

    expect(state).toMatchObject({ alreadyConnected: true, source: 'connections_table' });
  });
});
