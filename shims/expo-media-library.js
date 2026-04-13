// Web shim for expo-media-library (native-only)
// Media library access is not available on web.
const noop = () => Promise.resolve(null);

module.exports = {
  requestPermissionsAsync: () => Promise.resolve({ status: 'denied', granted: false }),
  getPermissionsAsync: () => Promise.resolve({ status: 'denied', granted: false }),
  saveToLibraryAsync: noop,
  createAssetAsync: noop,
  getAssetsAsync: () => Promise.resolve({ assets: [], endCursor: '', hasNextPage: false, totalCount: 0 }),
  getAlbumsAsync: () => Promise.resolve([]),
  MediaType: { photo: 'photo', video: 'video', audio: 'audio', unknown: 'unknown' },
  SortBy: { default: 'default', creationTime: 'creationTime', modificationTime: 'modificationTime' },
  PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
};
