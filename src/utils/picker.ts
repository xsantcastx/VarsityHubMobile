import * as ImagePicker from 'expo-image-picker';

// Build version-safe props for image-only selection
export function pickerMediaTypesProp() {
  const anyIP = ImagePicker as any;
  if (anyIP?.MediaType) {
    return { mediaTypes: [anyIP.MediaType.Images] } as any;
  }
  return { mediaTypes: (ImagePicker as any).MediaTypeOptions?.Images || (ImagePicker as any).MediaType?.Images } as any;
}

// Build version-safe props for a specific media type: 'image' | 'video'
export function pickerMediaTypeFor(media: 'image' | 'video') {
  const anyIP = ImagePicker as any;
  if (anyIP?.MediaType) {
    return { mediaTypes: [media === 'image' ? anyIP.MediaType.Images : anyIP.MediaType.Videos] } as any;
  }
  const mto = (ImagePicker as any).MediaTypeOptions;
  return { mediaTypes: media === 'image' ? mto?.Images : mto?.Videos } as any;
}

