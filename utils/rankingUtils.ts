import { RankingType } from '../components/RankingBadge';

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
  const totalEngagement = upvotes + (comments * 2);
  const score = item._score || 0;

  // Determine ranking based on tab and position
  switch (currentTab) {
    case 'trending':
      // TRENDING TAB: NO badges shown (circles are handled separately in UI)
      break;

    case 'recent':
      // Very recent posts get live badge
      if (hoursSincePost < 1) {
        return { type: 'live', show: true };
      }
      // Recent trending posts
      if (daysSincePost < 1 && isNationalTop) {
        return { type: 'recent', show: true };
      }
      // Rising posts with good engagement in last 3 days
      if (daysSincePost < 3 && totalEngagement > 8) {
        return { type: 'rising', show: true };
      }
      // Hot posts in recent timeframe
      if (daysSincePost < 2 && totalEngagement > 20) {
        return { type: 'hot', show: true };
      }
      break;

    case 'top':
      // Top 10 posts ALL get trending badges with their position (#1-#10)
      if (index < 10) {
        return { type: 'trending', position: index + 1, show: true };
      }
      break;
      if (!isNationalTop && totalEngagement > 25) {
        return { type: 'hot', show: true };
      }
      break;
  }

  // Default: no badge
  return { type: 'trending', show: false };
};

// Calculate distance between two points in kilometers
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
