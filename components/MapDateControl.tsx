import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Apple-spring press feedback (react-native-design): critically damped, no
// overshoot; feedback lands on press-IN.
const PRESS_IN = { duration: 120, dampingRatio: 1 };
const PRESS_OUT = { duration: 400, dampingRatio: 1 };

interface MapDateControlProps {
  /** The day currently being browsed, or null for the live (today/upcoming) map. */
  value: Date | null;
  /** Fires with a normalized local-midnight Date, or null to return to live. */
  onChange: (date: Date | null) => void;
}

// Normalize any Date to local midnight so the day the user tapped is the day we
// query — never shifted by a UTC offset. Mirrors DateField's handling.
function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The map's single-day date lens. Null = the live map (today/upcoming, the
 * default). Picking a past day surfaces that day's events/games — the way back
 * to an event a user attended so they can post a recap while it is still inside
 * its 7-day upload window (the window itself is enforced server-side).
 */
export default function MapDateControl({ value, onChange }: MapDateControlProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [show, setShow] = useState(false);
  // Draft date while the iOS spinner is open — committed on Done.
  const [draft, setDraft] = useState<Date>(value ?? new Date());
  const draftRef = useRef(draft);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then(setReduceTransparency)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    return () => sub?.remove?.();
  }, []);

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const open = useCallback(() => {
    const seed = value ?? new Date();
    setDraft(seed);
    draftRef.current = seed;
    setShow(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [value]);

  const commit = useCallback(
    (d: Date) => {
      const normalized = toLocalMidnight(d);
      onChange(normalized);
      setShow(false);
      Haptics.selectionAsync().catch(() => {});
    },
    [onChange]
  );

  const clear = useCallback(() => {
    onChange(null);
    Haptics.selectionAsync().catch(() => {});
  }, [onChange]);

  const isLive = value == null;
  const label = isLive
    ? 'Today'
    : isSameLocalDay(value, new Date())
      ? 'Today'
      : value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={open}
          onPressIn={() => {
            scale.value = withSpring(0.97, PRESS_IN);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, PRESS_OUT);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isLive ? 'Browse events by date' : `Browsing ${label}. Change date`}
          style={[
            styles.pill,
            {
              backgroundColor: isLive ? theme.background : theme.tint,
              borderColor: isLive ? theme.border : theme.tint,
            },
          ]}
        >
          <MaterialIcons name="event" size={15} color={isLive ? theme.text : '#FFFFFF'} />
          <Text
            style={[styles.pillLabel, { color: isLive ? theme.text : '#FFFFFF' }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {label}
          </Text>
          {!isLive && (
            <Pressable
              onPress={clear}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Return to today"
            >
              <MaterialIcons name="close" size={15} color="#FFFFFF" />
            </Pressable>
          )}
        </Pressable>
      </Animated.View>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setShow(false)}>
            {/* Translucent chrome material; solid fallback under reduce-transparency. */}
            <Pressable
              style={styles.sheet}
              onPress={() => {}}
              // stop the overlay's dismiss from firing when tapping the sheet
            >
              {reduceTransparency ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.sheetSolid,
                    { backgroundColor: theme.card },
                  ]}
                />
              ) : (
                <BlurView
                  intensity={40}
                  tint="systemChromeMaterial"
                  style={[StyleSheet.absoluteFill, styles.sheetSolid]}
                />
              )}
              <View style={styles.sheetHeader}>
                <Pressable onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={[styles.sheetAction, { color: theme.mutedText }]}>Cancel</Text>
                </Pressable>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Browse by date</Text>
                <Pressable onPress={() => commit(draftRef.current)} hitSlop={8}>
                  <Text style={[styles.sheetAction, { color: theme.tint, fontWeight: '700' }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  if (selected) {
                    const n = toLocalMidnight(selected);
                    setDraft(n);
                    draftRef.current = n;
                  }
                }}
                textColor={theme.text}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={draft}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_e, selected) => {
              setShow(false);
              if (selected) commit(selected);
            }}
          />
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    paddingBottom: 34,
  },
  sheetSolid: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sheetAction: {
    fontSize: 16,
  },
});
