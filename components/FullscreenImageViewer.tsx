import { optimizeImageUrl } from '@/utils/imageUrl';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Fullscreen, pinch-to-zoom image preview. Encapsulates the same proven
 * gesture setup used inline in post-detail (max 2.5x, snap-back below 1.05x)
 * so any surface with a tappable image — game/event banners, etc. — gets a
 * consistent viewer. Reanimated + gesture-handler are foundation modules
 * already in the shipped binary, so this ships via OTA.
 */
export default function FullscreenImageViewer({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const reset = () => {
    scale.value = 1;
    savedScale.value = 1;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      // Reduced sensitivity: max 2.5x zoom, no sub-1x shrink
      scale.value = Math.max(1, Math.min(2.5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={handleClose}>
      <View style={styles.container}>
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
        >
          <Ionicons name="close" size={32} color="#fff" />
        </Pressable>
        {uri ? (
          <GestureDetector gesture={pinch}>
            <Animated.View style={[styles.imageWrapper, animatedStyle]}>
              <ExpoImage
                source={{
                  uri: optimizeImageUrl(uri, Math.max(1400, Math.round(SCREEN_WIDTH * 2))) || uri,
                }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={150}
              />
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
});
