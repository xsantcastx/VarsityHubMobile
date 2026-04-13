import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  merchantIdentifier?: string;
  publishableKey: string;
};

export function StripeProvider({ children }: Props) {
  return children;
}
