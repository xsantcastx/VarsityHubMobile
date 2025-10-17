import { Colors } from '@/constants/Colors';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Radius, Spacing, Type } from './tokens';

type Option = { value: string; label: string };
type Props = { value?: string; options: Option[]; onChange: (v: string) => void };

export default function Segmented({ value, options, onChange }: Props) {
  const colorScheme = useColorScheme();
  
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              {
                flex: 1,
                borderWidth: 1,
                borderColor: on ? Colors[colorScheme].tint : Colors[colorScheme].border,
                borderRadius: Radius.md,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: on 
                  ? (colorScheme === 'dark' ? 'rgba(56,189,248,0.1)' : '#EFF6FF')
                  : Colors[colorScheme].surface,
              }
            ]}
          >
            <Text style={[
              Type.body, 
              { color: on ? Colors[colorScheme].tint : Colors[colorScheme].text }
            ]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: Spacing.sm },
});

