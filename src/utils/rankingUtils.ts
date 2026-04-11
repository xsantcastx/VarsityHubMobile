import { RankingType } from '@/components/RankingBadge';

export interface HighlightItem {
  id: string;
  title?: string;
  caption?: string;
  content?: string;
  media_url?: string;
  upvotes_count?: number;
  created_at: string;
  author_id: string;
  author?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  has_upvoted?: boolean;
  lat?: number;
  lng?: number;
  country_code?: string;
  sport?: string;
  _count?: {
    comments: number;
  };
  _score?: number;
}

export interface RankingInfo {
  type: RankingType;
  position?: number;
  show: boolean;
}

export const calculateRanking = (
  item: HighlightItem,
  index: number,
  currentTab: string,
  nationalTop: HighlightItem[],
  ranked: HighlightItem[],
  userLocation?: { lat: number; lng: number }
): RankingInfo => {
  const now = new Date();
  const postDate = new Date(item.created_at);
  const hoursSincePost = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
  const daysSincePost = hoursSincePost / 24;

  // Check if item is in nationalTop array
  const nationalTopIndex = nationalTop.findIndex(p => p.id === item.id);
  const isNationalTop = nationalTopIndex !== -1;

  // Check if item is in ranked array
  const rankedIndex = ranked.findIndex(p => p.id === item.id);
  const isRanked = rankedIndex !== -1;

  // Calculate engagement metrics
  const upvotes = item.upvotes_count || 0;
  const comments = item._count?.comments || 0;
  const totalEngagement = upvotes + comments * 2;
  const score = item._score || 0;

  // Simplified ranking: each tab shows its own badge type
  // Position numbers are handled separately in the UI (yellow circle badges)
  switch (currentTab) {
    case 'trending':
      // All posts in Trending tab show "TRENDING" badge
      // Top 3 also get numbered yellow badges (#1, #2, #3) - handled in UI
      return { type: 'trending', show: true };

    case 'recent':
      // All posts in Recent tab show "RECENT" badge
      // No numbered badges - this is pure chronological feed
      return { type: 'recent', show: true };

    case 'top':
      // All posts in Top tab show "TOP" badge
      // Top 10 also get numbered yellow badges (#1-#10) - handled in UI
      return { type: 'top', show: true };
  }

  // Default: no badge (shouldn't reach here)
  return { type: 'trending', show: false };
};

// Calculate distance between two points in kilometers
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const shouldShowBadge = (
  item: HighlightItem,
  index: number,
  currentTab: string,
  nationalTop: HighlightItem[],
  ranked: HighlightItem[],
  userLocation?: { lat: number; lng: number }
): boolean => {
  const ranking = calculateRanking(item, index, currentTab, nationalTop, ranked, userLocation);
  return ranking.show;
};
