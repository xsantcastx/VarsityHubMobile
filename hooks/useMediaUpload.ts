/**
 * useMediaUpload - Shared hook for media (image/video) uploads
 * Wraps uploadFile(getApiBaseUrl(), uri, ...) with loading, error, and progress state.
 * Components should use this hook instead of calling uploadFile directly.
 */

import { uploadFileWithProgress, UploadProgressCallback } from '@/api/upload';
import { getApiBaseUrl } from '@/api/http';
import { useCallback, useState } from 'react';

export interface UseMediaUploadResult {
  /** Upload a file. Returns { url?, path?, signed_url? } on success */
  upload: (uri: string, filename?: string, mimeType?: string) => Promise<any>;
  /** Whether an upload is in progress */
  uploading: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Error message if last upload failed */
  error: string | null;
  /** Result from last successful upload */
  result: any | null;
  /** Reset state (clear error, result) */
  reset: () => void;
  /** Human-readable progress text (e.g. "45% (2.3 MB / 5.1 MB)") */
  progressText: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function useMediaUpload(): UseMediaUploadResult {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setLoaded(0);
    setTotal(0);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(async (
    uri: string,
    filename?: string,
    mimeType?: string
  ): Promise<any> => {
    setUploading(true);
    setProgress(0);
    setLoaded(0);
    setTotal(0);
    setError(null);
    setResult(null);

    const onProgress: UploadProgressCallback = (p, l, t) => {
      setProgress(p);
      setLoaded(l);
      setTotal(t);
    };

    try {
      const res = await uploadFileWithProgress(
        getApiBaseUrl(),
        uri,
        filename,
        mimeType,
        { onProgress, timeoutMs: 300000 }
      );
      setUploading(false);
      setProgress(100);
      setResult(res);
      setError(null);
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      setUploading(false);
      setError(msg);
      setResult(null);
      throw err;
    }
  }, []);

  const progressText =
    uploading || progress > 0
      ? total > 0
        ? `${progress}% (${formatBytes(loaded)} / ${formatBytes(total)})`
        : `${progress}%`
      : '';

  return {
    upload,
    uploading,
    progress,
    error,
    result,
    reset,
    progressText,
  };
}
