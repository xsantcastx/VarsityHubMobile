import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync } from 'expo-image-manipulator';
import { uploadFile } from '@/api/upload';
import EventPreviewImageField from '../EventPreviewImageField';
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('@/api/upload', () => ({ uploadFile: jest.fn() }));
jest.mock('@/api/http', () => ({ getApiBaseUrl: () => 'https://example.test' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  default: 'ViewShot',
  captureRef: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: {},
}));
jest.mock('@/utils/materializeICloudAsset', () => ({
  materializeICloudAssetIfNeeded: async (uri: string) => uri,
}));
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
    success(1600, 900);
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (manipulateAsync as jest.Mock).mockResolvedValue({
    uri: 'file:///cropped.jpg',
    width: 1200,
    height: 675,
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', platformDescriptor);
});
it('repositions an existing banner and uploads the full-resolution crop before reporting the new URL', async () => {
  const onChange = jest.fn(),
    onUploadingChange = jest.fn();
  (uploadFile as jest.Mock).mockResolvedValue({ url: 'https://example.test/cropped.jpg' });
  const screen = render(
    <EventPreviewImageField
      value="https://example.test/original.jpg"
      onChange={onChange}
      onUploadingChange={onUploadingChange}
    />
  );
  fireEvent.press(screen.getByLabelText('Edit banner crop'));
  fireEvent.press(screen.getByText('Zoom in'));
  fireEvent.press(screen.getByLabelText('Save banner crop'));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://example.test/cropped.jpg'));
  expect(manipulateAsync).toHaveBeenCalledWith(
    'https://example.test/original.jpg',
    [
      { crop: { originX: 160, originY: 90, width: 1280, height: 720 } },
      { resize: { width: 1200 } },
    ],
    { compress: 0.9, format: 'jpeg' }
  );
  expect(uploadFile).toHaveBeenCalledWith(
    'https://example.test',
    'file:///cropped.jpg',
    'event-preview.jpg',
    'image/jpeg'
  );
  expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  expect(screen.queryByText('Fit Event Banner')).toBeNull();
});
it('keeps the crop open and previous banner intact when upload fails', async () => {
  const onChange = jest.fn();
  (uploadFile as jest.Mock).mockRejectedValue(new Error('Upload unavailable'));
  const screen = render(
    <EventPreviewImageField value="https://example.test/original.jpg" onChange={onChange} />
  );
  fireEvent.press(screen.getByLabelText('Edit banner crop'));
  fireEvent.press(screen.getByLabelText('Save banner crop'));
  await waitFor(() => expect(screen.getAllByText('Upload unavailable').length).toBeGreaterThan(0));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText('Fit Event Banner')).toBeTruthy();
});

it('opens the browser picker directly and enters the crop editor without a native action alert', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picked.jpg' }],
  });
  const screen = render(<EventPreviewImageField onChange={jest.fn()} />);
  fireEvent.press(screen.getByText('Add Preview Photo'));
  await waitFor(() => expect(screen.getByText('Fit Event Banner')).toBeTruthy());
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsEditing: false })
  );
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});
it('shows a visible browser picker failure with the photo button available for retry', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockRejectedValue(
    new Error('Photo picker unavailable')
  );
  const screen = render(<EventPreviewImageField onChange={jest.fn()} />);
  fireEvent.press(screen.getByText('Add Preview Photo'));
  await waitFor(() => expect(screen.getByText('Photo picker unavailable')).toBeTruthy());
  expect(screen.getByText('Add Preview Photo')).toBeTruthy();
});
