import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const onUpvote = jest.fn();

jest.mock('@/hooks/usePostInteractions', () => ({
  REPORT_REASONS: [],
  usePostInteractions: () => ({
    upvotesCount: 3,
    bookmarked: false,
    bookmarksCount: 0,
    reportSubmitting: false,
    onUpvote,
    onBookmark: jest.fn(),
    submitReport: jest.fn(),
  }),
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'me' } }),
}));

jest.mock('@/context/PostCacheContext', () => ({
  usePostCache: () => ({ remove: jest.fn() }),
}));

jest.mock('@/utils/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    impact: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

// Keep the render light — stub the heavy leaf children.
jest.mock('@/components/EventChip', () => () => null);
jest.mock('@/components/RankingBadge', () => () => null);
jest.mock('@/components/ExpandableText', () => {
  const { Text } = require('react-native');
  return (props: any) => <Text>{props.text ?? props.children ?? ''}</Text>;
});

import PostCard from '@/components/PostCard';
import { haptics } from '@/utils/haptics';

const post: any = {
  id: 'p1',
  content: 'Great game tonight',
  title: '',
  author: { id: 'u1', username: 'me', display_name: 'Me', avatar_url: null },
  upvotes_count: 3,
  bookmarks_count: 0,
  has_bookmarked: false,
  created_at: new Date('2026-01-01').toISOString(),
};

describe('PostCard upvote button', () => {
  beforeEach(() => jest.clearAllMocks());

  it('still fires onUpvote when pressed (regression after PressableScale swap)', () => {
    const { getByTestId } = render(<PostCard post={post} />);
    fireEvent.press(getByTestId('post-card-upvote-p1'));
    expect(onUpvote).toHaveBeenCalledTimes(1);
  });

  it('fires a haptic on press-in', () => {
    const { getByTestId } = render(<PostCard post={post} />);
    fireEvent(getByTestId('post-card-upvote-p1'), 'pressIn');
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });
});
