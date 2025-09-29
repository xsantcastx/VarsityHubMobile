declare module 'react-native-view-shot' {
  import { Ref } from 'react';
    import { View } from 'react-native';
  export function captureRef(viewRef: Ref<View> | number | View | null, options?: any): Promise<string>;
}

declare module 'expo-media-library' {
  export type PermissionResponse = { status: 'granted' | 'denied' | 'undetermined' };
  export function requestPermissionsAsync(): Promise<PermissionResponse>;
  export function saveToLibraryAsync(uri: string): Promise<any>;
}
