import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  default: {},
  getInfoAsync: jest.fn(),
}));

jest.mock('react-native-compressor', () => ({
  Video: {
    compress: jest.fn(),
  },
}));

jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'react-native-compressor';

import { captureException } from '@/utils/sentry';

import {
  compressVideoSafe,
  prepareVideoForUpload,
  VIDEO_COMPRESSION_THRESHOLD_MB,
} from '../compressVideo';

const getInfoAsyncMock = FileSystem.getInfoAsync as jest.MockedFunction<
  typeof FileSystem.getInfoAsync
>;
const compressMock = Video.compress as jest.MockedFunction<typeof Video.compress>;
const captureExceptionSpy = captureException as jest.MockedFunction<typeof captureException>;

describe('prepareVideoForUpload', () => {
  beforeEach(() => {
    getInfoAsyncMock.mockReset();
    compressMock.mockReset();
  });

  it('skips compression for already-small clips', async () => {
    getInfoAsyncMock.mockResolvedValue({ exists: true, size: 2 * 1024 * 1024 } as any);

    const result = await prepareVideoForUpload('file:///clip.mp4');

    expect(result.uri).toBe('file:///clip.mp4');
    expect(result.wasCompressed).toBe(false);
    expect(compressMock).not.toHaveBeenCalled();
  });

  it('compresses larger clips once at the upload boundary', async () => {
    getInfoAsyncMock.mockImplementation(async (uri: string) => {
      if (uri === 'file:///compressed.mp4') {
        return { exists: true, size: 5 * 1024 * 1024 } as any;
      }
      return { exists: true, size: 24 * 1024 * 1024 } as any;
    });
    compressMock.mockResolvedValue('file:///compressed.mp4' as any);

    const result = await prepareVideoForUpload('file:///clip.mp4');

    expect(compressMock).toHaveBeenCalledWith('file:///clip.mp4', {
      compressionMethod: 'auto',
      minimumFileSizeForCompress: 1,
    });
    expect(result).toMatchObject({
      uri: 'file:///compressed.mp4',
      wasCompressed: true,
      originalSizeBytes: 24 * 1024 * 1024,
      finalSizeBytes: 5 * 1024 * 1024,
    });
  });

  it('exports the documented threshold constant', () => {
    expect(VIDEO_COMPRESSION_THRESHOLD_MB).toBe(8);
  });
});

describe('compression hardening', () => {
  beforeEach(() => {
    getInfoAsyncMock.mockReset();
    compressMock.mockReset();
    captureExceptionSpy.mockReset();
  });

  it('keeps the ORIGINAL uri when compression produces a larger file', async () => {
    // Original 20MB, "compressed" output is 25MB — re-encoding made it worse.
    getInfoAsyncMock.mockImplementation(async (uri: string) => {
      if (uri === 'file:///video-compressed.mp4') {
        return { exists: true, size: 25 * 1024 * 1024 } as any;
      }
      return { exists: true, size: 20 * 1024 * 1024 } as any;
    });
    compressMock.mockResolvedValue('file:///video-compressed.mp4' as any);

    const result = await prepareVideoForUpload('file:///video.mp4');

    expect(result.uri).toBe('file:///video.mp4');
    expect(result.wasCompressed).toBe(false);
    expect(result.finalSizeBytes).toBe(20 * 1024 * 1024);
  });

  it('throws VIDEO_TOO_LARGE when the final asset exceeds MAX_VIDEO_SIZE_BYTES', async () => {
    // Original 200MB, compressed 180MB — both over the 150MB cap.
    getInfoAsyncMock.mockImplementation(async (uri: string) => {
      if (uri === 'file:///huge-compressed.mp4') {
        return { exists: true, size: 180 * 1024 * 1024 } as any;
      }
      return { exists: true, size: 200 * 1024 * 1024 } as any;
    });
    compressMock.mockResolvedValue('file:///huge-compressed.mp4' as any);

    await expect(prepareVideoForUpload('file:///huge.mp4')).rejects.toMatchObject({
      code: 'VIDEO_TOO_LARGE',
    });
  });

  it('reports the module-missing fallback to Sentry exactly once per session', async () => {
    // Simulate a binary built before react-native-compressor was added: the
    // module-level require throws. Reset the module registry and re-mock so
    // the module-level `reportedModuleMissing` flag starts fresh, then
    // require a brand-new instance of compressVideo.
    jest.resetModules();
    jest.doMock('react-native-compressor', () => {
      throw new Error("Cannot find native module 'RNCompressor'");
    });
    const freshCaptureException = jest.fn();
    jest.doMock('@/utils/sentry', () => ({ captureException: freshCaptureException }));
    jest.doMock('expo-file-system/legacy', () => ({
      __esModule: true,
      default: {},
      getInfoAsync: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freshModule = require('../compressVideo') as typeof import('../compressVideo');

    const a = await freshModule.compressVideoSafe('file:///a.mp4');
    const b = await freshModule.compressVideoSafe('file:///b.mp4');

    expect(a).toBe('file:///a.mp4');
    expect(b).toBe('file:///b.mp4');
    expect(freshCaptureException).toHaveBeenCalledTimes(1);
    const [, context] = freshCaptureException.mock.calls[0] as [
      unknown,
      { tags: { stage: string } },
    ];
    expect(context.tags.stage).toBe('module_missing');

    // Restore the shared registry/mocks so later test files aren't affected.
    jest.resetModules();
    jest.dontMock('react-native-compressor');
    jest.dontMock('@/utils/sentry');
    jest.dontMock('expo-file-system/legacy');
  });
});
