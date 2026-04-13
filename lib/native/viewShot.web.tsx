import type { ReactNode } from 'react';
import { View } from 'react-native';

type ViewShotProps = {
  children?: ReactNode;
  style?: any;
};

export async function captureRef(): Promise<never> {
  throw new Error('View capture is not available on web.');
}

export default function ViewShot({ children, style }: ViewShotProps) {
  return <View style={style}>{children}</View>;
}
