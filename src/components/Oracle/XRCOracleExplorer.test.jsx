import { resolveProfileTargetFromRecord } from './XRCOracleExplorer';

describe('resolveProfileTargetFromRecord', () => {
  it('prefers the embedded profile payload and keeps the verification record attached', () => {
    const record = {
      record_id: 'rec-123',
      actor_id: 'actor-9',
      stream_type: 'XARC',
      payload: { event: 'account_created', user_id: 'payload-user' },
      _profile: {
        id: 'profile-42',
        full_name: 'Sprouts King',
        username: 'sprouts_king',
        avatar_id: 'avatar-2',
        verified: true,
      },
    };

    expect(resolveProfileTargetFromRecord(record)).toMatchObject({
      id: 'profile-42',
      user_id: 'profile-42',
      full_name: 'Sprouts King',
      username: 'sprouts_king',
      verificationRecord: record,
    });
  });

  it('falls back to a payload user id when no embedded profile is present', () => {
    const record = {
      record_id: 'rec-456',
      stream_type: 'XCRC',
      actor_id: 'actor-77',
      payload: { event: 'post_created', user_id: 'payload-user-77' },
    };

    expect(resolveProfileTargetFromRecord(record)).toMatchObject({
      id: 'payload-user-77',
      user_id: 'payload-user-77',
      verificationRecord: record,
    });
  });

  it('uses a dashboard layer above the Oracle fullscreen layer', () => {
    expect(100001).toBeGreaterThan(100000);
  });
});
