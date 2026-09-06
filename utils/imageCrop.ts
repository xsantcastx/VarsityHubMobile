export type CropTransform = { zoom: number; x: number; y: number };
export type CropSize = { width: number; height: number };

/** Cover the frame at every zoom level, clamping pan so no blank pixels escape. */
export function clampImageCrop(source: CropSize, frame: CropSize, value: CropTransform) {
  const zoom = Math.max(1, Math.min(5, value.zoom));
  const scale = Math.max(frame.width / source.width, frame.height / source.height) * zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const x = Math.max(-(width - frame.width) / 2, Math.min((width - frame.width) / 2, value.x));
  const y = Math.max(-(height - frame.height) / 2, Math.min((height - frame.height) / 2, value.y));
  return { zoom, x, y, width, height, scale };
}

/** Convert the visible frame back to original image pixels for full-resolution export. */
export function imageCropRect(source: CropSize, frame: CropSize, value: CropTransform) {
  const clamped = clampImageCrop(source, frame, value);
  const width = Math.min(source.width, Math.round(frame.width / clamped.scale));
  const height = Math.min(source.height, Math.round(frame.height / clamped.scale));
  return {
    originX: Math.max(
      0,
      Math.min(
        source.width - width,
        Math.round((clamped.width - frame.width - 2 * clamped.x) / (2 * clamped.scale))
      )
    ),
    originY: Math.max(
      0,
      Math.min(
        source.height - height,
        Math.round((clamped.height - frame.height - 2 * clamped.y) / (2 * clamped.scale))
      )
    ),
    width,
    height,
  };
}
