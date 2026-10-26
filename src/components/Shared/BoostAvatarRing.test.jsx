import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('tries the next image source when the primary avatar URL fails', () => {
    const { container, rerender } = render(
      <BoostAvatarRing
        size={80}
        src="https://media.example/expired-avatar.jpg"
        fallbackSrc={["https://media.example/storage-avatar.jpg"]}
        letter="D"
      />
    );

    const avatarImage = container.querySelector('img');
    expect(avatarImage).not.toBeNull();
    fireEvent.error(avatarImage);

    expect(container.querySelector('img').getAttribute('src')).toBe("https://media.example/storage-avatar.jpg");

    rerender(
      <BoostAvatarRing
        size={80}
        src="https://media.example/expired-avatar.jpg"
        fallbackSrc={["https://media.example/storage-avatar.jpg"]}
        letter="D"
      />
    );
    expect(container.querySelector('img').getAttribute('src')).toBe("https://media.example/storage-avatar.jpg");
  });
});
