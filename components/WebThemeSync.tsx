import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function WebThemeSync() {
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const theme = Colors[colorScheme];
    const root = document.documentElement;
    const body = document.body;

    root.style.colorScheme = colorScheme;
    root.style.backgroundColor = theme.background;
    body.style.backgroundColor = theme.background;
    body.style.color = theme.text;
    body.style.margin = '0';
    body.style.minHeight = '100vh';

    const rootNode = document.getElementById('root');
    if (rootNode) {
      rootNode.style.minHeight = '100vh';
      rootNode.style.backgroundColor = theme.background;
      rootNode.style.color = theme.text;
    }
  }, [colorScheme]);

  return null;
}
