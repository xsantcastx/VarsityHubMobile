import { fireEvent, render, waitFor } from '@testing-library/react-native';
import QuickAddGameModal from '../QuickAddGameModal';

// Mock scaffold copied from the existing sibling test
// (components/__tests__/QuickAddGameModal.test.tsx) — required for this
// component to render in a test environment at all.
jest.mock('@/hooks/useTeamOptions', () => ({
  useTeamOptions: () => ({ teams: [{ id: 'team-1', name: 'My Team' }] }),
}));
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {},
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-view-shot', () => {
  const ViewShotMock = ({ children }: any) => children;
  return { __esModule: true, default: ViewShotMock, captureRef: jest.fn() };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const Mock = () => null;
  return Mock;
});
jest.mock('../AppearancePicker', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});
jest.mock('../ImageEditor', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});
jest.mock('../LocationPicker', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});
jest.mock('@/api/upload', () => ({
  uploadFile: jest.fn(),
}));
jest.mock('@/api/http', () => ({
  getApiBaseUrl: () => 'https://example.com',
}));
jest.mock('../../app/components/MatchBanner', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});

describe('QuickAddGameModal — manual opponent entry', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    currentTeamName: 'My Team',
    currentTeamId: 'team-1',
  };

  it('shows a pinned "Enter opponent manually" row under the search bar before typing anything', async () => {
    const { getByText, findByText } = render(<QuickAddGameModal {...baseProps} />);

    fireEvent.press(getByText('Select opponent team'));

    expect(await findByText(/enter opponent manually/i)).toBeTruthy();
  });

  it('switches to a manual name field when the pinned row is tapped, and confirming it sets the opponent with no team id', async () => {
    const { getByText, findByText, findByPlaceholderText, getByLabelText } = render(
      <QuickAddGameModal {...baseProps} />
    );

    fireEvent.press(getByText('Select opponent team'));
    fireEvent.press(await findByText(/enter opponent manually/i));

    const manualInput = await findByPlaceholderText(/opponent name/i);
    fireEvent.changeText(manualInput, 'Central High Eagles');
    // Two "Add" buttons exist in the tree (the modal's own submit button plus
    // this manual-entry confirm button), so disambiguate via accessibility
    // label rather than the ambiguous visible text.
    fireEvent.press(getByLabelText('Confirm manual opponent'));

    await waitFor(() => {
      expect(getByText('Central High Eagles')).toBeTruthy();
    });
  });
});
