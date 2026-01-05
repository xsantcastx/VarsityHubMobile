/**
 * Profile-related type definitions
 */

export type UserRole = 'fan' | 'coach' | 'admin' | 'athlete' | 'staff';

export interface ProfilePreferences {
  role?: UserRole | null;
  plan?: string | null;
  position?: string | null;
  jersey_number?: string | number | null;
  grade_level?: string | null;
  graduation_year?: string | number | null;
  accolades?: string | null;
  primary_sport?: string | null;
  sport?: string | null;
  header_image_url?: string | null;
  header_image_focus_y?: number | null;
  location?: string | null;
  [key: string]: any;
}

export interface UserCounts {
  posts?: number;
  followers?: number;
  following?: number;
  [key: string]: any;
}

export interface User {
  id: string | number;
  username?: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  role?: UserRole | null;
  preferences?: ProfilePreferences | null;
  _count?: UserCounts;
  _isNotModified?: boolean; // Cache indicator
  [key: string]: any;
}

export interface PublicUser extends User {
  is_following?: boolean;
  is_blocked?: boolean;
}

export interface PostCounts {
  posts: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
}

export interface Post {
  id: string;
  media_url?: string | null;
  media_type?: 'image' | 'video';
  caption?: string | null;
  content?: string | null;
  upvotes_count: number;
  comments_count: number;
  bookmarks_count: number;
  created_at: string;
  author?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  _count?: {
    comments?: number;
    bookmarks?: number;
  };
}

export interface Interaction extends Post {
  // Interactions are posts with interaction metadata
  // Can be likes, comments, saves
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  counts?: PostCounts;
}

export interface FeedPost {
  id: string;
  media_url?: string | null;
  media_type: 'image' | 'video';
  caption?: string | null;
  upvotes_count: number;
  comments_count: number;
  bookmarks_count: number;
  created_at?: string | null;
  author?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  has_upvoted?: boolean;
  has_bookmarked?: boolean;
  is_following_author?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  display_name?: string;
  avatar_url?: string | null;
  [key: string]: any;
}

export type InteractionType = 'all' | 'like' | 'comment' | 'repost' | 'save';

export type SortOption = 'newest' | 'most_upvoted' | 'most_commented';

export type TabType = 'posts' | 'interactions';
