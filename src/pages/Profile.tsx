
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User, Post, UserInteraction } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Settings, MessageCircle, LogIn, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { debounce } from 'lodash';
import { motion } from "framer-motion";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({}); // To store author data for posts
  const [interactions, setInteractions] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  const loadUserProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(location.search);
      const userIdFromUrl = urlParams.get('id');

      const loggedInUser = await User.me();
      setCurrentUser(loggedInUser);

      const targetUserId = userIdFromUrl || loggedInUser.id;
      const currentIsOwnProfile = targetUserId === loggedInUser.id;
      setIsOwnProfile(currentIsOwnProfile);

      const viewedUser = currentIsOwnProfile ? loggedInUser : await User.get(targetUserId);
      setProfileUser(viewedUser);

      // Load posts for the viewed user
      try {
        const userPosts = await Post.filter({ author_email: viewedUser.email }, '-created_date');
        setPosts(userPosts);
        if (userPosts.length > 0) {
          setAuthors(prevAuthors => ({ ...prevAuthors, [viewedUser.email]: viewedUser }));
        }
      } catch (postError) {
        console.error("Failed to load posts:", postError);
        setPosts([]);
      }

      // Load interactions for the viewed user
      try {
        const userInteractions = await UserInteraction.filter({ user_email: viewedUser.email }, '-created_date');
        setInteractions(userInteractions);
      } catch (interactionError) {
        console.error("Failed to load interactions:", interactionError);
        setInteractions([]);
      }

      // Load social counts for the viewed user
      try {
        const followers = await UserInteraction.filter({ interaction_type: 'follow', target_id: viewedUser.id });
        setFollowersCount(followers.length);
      } catch (followerError) {
        console.error("Failed to load followers:", followerError);
        setFollowersCount(0);
      }

      try {
        const following = await UserInteraction.filter({ interaction_type: 'follow', user_email: viewedUser.email });
        setFollowingCount(following.length);
      } catch (followingError) {
        console.error("Failed to load following:", followingError);
        setFollowingCount(0);
      }

    } catch (userError) {
      console.error("Error loading user profile:", userError);
      // More specific error messages for user
      if (userError.message.includes("authentication") || userError.message.includes("not logged in") || !currentUser) {
        setError("You need to sign in to view this profile.");
      } else {
        setError("Unable to load profile. The user may not exist or an error occurred.");
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
  }, [location.search]);

  const debouncedLoad = useMemo(
    () => debounce(loadUserProfile, 400),
    [loadUserProfile]
  );

  useEffect(() => {
    debouncedLoad();
    return () => {
      debouncedLoad.cancel();
    };
  }, [debouncedLoad]);

  const handleLogin = async () => {
    try {
      await User.loginWithRedirect(window.location.href);
    } catch (loginError) {
      console.error("Login failed:", loginError);
      alert("Please try refreshing the page or check your internet connection.");
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    window.location.reload();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or profile not found state
  if (!profileUser && !isLoading) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to VarsityHub</h2>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <p className="text-gray-600">Sign in to view your profile and connect with the sports community.</p>
          </div>

          <div className="space-y-3">
            <Button onClick={handleLogin} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
            <Button onClick={() => navigate(createPageUrl('Feed'))} variant="outline" className="w-full">
              Browse Feed
            </Button>
          </div>

          <Card className="text-left bg-gray-50">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">New to VarsityHub?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Follow your favorite teams and players</li>
                <li>• Discover local games and events</li>
                <li>• Connect with coaches and athletes</li>
                <li>• Share highlights and memories</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Authenticated user profile
  const getProfileBadge = () => {
    const role = profileUser.initial_role_selection || profileUser.user_role;
    switch (role) {
      case 'coach_organizer':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">Coach</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {/* Profile Header */}
      <div className="p-4 space-y-4">
        {/* Avatar and Stats Row */}
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profileUser?.avatar_url} />
            <AvatarFallback className="text-2xl font-semibold bg-gray-100 text-gray-600">
              {profileUser?.username ? profileUser.username[0].toUpperCase() : profileUser?.full_name ? profileUser.full_name[0].toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex justify-around text-center">
            <div>
              <div className="font-bold text-lg">{posts.length}</div>
              <div className="text-sm text-gray-600">posts</div>
            </div>
            <div>
              <div className="font-bold text-lg">{followersCount}</div>
              <div className="text-sm text-gray-600">followers</div>
            </div>
            <div>
              <div className="font-bold text-lg">
                {followingCount}
              </div>
              <div className="text-sm text-gray-600">following</div>
            </div>
          </div>
        </div>

        {/* Username and Info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-semibold text-base">
              {profileUser?.username || profileUser?.full_name || 'User'}
            </h1>
            {getProfileBadge()}
          </div>

          {/* Team Member Position/Jersey */}
          {profileUser && (profileUser.initial_role_selection === 'team_member' || profileUser.user_role === 'team_member') && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {profileUser.position && <span>{profileUser.position}</span>}
              {profileUser.position && profileUser.jersey_number && <span className="text-gray-400">•</span>}
              {profileUser.jersey_number && <span>#{profileUser.jersey_number}</span>}
            </div>
          )}

          {profileUser?.bio && (
            <p className="text-sm text-gray-600 leading-relaxed mt-2">{profileUser.bio}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <>
              <Button
                variant="outline"
                className="flex-1 h-8 text-sm font-medium border-gray-300 hover:bg-gray-50"
                onClick={() => navigate(createPageUrl('EditProfile'))}
              >
                Edit Profile
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-gray-300 hover:bg-gray-50"
                onClick={() => navigate(createPageUrl('Settings'))}
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </Button>
            </>
          ) : (
            <>
              {/* Example: Message button for other profiles (if current user exists) */}
              {currentUser && (
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-sm font-medium border-gray-300 hover:bg-gray-50"
                  onClick={() => navigate(createPageUrl('Chat', { userId: profileUser.id }))} // Placeholder for chat functionality
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              )}
              {/* Example: Follow/Unfollow button for other profiles (if current user exists) */}
              {currentUser && (
                <Button
                  variant="secondary"
                  className="h-8 text-sm font-medium"
                  // onClick={handleFollowToggle} // Implement follow/unfollow logic
                >
                  Follow
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Simple Content Area */}
      <div className="border-t">
        <div className="p-8 text-center">
          {posts.length === 0 ? (
            <>
              <div className="text-gray-400 mb-2">
                {isOwnProfile ? "No posts yet" : `${profileUser?.username || profileUser?.full_name || 'This user'} has no posts yet.`}
              </div>
              <div className="text-sm text-gray-500">
                {isOwnProfile ? "Share your first moment with the community!" : ""}
              </div>
              {isOwnProfile && (
                <Button
                  onClick={() => navigate(createPageUrl('CreatePost'))}
                  className="mt-4"
                >
                  Create Your First Post
                </Button>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">
              <p>
                {isOwnProfile
                  ? `You have ${posts.length} posts.`
                  : `${profileUser?.username || profileUser?.full_name || 'This user'} has ${posts.length} posts.`}
              </p>
              {/* You would typically render a list of posts here */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
