import React from 'react';
import { render, screen } from '@testing-library/react';
import BoostAvatarRing from './BoostAvatarRing';

describe('BoostAvatarRing', () => {
  it('does not render a verified chip on the avatar image itself', () => {
    render(
      <BoostAvatarRing
        tier="gold"
        themeId="gold"
        size={80}
        letter="D"
        showBadge={true}
      />
    );

    expect(screen.queryByText('✓')).toBeNull();
  });
});
