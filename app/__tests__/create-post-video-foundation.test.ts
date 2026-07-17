import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'app', '(tabs)', 'create-post.tsx'), 'utf8');

describe('create-post video upload foundation', () => {
  it('prepares the final video once at upload time', () => {
    expect(source).toMatch(/prepareVideoForUpload\(sourceUri[,)]/);
    // Exactly one prepare pass — the point of the helper is that we compress at
    // the upload boundary and nowhere else.
    expect(source.match(/prepareVideoForUpload\(/g)).toHaveLength(1);
  });

  it('reports compression progress instead of sitting on a frozen 0% bar', () => {
    expect(source).toContain('onCompressProgress');
  });

  it('keeps web on the same upload path without mounting the native trimmer', () => {
    expect(source).toContain('const canTrimVideo = isNativeVideoTrimSupported(Platform.OS);');
    expect(source).toContain('Web uploads the selected video as-is.');
  });

  it('does not upload a separate thumbnail asset for video posts', () => {
    expect(source).not.toContain(
      "uploadFile(base, videoThumbnailUri, 'thumbnail.jpg', 'image/jpeg')"
    );
    expect(source).not.toContain('videoThumbnailUri');
    expect(source).not.toContain('finalThumbnailUrl');
  });
});
