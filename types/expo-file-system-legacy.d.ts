declare module 'expo-file-system/legacy' {
  export * from 'expo-file-system/build/legacy/FileSystem';
  export * from 'expo-file-system/build/legacy/FileSystem.types';

  export const FileSystemUploadType: {
    readonly BINARY_CONTENT: 0;
    readonly MULTIPART: 1;
  };

  export function createUploadTask(
    url: string,
    fileUri: string,
    options?: Record<string, unknown>,
    callback?: (data: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void
  ): {
    uploadAsync(): Promise<{ body: string; headers: Record<string, string>; mimeType: string | null; status: number } | null | undefined>;
    cancelAsync(): Promise<void>;
  };
}
