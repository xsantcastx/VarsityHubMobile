import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PostDetailScreen from '@/app/(tabs)/post-detail';
import { PostCacheProvider } from '@/context/PostCacheContext';
import { AuthProvider } from '@/context/AuthProvider';
import * as PostApi from '@/api/entities';

// Mock the API
jest.mock('@/api/entities', () => ({
  Post: {
    get: jest.fn(),
    comments: jest.fn(),
    toggleUpvote: jest.fn(),
    toggleBookmark: jest.fn(),
    addComment: jest.fn(),
  },
  User: {
    me: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'test-post-123' })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  Stack: { Screen: jest.fn() },
}));

jest.mock('@/hooks/useShareLink', () => ({
  useShareLink: jest.fn(() => ({
    share: jest.fn(),
  })),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 0 },
  NotificationFeedbackType: { Success: 0, Error: 1 },
}));

jest.mock('@/components/VideoPlayer', () => {
  return function MockVideoPlayer() {
    return null;
  };
});

jest.mock('expo-video', () => ({
  VideoView: jest.fn(),
  useVideoPlayer: jest.fn(() => ({
    player: null,
    pause: jest.fn(),
    play: jest.fn(),
  })),
}));

jest.mock('@/context/AuthProvider', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: jest.fn(() => ({
    user: { id: 'current-user' },
  })),
}));

const mockPost = {
  id: 'test-post-123',
  title: 'Test Post Title',
  content: 'Test post content',
  caption: 'Test caption',
  media_url: 'https://example.com/image.jpg',
  author: { 
    id: 'author-123', 
    display_name: 'Test Author',
    username: 'testauthor',
    avatar_url: null 
  },
  upvotes_count: 42,
  comments_count: 1,
  has_upvoted: false,
  has_bookmarked: false,
  is_following_author: false,
};

const mockComments = [
  {
    id: 'comment-1',
    content: 'Great post!',
    author_id: 'user-1',
    author: { 
      id: 'user-1', 
      display_name: 'User 1', 
      avatar_url: null 
    },
    created_at: new Date().toISOString(),
  },
];

describe('Post Detail Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PostApi.Post.get as jest.Mock).mockResolvedValue(mockPost);
    (PostApi.Post.comments as jest.Mock).mockResolvedValue(mockComments);
    (PostApi.User.me as jest.Mock).mockResolvedValue({ id: 'current-user' });
  });

  test('displays post content when loaded successfully', async () => {
    const { getByText } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    // Should fetch post from API when not in cache
    await waitFor(() => {
      expect(PostApi.Post.get).toHaveBeenCalledWith('test-post-123');
    });

    // Should display post content after loading
    await waitFor(() => {
      expect(getByText('Test post content')).toBeDefined();
    });
  });

  test('displays error message when post fails to load', async () => {
    (PostApi.Post.get as jest.Mock).mockRejectedValue(new Error('Post not found'));

    const { getByText } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    await waitFor(() => {
      expect(getByText(/Failed to load post|Post not found/)).toBeDefined();
    });
  });

  test('toggles upvote state on button press', async () => {
    (PostApi.Post.toggleUpvote as jest.Mock).mockResolvedValue({ 
      count: 43,
      has_upvoted: true 
    });

    const { getByTestId, getByText } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    // Wait for post to load
    await waitFor(() => {
      expect(PostApi.Post.get).toHaveBeenCalled();
    });

    // Find and press upvote button
    await waitFor(() => {
      const upvoteButton = getByTestId('upvote-button');
      expect(upvoteButton).toBeDefined();
      fireEvent.press(upvoteButton);
    });

    // Verify API was called
    await waitFor(() => {
      expect(PostApi.Post.toggleUpvote).toHaveBeenCalledWith('test-post-123');
    });
  });

  test('displays comments list after loading', async () => {
    const { getByText } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    await waitFor(() => {
      expect(PostApi.Post.comments).toHaveBeenCalledWith('test-post-123');
      expect(getByText('Great post!')).toBeDefined();
    });
  });

  test('allows adding a new comment', async () => {
    const newComment = {
      id: 'comment-2',
      content: 'Awesome post!',
      author_id: 'current-user',
      author: { id: 'current-user', display_name: 'Current User' },
      created_at: new Date().toISOString(),
    };

    (PostApi.Post.addComment as jest.Mock).mockResolvedValue(newComment);

    const { getByTestId, getByText } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    await waitFor(() => {
      const commentInput = getByTestId('comment-input');
      const submitButton = getByTestId('submit-comment');
      
      fireEvent.changeText(commentInput, 'Awesome post!');
      fireEvent.press(submitButton);
    });

    await waitFor(() => {
      expect(PostApi.Post.addComment).toHaveBeenCalledWith('test-post-123', 'Awesome post!');
    });
  });

  test('retry button refetches post on error', async () => {
    // First render with error
    (PostApi.Post.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { getByTestId, getByText, rerender } = render(
      <PostCacheProvider>
        <AuthProvider>
          <PostDetailScreen />
        </AuthProvider>
      </PostCacheProvider>
    );

    // Wait for error to appear
    await waitFor(
      () => {
        const errorText = getByText(/Failed to load post|error/i);
        expect(errorText).toBeDefined();
      },
      { timeout: 2000 }
    );

    // Setup success response for retry
    (PostApi.Post.get as jest.Mock).mockResolvedValueOnce(mockPost);
    (PostApi.Post.comments as jest.Mock).mockResolvedValueOnce(mockComments);

    // Press retry button - should now exist
    const retryButton = getByTestId('retry-button');
    expect(retryButton).toBeDefined();
    fireEvent.press(retryButton);

    // Verify post loads successfully after retry
    await waitFor(
      () => {
        expect(PostApi.Post.get).toHaveBeenCalledWith('test-post-123');
      },
      { timeout: 2000 }
    );
  });
});

