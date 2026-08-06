export type VenuePhotoFallback = { url: string; credit: string };

const CLIENT_VENUE_PHOTO_FALLBACKS: Record<string, VenuePhotoFallback> = {
  'carefirst arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Entertainment_and_Sports_Arena_Exterior.jpg',
    credit: 'Gregory Koch / Wikimedia Commons, CC BY-SA 4.0',
  },
  'entertainment and sports arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Entertainment_and_Sports_Arena_Exterior.jpg',
    credit: 'Gregory Koch / Wikimedia Commons, CC BY-SA 4.0',
  },
};

export function getVenuePhotoFallback(location?: string | null): VenuePhotoFallback | null {
  if (!location) return null;
  const venue = location.split(',')[0]?.trim().toLowerCase();
  if (!venue) return null;
  return CLIENT_VENUE_PHOTO_FALLBACKS[venue] ?? null;
}
