import { isAllowedMediaUrl } from './mediaHosts.js';
import { venuePhotoFor } from './proSchedule/venuePhotos.js';

/** Call only after the entity's public-visibility gate. Venue URLs come from
 * our reviewed catalog, never a user-supplied external URL. */
export function eventPreviewImage(record: {
  banner_url?: string | null;
  cover_image_url?: string | null;
  location?: string | null;
}): string | undefined {
  for (const url of [record.banner_url, record.cover_image_url]) {
    if (url && isAllowedMediaUrl(url)) return url;
  }
  return venuePhotoFor(record.location)?.url;
}
