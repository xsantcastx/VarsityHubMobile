import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockUnreadCount = jest.fn();
const mockList = jest.fn();
jest.mock('@/api/entities', () => ({
  Message: {
    unreadCount: (...args: any[]) => mockUnreadCount(...args),
    list: (...args: any[]) => mockList(...args),
  },
}));

jest.mock('@/components/ui/IconSymbol', () => ({
  IconSymbol: () => null,
}));

import MessagesTabIcon from '@/components/ui/MessagesTabIcon';

describe('MessagesTabIcon unread badge', () => {
  beforeEach(() => {
    mockUnreadCount.mockReset();
    mockList.mockReset();
  });

  it('renders the badge from the unread-count endpoint, not the full message list', async () => {
    mockUnreadCount.mockResolvedValue({ count: 3 });

    const { getByText } = render(<MessagesTabIcon color="#fff" />);

    await waitFor(() => {
      expect(getByText('3')).toBeTruthy();
    });
    expect(mockUnreadCount).toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('caps the badge at 9+', async () => {
    mockUnreadCount.mockResolvedValue({ count: 12 });

    const { getByText } = render(<MessagesTabIcon color="#fff" />);

    await waitFor(() => {
      expect(getByText('9+')).toBeTruthy();
    });
  });

  it('shows no badge when there are no unread messages', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });

    const { queryByText } = render(<MessagesTabIcon color="#fff" />);

    await waitFor(() => {
      expect(mockUnreadCount).toHaveBeenCalled();
    });
    expect(queryByText('0')).toBeNull();
  });
});
