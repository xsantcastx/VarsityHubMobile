/**
 * Empty shim for react-native-maps on web
 * Maps are not supported on web platform
 */

const emptyComponent = () => null;

export default emptyComponent;
export const MapView = emptyComponent;
export const Marker = emptyComponent;
export const Circle = emptyComponent;
export const Polyline = emptyComponent;
export const Polygon = emptyComponent;
export const Callout = emptyComponent;
export const Overlay = emptyComponent;

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';
