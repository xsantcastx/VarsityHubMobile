import { StripeProvider as NativeStripeProvider } from '@stripe/stripe-react-native';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  merchantIdentifier?: string;
  publishableKey: string;
};

export function StripeProvider({ children, merchantIdentifier, publishableKey }: Props) {
  return (
    <NativeStripeProvider
      merchantIdentifier={merchantIdentifier}
      publishableKey={publishableKey}
    >
      <>{children}</>
    </NativeStripeProvider>
  );
}
