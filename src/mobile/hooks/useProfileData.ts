import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from 'lodash';
import { User, Post, UserInteraction } from '@/api/entities';

export interface ProfileData {
  currentUser: any | null;
  profileUser: any | null;
  posts: any[];
  interactions: any[];
  followersCount: number;
  followingCount: number;
  isOwnProfile: boolean;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useProfileData(targetUserId?: string | null): ProfileData {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const loadUserProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = await User.me();
      setCurrentUser(loggedInUser);

      const target = targetUserId || loggedInUser?.id;
      const own = !!loggedInUser && target === loggedInUser.id;
      setIsOwnProfile(own);

      const viewed = own ? loggedInUser : await User.get(target);
      setProfileUser(viewed);

      try {
        const userPosts = await Post.filter({ author_email: viewed.email }, '-created_date');
        setPosts(userPosts);
      } catch (postError) {
        console.warn('Failed to load posts', postError);
        setPosts([]);
      }

      try {
        const userInteractions = await UserInteraction.filter({ user_email: viewed.email }, '-created_date');
        setInteractions(userInteractions);
      } catch (interactionError) {
        console.warn('Failed to load interactions', interactionError);
        setInteractions([]);
      }

      try {
        const followers = await UserInteraction.filter({ interaction_type: 'follow', target_id: viewed.id });
        setFollowersCount(followers.length);
      } catch (followerError) {
        console.warn('Failed to load followers', followerError);
        setFollowersCount(0);
      }

      try {
        const following = await UserInteraction.filter({ interaction_type: 'follow', user_email: viewed.email });
        setFollowingCount(following.length);
      } catch (followingError) {
        console.warn('Failed to load following', followingError);
        setFollowingCount(0);
      }

    } catch (userError: any) {
      console.error('Error loading user profile:', userError);
      if (userError?.message?.includes('authentication') || userError?.message?.includes('not logged in')) {
        setError('You need to sign in to view this profile.');
      } else {
        setError('Unable to load profile.');
      }
      setCurrentUser(null);
      setProfileUser(null);
      setPosts([]);
      setInteractions([]);
      setFollowersCount(0);
      setFollowingCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  const debouncedLoad = useMemo(() => debounce(loadUserProfile, 300), [loadUserProfile]);

  useEffect(() => {
    debouncedLoad();
    return () => debouncedLoad.cancel();
  }, [debouncedLoad]);

  return {
    currentUser,
    profileUser,
    posts,
    interactions,
    followersCount,
    followingCount,
    isOwnProfile,
    isLoading,
    error,
    reload: loadUserProfile,
  };
}

