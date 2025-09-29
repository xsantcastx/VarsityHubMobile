import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Switch as RNSwitch, SwitchProps } from 'react-native';

export function Switch(props: SwitchProps) {
  const colorScheme = useColorScheme();
  
  return (
    <RNSwitch
      trackColor={{
        false: colorScheme === 'dark' ? Colors.dark.border : Colors.light.border,
        true: colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint,
      }}
      thumbColor={props.value ? (colorScheme === 'dark' ? '#FFFFFF' : '#FFFFFF') : (colorScheme === 'dark' ? '#9CA3AF' : '#F3F4F6')}
      ios_backgroundColor={colorScheme === 'dark' ? Colors.dark.border : Colors.light.border}
      {...props}
    />
  );
}

export default Switch;

