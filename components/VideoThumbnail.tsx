import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { optimizeImageUrl } from '@/utils/imageUrl';

// Native module, guarded per the OTA rule in CLAUDE.md: a binary built before
// this module was added must not crash on require.
let VideoThumbnails: any = null;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch {
  VideoThumbnails = null;
}

type VideoThumbnailProps = {
  /** The video URL. Only used to extract a frame when `posterUrl` is absent. */
  videoUrl?: string | null;
  /** Server-resolved poster (`preview_url` / `thumbnail_url`). Always preferred. */
  posterUrl?: string | null;
  /** Geometry only — this component owns its own background and scrim. */
  style?: StyleProp<ViewStyle>;
  /** Longest edge to request from the image CDN for `posterUrl`. */
  width?: number;
  playIconSize?: number;
};

/**
 * Poster for a video tile.
 *
 * Server-side poster derivation only works for Cloudinary-hosted video (a URL
 * transform synthesizes the frame). R2 — where all media has lived since the
 * 2026-07-13 migration — cannot do that, and Story rows carry no poster_url
 * column at all, so video stories have no server poster and the rail rendered a
 * bare dark tile with a play button. Grab the first frame locally instead; this
 * is the same fallback the Highlights tab already uses, which is why previews
 * work there and nowhere else.
 *
 * Prefers `posterUrl` whenever the server has one — local extraction costs a
 * range request against the video, so it is strictly the fallback.
 */
export default function VideoThumbnail({
  videoUrl,
  posterUrl,
  style,
  width = 500,
  playIconSize = 32,
}: VideoThumbnailProps) {
  const [derivedUri, setDerivedUri] = useState<string | null>(null);

  useEffect(() => {
    // A server poster wins — never pay for local extraction when one exists.
    if (posterUrl || !videoUrl || !VideoThumbnails?.getThumbnailAsync) return;

    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000 })
      .then((result: any) => {
        if (!cancelled && result?.uri) setDerivedUri(result.uri);
      })
      .catch(() => {
        // Unreachable/undecodable video — the play-glyph placeholder stands in.
      });
    return () => {
      cancelled = true;
    };
  }, [videoUrl, posterUrl]);

  const uri = posterUrl ? optimizeImageUrl(posterUrl, width) : derivedUri;

  return (
    <View style={[styles.tile, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {/* Scrim behind the glyph so it stays legible over a bright frame. */}
        <View
          style={[
            styles.playScrim,
            {
              width: playIconSize * 1.7,
              height: playIconSize * 1.7,
              borderRadius: playIconSize,
            },
          ]}
        >
          <Ionicons name="play" size={playIconSize} color="#fff" style={styles.playGlyph} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // audit: dark base is the letterbox behind a video frame, not text.
  tile: { overflow: 'hidden', backgroundColor: '#0f172a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  playScrim: {
    backgroundColor: 'rgba(2,6,23,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { marginLeft: 2 },
});
