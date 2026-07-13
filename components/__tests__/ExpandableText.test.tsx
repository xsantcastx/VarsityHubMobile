import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ExpandableText from '@/components/ExpandableText';

const layoutWithLines = (n: number) => ({
  nativeEvent: { lines: Array.from({ length: n }, (_, i) => ({ text: `line ${i}` })) },
});

describe('ExpandableText', () => {
  it('shows no toggle when the text fits within the line limit', () => {
    const screen = render(<ExpandableText text="short text" maxLines={3} />);
    fireEvent(screen.getByText('short text'), 'textLayout', layoutWithLines(2));
    expect(screen.queryByText('⬇️ Read more')).toBeNull();
  });

  it('clamps overflowing text and reveals it via Read more / Show less', () => {
    const screen = render(<ExpandableText text="long text" maxLines={3} />);
    const text = screen.getByText('long text');

    // Overflows: 5 laid-out lines > 3 allowed → clamped + toggle visible.
    fireEvent(text, 'textLayout', layoutWithLines(5));
    expect(screen.getByText('long text').props.numberOfLines).toBe(3);

    fireEvent.press(screen.getByText('⬇️ Read more'));
    expect(screen.getByText('long text').props.numberOfLines).toBeUndefined();

    fireEvent.press(screen.getByText('⬆️ Show less'));
    expect(screen.getByText('long text').props.numberOfLines).toBe(3);
  });

  it('renders nothing for empty text', () => {
    const screen = render(<ExpandableText text="" maxLines={3} />);
    expect(screen.toJSON()).toBeNull();
  });
});
