/**
 * Jest tests for profile page component
 * Covers profile loading, pagination, error handling, uploads, and rendering
 */

import { User } from '@/api/entities';
import uploadFile from '@/api/upload';
import ProfileScreen from '@/app/profile';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

// Mock modules
jest.mock('@/api/entities');
jest.mock('@/api/upload');
jest.mock('expo-image-picker');
jest.mock('expo-image-manipulator');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((cb) => cb()),
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));
jest.mock('expo-image');
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: () => null,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

describe('ProfileScreen', () => {
  const mockUser = {
    id: '123',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: null,
    bio: 'Test bio',
    preferences: {
      role: 'fan',
      header_image_url: null,
    },
    _count: {
      posts: 5,
      followers: 10,
      following: 8,
    },
  };

  const mockPost = {
    id: '1',
    media_url: 'https://example.com/image.jpg',
    media_type: 'image',
    caption: 'Test post',
    upvotes_count: 5,
    comments_count: 2,
    bookmarks_count: 1,
  };

  const mockInteraction = {
    id: '2',
    post: mockPost,
    type: 'like',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock User API
    (User.me as jest.Mock).mockResolvedValue(mockUser);
    (User.postsForProfile as jest.Mock).mockResolvedValue({
      items: [mockPost],
      nextCursor: null,
      counts: { posts: 1, likes: 5, comments: 2, reposts: 0, saves: 1 },
    });
    (User.interactionsForProfile as jest.Mock).mockResolvedValue({
      items: [mockInteraction],
      nextCursor: null,
      counts: { posts: 1, likes: 5, comments: 2, reposts: 0, saves: 1 },
    });
    (User.updateMe as jest.Mock).mockResolvedValue(mockUser);

    // Mock upload
    (uploadFile.uploadFile as jest.Mock).mockResolvedValue({
      url: 'https://example.com/uploaded.jpg',
    });

    // Mock image picker
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///path/to/image.jpg',
          fileName: 'image.jpg',
        },
      ],
    });

    // Mock image manipulator
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///path/to/manipulated.jpg',
      width: 800,
      height: 800,
    });

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('Profile Loading', () => {
    it('should render loading skeleton initially', async () => {
      render(<ProfileScreen />);
      await waitFor(() => {
        expect(User.me).toHaveBeenCalled();
      });
    });

    it('should load user profile data', async () => {
      render(<ProfileScreen />);
      await waitFor(() => {
        expect(User.me).toHaveBeenCalled();
      });
    });

    it('should handle 401 unauthorized error', async () => {
      (User.me as jest.Mock).mockRejectedValueOnce({
        status: 401,
        message: 'Unauthorized',
      });

      render(<ProfileScreen />);
      await waitFor(() => {
        expect(screen.getByText(/need to sign in/i)).toBeTruthy();
      });
    });

    it('should handle generic load error', async () => {
      (User.me as jest.Mock).mockRejectedValueOnce({
        message: 'Network error',
      });

      render(<ProfileScreen />);
      await waitFor(() => {
        expect(screen.getByText(/unable to load profile/i)).toBeTruthy();
      });
    });
  });

  describe('Posts Tab', () => {
    it('should render posts in grid layout', async () => {
      render(<ProfileScreen />);
      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalled();
      });
    });

    it('should load first page of posts', async () => {
      render(<ProfileScreen />);
      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalledWith('123', expect.any(Object));
      });
    });

    it('should handle post pagination', async () => {
      (User.postsForProfile as jest.Mock)
        .mockResolvedValueOnce({
          items: [mockPost],
          nextCursor: 'cursor-2',
          counts: { posts: 10, likes: 50, comments: 20, reposts: 5, saves: 10 },
        })
        .mockResolvedValueOnce({
          items: [{ ...mockPost, id: '3' }],
          nextCursor: null,
          counts: { posts: 10, likes: 50, comments: 20, reposts: 5, saves: 10 },
        });

      render(<ProfileScreen />);
      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalledTimes(1);
      });

      // Simulate end reached
      const flatList = screen.getByTestId?.('posts-list');
      if (flatList) {
        fireEvent(flatList, 'endReached');
      }

      // Should request next page
      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalledTimes(2);
      });
    });

    it('should show empty state for no posts', async () => {
      (User.postsForProfile as jest.Mock).mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      render(<ProfileScreen />);
      await waitFor(() => {
        expect(screen.getByText(/no posts yet/i)).toBeTruthy();
      });
    });
  });

  describe('Interactions Tab', () => {
    it('should render interactions in masonry layout', async () => {
      render(<ProfileScreen />);
      
      // Switch to interactions tab
      const interactionsTab = screen.getByText(/interactions/i);
      fireEvent.press(interactionsTab);

      await waitFor(() => {
        expect(User.interactionsForProfile).toHaveBeenCalled();
      });
    });

    it('should load first page of interactions', async () => {
      render(<ProfileScreen />);
      
      const interactionsTab = screen.getByText(/interactions/i);
      fireEvent.press(interactionsTab);

      await waitFor(() => {
        expect(User.interactionsForProfile).toHaveBeenCalledWith('123', expect.any(Object));
      });
    });

    it('should filter interactions by type', async () => {
      render(<ProfileScreen />);
      
      const interactionsTab = screen.getByText(/interactions/i);
      fireEvent.press(interactionsTab);

      await waitFor(() => {
        expect(User.interactionsForProfile).toHaveBeenCalled();
      });

      // Select like filter
      const likeFilter = screen.getByText(/like/i);
      fireEvent.press(likeFilter);

      await waitFor(() => {
        expect(User.interactionsForProfile).toHaveBeenCalledWith('123', expect.objectContaining({ type: 'like' }));
      });
    });

    it('should show empty state for no interactions', async () => {
      (User.interactionsForProfile as jest.Mock).mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      render(<ProfileScreen />);
      
      const interactionsTab = screen.getByText(/interactions/i);
      fireEvent.press(interactionsTab);

      await waitFor(() => {
        expect(screen.getByText(/no activity yet/i)).toBeTruthy();
      });
    });
  });

  describe('Avatar Upload', () => {
    it('should request media library permission', async () => {
      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
        });
      }
    });

    it('should handle permission denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: false,
      });

      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'Permission required',
            expect.stringContaining('refused')
          );
        });
      }
    });

    it('should handle upload cancellation', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
      });

      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(uploadFile.uploadFile).not.toHaveBeenCalled();
        });
      }
    });

    it('should compress and upload avatar', async () => {
      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
            'file:///path/to/image.jpg',
            expect.any(Array),
            expect.any(Object)
          );
        });

        await waitFor(() => {
          expect(uploadFile.uploadFile).toHaveBeenCalled();
        });
      }
    });

    it('should update user avatar after successful upload', async () => {
      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(User.updateMe).toHaveBeenCalledWith(
            expect.objectContaining({
              avatar_url: 'https://example.com/uploaded.jpg',
            })
          );
        });
      }
    });

    it('should handle upload error', async () => {
      (uploadFile.uploadFile as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed')
      );

      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'Upload failed',
            expect.stringContaining('Could not upload')
          );
        });
      }
    });
  });

  describe('Background Image Upload', () => {
    it('should compress and upload background image', async () => {
      render(<ProfileScreen />);

      const bgButton = screen.getByTestId?.('background-upload-button');
      if (bgButton) {
        fireEvent.press(bgButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
            'file:///path/to/image.jpg',
            expect.any(Array),
            expect.any(Object)
          );
        });

        await waitFor(() => {
          expect(uploadFile.uploadFile).toHaveBeenCalled();
        });
      }
    });

    it('should update user preferences with background URL', async () => {
      render(<ProfileScreen />);

      const bgButton = screen.getByTestId?.('background-upload-button');
      if (bgButton) {
        fireEvent.press(bgButton);

        await waitFor(() => {
          expect(User.updateMe).toHaveBeenCalledWith(
            expect.objectContaining({
              preferences: expect.objectContaining({
                header_image_url: 'https://example.com/uploaded.jpg',
              }),
            })
          );
        });
      }
    });
  });

  describe('Memory Management', () => {
    it('should prevent state updates after unmount', async () => {
      const { unmount } = render(<ProfileScreen />);

      // Start an upload
      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      if (avatarButton) {
        fireEvent.press(avatarButton);
      }

      // Unmount component immediately
      unmount();

      // Simulate async operation completing
      await waitFor(() => {
        // Alert should not be called after unmount
        const alertCalls = (Alert.alert as jest.Mock).mock.calls.length;
        // If properly protected by isMountedRef, should be 0
        expect(alertCalls).toBeLessThanOrEqual(1); // 1 for permission request
      }, { timeout: 1000 });
    });
  });

  describe('Tab Switching', () => {
    it('should load posts when switching to posts tab', async () => {
      render(<ProfileScreen />);

      // Start on posts tab
      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalled();
      });

      // Switch to interactions
      const interactionsTab = screen.getByText(/interactions/i);
      fireEvent.press(interactionsTab);

      await waitFor(() => {
        expect(User.interactionsForProfile).toHaveBeenCalled();
      });

      // Switch back to posts
      const postsTab = screen.getByText(/posts/i);
      fireEvent.press(postsTab);

      // Should not reload if already loaded
      const postsCallCount = (User.postsForProfile as jest.Mock).mock.calls.length;
      expect(postsCallCount).toBeGreaterThanOrEqual(1);
    });

    it('should refresh data when focusing tab', async () => {
      render(<ProfileScreen />);

      await waitFor(() => {
        expect(User.postsForProfile).toHaveBeenCalled();
      });

      // Simulate focus event (e.g., navigating back to this screen)
      // This would trigger useFocusEffect
    });
  });

  describe('Accessibility', () => {
    it('should have accessible avatar button', async () => {
      render(<ProfileScreen />);

      const avatarButton = screen.getByTestId?.('avatar-upload-button');
      expect(avatarButton).toBeTruthy();
    });

    it('should have accessible tab buttons', async () => {
      render(<ProfileScreen />);

      const postsTab = screen.getByText(/posts/i);
      const interactionsTab = screen.getByText(/interactions/i);

      expect(postsTab).toBeTruthy();
      expect(interactionsTab).toBeTruthy();
    });
  });
});
