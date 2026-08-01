import { fireEvent, render } from '@testing-library/react-native';
import SportFilterBar from '../SportFilterBar';

describe('SportFilterBar', () => {
  it('renders a chip for each present sport when there are 2+', () => {
    const { getByLabelText } = render(
      <SportFilterBar sports={['football', 'basketball']} selected={null} onSelect={() => {}} />
    );
    expect(getByLabelText('Filter by Football')).toBeTruthy();
    expect(getByLabelText('Filter by Basketball')).toBeTruthy();
  });

  it('renders nothing when fewer than 2 sports are present (a 1-option filter is noise)', () => {
    const { toJSON } = render(
      <SportFilterBar sports={['football']} selected={null} onSelect={() => {}} />
    );
    expect(toJSON()).toBeNull();
  });

  it('filters on tap and clears when the active chip is tapped again', () => {
    const onSelect = jest.fn();
    const { getByLabelText, rerender } = render(
      <SportFilterBar sports={['football', 'basketball']} selected={null} onSelect={onSelect} />
    );
    fireEvent.press(getByLabelText('Filter by Basketball'));
    expect(onSelect).toHaveBeenCalledWith('basketball');

    rerender(
      <SportFilterBar
        sports={['football', 'basketball']}
        selected={'basketball'}
        onSelect={onSelect}
      />
    );
    fireEvent.press(getByLabelText('Filter by Basketball'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
