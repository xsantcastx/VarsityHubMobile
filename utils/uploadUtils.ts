/**
 * File upload utilities for VarsityHub mobile app
 */

import { uploadFile as uploadWithAuth, UploadOptions } from '../apiclient/upload';
import { getApiBaseUrl } from '../apiclient/http';

export interface UploadResponse {
  url: string;
  path: string;
  type: string;
  mime: string;
  size: number;
  originalName?: string;
}

export interface FileToUpload {
  uri: string;
  name: string;
  type?: string;
  size?: number;
}

/**
 * Upload a file to the server
 * @param file - File to upload
 * @param isMedia - Whether the file is media (image/video) or general file
 * @returns Promise with upload response
 */
export async function uploadFile(
  file: FileToUpload,
  _isMedia: boolean = false,
  options?: UploadOptions
): Promise<UploadResponse> {
  try {
    if (__DEV__)
      console.log('Starting upload:', { name: file.name, uri: file.uri, type: file.type });
    const uploadType = file.type || 'application/octet-stream';
    const result = await uploadWithAuth(getApiBaseUrl(), file.uri, file.name, uploadType, options);
    const normalized: UploadResponse = {
      url: String(result?.url || ''),
      path: typeof result?.path === 'string' ? result.path : String(result?.url || ''),
      type:
        typeof result?.type === 'string' && result.type.length > 0
          ? result.type
          : _isMedia
            ? 'image'
            : getFileTypeFromMime(uploadType),
      mime: typeof result?.mime === 'string' && result.mime.length > 0 ? result.mime : uploadType,
      size: typeof result?.size === 'number' ? result.size : file.size || 0,
      originalName:
        typeof result?.originalName === 'string' && result.originalName.length > 0
          ? result.originalName
          : file.name,
    };
    if (__DEV__) console.log('Upload successful:', normalized);
    return normalized;
  } catch (error) {
    if (__DEV__) console.error('Upload error:', error);
    // Provide more detailed error information
    if (error instanceof TypeError && error.message === 'Network request failed') {
      throw new Error(
        'Network error: Cannot connect to server. Please check your internet connection and server status.'
      );
    }
    throw error;
  }
}

/**
 * Upload an image file
 * @param file - Image file to upload
 * @returns Promise with upload response
 */
export async function uploadImage(
  file: FileToUpload,
  options?: UploadOptions
): Promise<UploadResponse> {
  return uploadFile(file, true, options);
}

/**
 * Upload a document/general file
 * @param file - Document file to upload
 * @returns Promise with upload response
 */
export async function uploadDocument(
  file: FileToUpload,
  options?: UploadOptions
): Promise<UploadResponse> {
  return uploadFile(file, false, options);
}

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file type from MIME type
 * @param mimeType - MIME type string
 * @returns File type category
 */
export function getFileTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
  return 'document';
}
