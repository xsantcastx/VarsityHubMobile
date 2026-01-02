// PinPointIcon.tsx
import { Image, StyleSheet } from 'react-native';

export default function PinPointIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={{ uri: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1767322916/1000_F_280874872_tVNxGcKAMB3s1rVuNtcB8MeloTb0PV28_u011cc.jpg' }}
      style={[styles.icon, { width: size, height: size }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    tintColor: undefined, // Use original color
  },
});
