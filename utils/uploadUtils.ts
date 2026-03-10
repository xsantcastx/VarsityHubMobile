/**
 * File upload utilities for VarsityHub mobile app
 */

import { Platform } from 'react-native';
import auth from '../api/auth';
import { getApiBaseUrl } from '../api/http';

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
  isMedia: boolean = false
): Promise<UploadResponse> {
  try {
    if (__DEV__) console.log('Starting upload:', { name: file.name, uri: file.uri, type: file.type });

    const token = await auth.getToken();
    if (!token) {
      throw new Error('Unauthorized — please sign in to upload files.');
    }

    const formData = new FormData();

    // Create the file object for FormData
    const fileObj = {
      uri: file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name,
    } as any;

    formData.append('file', fileObj);

    // Choose endpoint based on file type
    const serverUrl = getApiBaseUrl();
    const endpoint = isMedia ? '/uploads' : '/uploads/files';
    const url = `${serverUrl}${endpoint}`;

    if (__DEV__) console.log('Uploading to:', url);

    // Important: do NOT set the Content-Type header for FormData in React Native
    // The runtime must set the boundary for multipart/form-data automatically.
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    
    if (__DEV__) console.log('Upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      if (__DEV__) console.error('Upload failed with status:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    const result: UploadResponse = await response.json();
    if (__DEV__) console.log('Upload successful:', result);
    return result;
  } catch (error) {
    if (__DEV__) console.error('Upload error:', error);
    // Provide more detailed error information
    if (error instanceof TypeError && error.message === 'Network request failed') {
      throw new Error('Network error: Cannot connect to server. Please check your internet connection and server status.');
    }
    throw error;
  }
}

/**
 * Upload an image file
 * @param file - Image file to upload
 * @returns Promise with upload response
 */
export async function uploadImage(file: FileToUpload): Promise<UploadResponse> {
  return uploadFile(file, true);
}

/**
 * Upload a document/general file
 * @param file - Document file to upload
 * @returns Promise with upload response
 */
export async function uploadDocument(file: FileToUpload): Promise<UploadResponse> {
  return uploadFile(file, false);
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