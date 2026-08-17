---
name: react-native-design
description: Fluid, physical, Apple-grade motion and interaction for React Native / Expo — the companion to apple-design, mapped onto Reanimated 4 and Gesture Handler v2. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet/bottom-drawer interactions, momentum and interruptible transitions, haptics, translucent (blur) materials, Dynamic Type, or reduced-motion on a native RN screen. Grounded in this project's stack: Reanimated ~4.1, react-native-gesture-handler ~2.28, expo-blur, expo-haptics, expo-image.
---

# React Native Design

The native-platform companion to `apple-design`. Same principles — motion starts from the current on-screen value, inherits the user's velocity, projects momentum, and can be grabbed and reversed at any instant — but mapped onto **Reanimated 4** worklets and the **Gesture Handler v2** `Gesture` API instead of CSS/Pointer Events.

Read `apple-design` for the _why_ (the four human needs, spatial consistency, restraint). This skill is the _how_ for React Native.

> **Source of truth for the numbers:** the spring damping/response table, the momentum-projection decel (`0.998`), the rubber-band constant (`0.55`), and the press-scale (`0.97`) are **canonical in `apple-design`**. They are restated here in RN form for convenience — if a value ever changes, change it in `apple-design` first, then mirror it here. Never let the two diverge.

## Stack these map to (already installed here)

- `react-native-reanimated` **~4.1** — `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`, `runOnJS`. Worklets run on the UI thread, so animation never blocks on JS.
- `react-native-gesture-handler` **~2.28** — the `Gesture` API (`Gesture.Pan()`, `Gesture.Tap()`, `GestureDetector`). **Do not** use the legacy `PanGestureHandler` component API.
- `expo-blur` — `BlurView` for translucent materials.
- `expo-haptics` — physical feedback.
- `expo-image` — `Image` with built-in transition/placeholder.
- `Pressable` (RN core) — press feedback.

## The one mapping that matters: Apple springs → `withSpring`

Reanimated 4's `withSpring` accepts a **duration + dampingRatio** config, which is _exactly_ Apple's `response` + `damping`. Use this form — never hand-tune `stiffness`/`mass`/`damping` triplets.

```ts
// Apple 'response' → duration (seconds → ms). Apple 'damping' → dampingRatio.
const APPLE_DEFAULT = { duration: 400, dampingRatio: 1.0 }; // critically damped, no overshoot
const APPLE_MOMENTUM = { duration: 400, dampingRatio: 0.8 }; // slight bounce — ONLY after a flick/throw
const APPLE_SHEET = { duration: 300, dampingRatio: 0.8 }; // drawer / bottom sheet

x.value = withSpring(target, APPLE_DEFAULT);
```

| Interaction       | dampingRatio | duration |
| ----------------- | ------------ | -------- |
| Move / reposition | `1.0`        | `400ms`  |
| Rotation          | `0.8`        | `400ms`  |
| Drawer / sheet    | `0.8`        | `300ms`  |

**Default everything to `dampingRatio: 1.0` (no overshoot).** Add bounce (`0.8`) only when a gesture carried momentum. A menu that just faded in should not overshoot.

## Interruptibility comes free — if you don't fight it

`withSpring` re-targets from the shared value's **current** value and **current velocity** automatically. That is native interruptibility. You only break it by doing the wrong things:

- **Never** drive gesture UI with `withTiming` on a fixed duration for anything the user can grab — timing curves can't be smoothly reversed mid-flight. Springs can.
- **Never** reset a shared value to the target and _then_ animate — always animate the live value toward the new target.
- On a gesture that can reverse, decide commit-vs-return by the **velocity sign at release**, not the position.

## 1:1 drag with the Gesture API

Track the finger on the UI thread. Capture the start offset so the element doesn't jump to center on grab.

```ts
const translateY = useSharedValue(0);
const start = useSharedValue(0);

const pan = Gesture.Pan()
  .onStart(() => {
    start.value = translateY.value;
  }) // respect where they grabbed
  .onUpdate(e => {
    translateY.value = start.value + e.translationY;
  }) // 1:1, UI thread
  .onEnd(e => {
    // Momentum projection (apple-design §6): land where the flick is GOING.
    const projected = translateY.value + project(e.velocityY);
    const target = nearestSnapPoint(projected);
    // Hand off the finger's velocity so there is no seam between drag and spring.
    translateY.value = withSpring(target, { ...APPLE_MOMENTUM, velocity: e.velocityY });
  });

const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
// <GestureDetector gesture={pan}><Animated.View style={style}/></GestureDetector>
```

```ts
// Apple's projection function — decay form, not v²/(2a). 'worklet' so it runs UI-side.
function project(velocity: number, decel = 0.998) {
  'worklet';
  return ((velocity / 1000) * decel) / (1 - decel);
}
```

Key points:

- `e.velocityY` from Gesture Handler is **px/s** and can be passed straight into `withSpring`'s `velocity` — no normalization needed.
- Everything in `onUpdate`/`onEnd` runs on the UI thread. To call JS (navigation, `setState`, analytics) from there, wrap it in `runOnJS(fn)(args)`.
- Compose gestures with `Gesture.Simultaneous(...)` / `Gesture.Race(...)` rather than nesting handlers.

## Press feedback — instant, on press-in

Feedback lives on press-_in_, never on release. `Pressable` gives you the state; Reanimated makes it physical.

```tsx
const scale = useSharedValue(1);
const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
<Pressable
  onPressIn={() => {
    scale.value = withSpring(0.97, { duration: 120, dampingRatio: 1 });
  }}
  onPressOut={() => {
    scale.value = withSpring(1, APPLE_DEFAULT);
  }}
>
  <Animated.View style={aStyle}>{/* ... */}</Animated.View>
</Pressable>;
```

Add `hitSlop` (~8–10) so taps near the edge still register (apple-design §10).

## Rubber-banding at boundaries

Resist progressively past a bound instead of hard-stopping. Worklet version of the same formula:

```ts
function rubberband(overshoot: number, dim: number, c = 0.55) {
  'worklet';
  return (overshoot * dim * c) / (dim + c * Math.abs(overshoot));
}
// in onUpdate, when past the top bound:
if (raw < 0) translateY.value = rubberband(raw, SCREEN_H);
```

## Haptics — same frame as the visual

Fire on the causal moment (snap home, toggle commit, success), not on every move. Keep it rare or users tune it out.

```ts
import * as Haptics from 'expo-haptics';
// on a successful snap / commit:
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
// success / error states:
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

Trigger it from the same `onEnd`/commit path that starts the spring, so visual + haptic land together. Don't `await` it on the animation path.

## Translucent materials — `expo-blur`, not fake overlays

```tsx
import { BlurView } from 'expo-blur';
<BlurView intensity={40} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />;
```

- Use `tint` values (`systemChromeMaterial`, `systemUltraThinMaterial`, …) so it adapts to light/dark automatically — don't hardcode a gray.
- **Never stack a light translucent surface on another** — legibility collapses (apple-design §12).
- `BlurView` is a real native view: keep content scrolling _under_ nav/tab bars built from it, rather than reserving an opaque strip.
- Honor **reduced transparency**: fall back to a solid `surface` color (see below).

## Typography & Dynamic Type

- Let text scale with the OS setting — do **not** globally set `allowFontScaling={false}`. If a specific control must not scale, cap it with `maxFontSizeMultiplier` instead of killing scaling.
- Size layout in scalable units: derive spacing from the font scale where a big font would otherwise clip (`PixelRatio.getFontScale()`), not fixed px on text rows.
- Tighten large display text (`letterSpacing` slightly negative), leave body near `0` — same size-specific tracking rule as apple-design §15.
- **This project's hard rule:** text colors come from `useColorScheme()` / theme constants — never hardcode `#000`, `#111827`, `#374151`, `black`. The `darkmode` skill enforces this.

## Reduced motion — required, not optional

```ts
import { AccessibilityInfo } from 'react-native';
const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);
```

When on: replace springs/slides with a short opacity cross-fade (`withTiming(…, { duration: 150 })`), drop overshoot and parallax, keep instant press feedback. Reanimated also exposes `ReducedMotionConfig` to globally soften animations.

## Frame-level smoothness

- Animate only `transform` and `opacity` in `useAnimatedStyle` — these stay on the UI thread and don't trigger layout. Avoid animating `width`/`height`/`margin`.
- Keep gesture math inside worklets (`'worklet'`) so it never round-trips to JS mid-drag.
- Use `expo-image` for media (it decodes off-thread and has a built-in `transition` for materialize-not-pop).

## Quick reference

| Need                 | RN technique                                             | Value                                                         |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Default spring       | `withSpring`                                             | `{ duration: 400, dampingRatio: 1.0 }`                        |
| Momentum / flick     | `withSpring` after a throw                               | `{ duration: 400, dampingRatio: 0.8, velocity: e.velocityY }` |
| Sheet / drawer       | `withSpring`                                             | `{ duration: 300, dampingRatio: 0.8 }`                        |
| 1:1 drag             | `Gesture.Pan()` + shared value, capture start offset     | UI-thread `onUpdate`                                          |
| Flick landing        | `project(e.velocityY)` worklet                           | decay `0.998`                                                 |
| Velocity handoff     | `withSpring(..., { velocity: e.velocityY })`             | raw px/s                                                      |
| Press feedback       | `Pressable` + `withSpring(0.97)` on press-in             | `duration 120`                                                |
| Call JS from gesture | `runOnJS(fn)(...)`                                       | —                                                             |
| Boundary             | `rubberband()` worklet in `onUpdate`                     | `c = 0.55`                                                    |
| Material             | `expo-blur` `BlurView` with `tint`                       | never stack two light                                         |
| Haptic               | `expo-haptics` on the commit frame                       | rare, causal                                                  |
| Reduced motion       | `AccessibilityInfo.isReduceMotionEnabled()` → cross-fade | `duration 150`                                                |
| Text color           | `useColorScheme()` / theme constants                     | never hardcode dark hex                                       |
