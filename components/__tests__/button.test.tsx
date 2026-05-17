import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('applies default variant text color to nested Text children', () => {
    const { getByText } = render(
      <Button>
        <Text style={{ fontSize: 18 }}>Upgrade to Veteran</Text>
      </Button>
    );

    expect(getByText('Upgrade to Veteran')).toHaveStyle({
      color: Colors.light.background,
      fontSize: 18,
      fontWeight: '600',
    });
  });

  it('applies outline variant text color to nested Text children', () => {
    const { getByText } = render(
      <Button variant="outline">
        <Text>Billing History</Text>
      </Button>
    );

    expect(getByText('Billing History')).toHaveStyle({
      color: Colors.light.text,
      fontWeight: '600',
    });
  });
});
