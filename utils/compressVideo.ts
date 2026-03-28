/**
 * Safe video compression wrapper.
 *
 * Uses react-native-compressor when the native module is available (i.e. in a
 * build that includes it).  Falls back to the original URI silently so the app
 * never crashes on binaries that predate the module.
 *
 * iOS also benefits from ImagePicker's videoExportPreset at the picker level,
 * so even without the compressor the file is transcoded by the OS.
 */
export async function compressVideoSafe(uri: string): Promise<string> {
  try {
    // Dynamic require so Metro can resolve the module at build time without
    // crashing at runtime when the native module isn't present in the binary.
    const { Video } = require('react-native-compressor');
    const compressed: string = await Video.compress(uri, {
      compressionMethod: 'auto',      // picks the best available codec
      minimumFileSizeForCompress: 1,  // compress any video (value is in MB)
    });
    return compressed ?? uri;
  } catch {
    // Native module not present, or compression failed — use original
    return uri;
  }
}
