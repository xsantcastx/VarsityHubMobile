import { fireEvent, render } from '@testing-library/react-native';
import SportFilterBar from '../SportFilterBar';

describe('SportFilterBar', () => {
  it('renders a single filter button that opens a picker of the present sports', () => {
    const { getByLabelText, queryByLabelText } = render(
      <SportFilterBar sports={['football', 'basketball']} selected={null} onSelect={() => {}} />
    );
    // One button, not a chip per sport. Options are hidden until it's opened.
    const button = getByLabelText(/Filter by sport/);
    expect(button).toBeTruthy();
    expect(queryByLabelText('Filter by Football')).toBeNull();

    fireEvent.press(button);
    expect(getByLabelText('Filter by Football')).toBeTruthy();
    expect(getByLabelText('Filter by Basketball')).toBeTruthy();
    expect(getByLabelText('Filter by All Sports')).toBeTruthy();
  });

  it('renders nothing when fewer than 2 sports are present (a 1-option filter is noise)', () => {
    const { toJSON } = render(
      <SportFilterBar sports={['football']} selected={null} onSelect={() => {}} />
    );
    expect(toJSON()).toBeNull();
  });

  it('selects a sport from the picker, and "All Sports" clears the filter', () => {
    const onSelect = jest.fn();
    const { getByLabelText, rerender } = render(
      <SportFilterBar sports={['football', 'basketball']} selected={null} onSelect={onSelect} />
    );
    fireEvent.press(getByLabelText(/Filter by sport/));
    fireEvent.press(getByLabelText('Filter by Basketball'));
    expect(onSelect).toHaveBeenCalledWith('basketball');

    rerender(
      <SportFilterBar
        sports={['football', 'basketball']}
        selected={'basketball'}
        onSelect={onSelect}
      />
    );
    fireEvent.press(getByLabelText(/Filter by sport/));
    fireEvent.press(getByLabelText('Filter by All Sports'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
