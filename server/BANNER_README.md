Client-side banner capture + upload

I added a React Native component `MatchBanner` and a wrapper `MatchBannerCapture` that can capture the banner to an image and upload it to the server.

Dependencies
- react-native-view-shot

Install:

  npm install react-native-view-shot
  # If you're using Expo managed workflow, use:
  expo install react-native-view-shot

Usage example (in a screen):

import MatchBannerCapture from '@/components/MatchBannerCapture';

<MatchBannerCapture
  leftImage={teamA.logo_url}
  rightImage={teamB.logo_url}
  leftName={teamA.name}
  rightName={teamB.name}
  onUploaded={(url) => console.log('Banner URL:', url)}
/>

Notes
- The component uses `uploadFile` helper which posts to `${base}/uploads` and expects the usual upload response `{ url, path }`.
- The default base URL logic matches other upload flows in the app (EXPO_PUBLIC_API_URL or localhost / 10.0.2.2).
- After upload, you can store the returned banner URL on a Game record (e.g. Game.update(id, { cover_image_url: bannerUrl })) to persist it.
