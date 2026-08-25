import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import FullContentView from './FullContentView';

describe('FullContentView', () => {
  it('renders the story overlay through the document body so it stays above the sidebars', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-testid', 'story-parent');
    document.body.appendChild(parent);

    const story = {
      id: 'story-1',
      user_id: 'user-1',
      title: 'A story title',
      full_content: 'This is the full story body.',
      category: 'General',
      created_at: '2026-08-21T00:00:00.000Z',
      views: 42,
      likes: 13,
      comments_count: 5,
      profiles: {
        full_name: 'Ada Writer',
        username: 'adawriter',
        avatar_id: null,
        verified: false,
      },
      author: 'Ada Writer',
      username: 'adawriter',
      cover_image_id: null,
      unlock_cost: 0,
    };

    render(
      <FullContentView
        story={story}
        onClose={jest.fn()}
        currentUser={null}
      />,
      { container: parent }
    );

    expect(parent.querySelector('.fullscreen-overlay')).toBeNull();
    expect(document.body.querySelector('.fullscreen-overlay')).toBeInTheDocument();

    document.body.removeChild(parent);
  });
});
