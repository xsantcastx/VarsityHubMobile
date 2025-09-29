import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

// Dynamic Lottie wrapper - attempts to load lottie-react-native at runtime.
export default function MatchBannerLottie({ style, onLoaded, tintColor, size = 80, preset = 'sparkle', disabled = false }: { style?: any; onLoaded?: (loaded: boolean) => void; tintColor?: string; size?: number; preset?: 'classic' | 'sparkle' | 'sporty'; disabled?: boolean }) {
  const [LottieView, setLottieView] = useState<any>(null)
  const animationRef = useRef<any>(null)
  const onLoadedRef = useRef<typeof onLoaded | undefined>(onLoaded);

  // keep latest onLoaded in a ref so the dynamic-import effect does not need it
  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);

  useEffect(() => {
    let mounted = true;

    if (disabled) {
      setLottieView(null);
      try { onLoadedRef.current && onLoadedRef.current(false); } catch {}
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const mod = await import('lottie-react-native');
        if (mounted) {
          setLottieView(() => mod.default || mod);
          try { onLoadedRef.current && onLoadedRef.current(true); } catch {}
        }
      } catch (err) {
        try { onLoadedRef.current && onLoadedRef.current(false); } catch {}
      }
    })();

    return () => {
      mounted = false;
    };
  }, [disabled]);

  if (disabled || !LottieView) {
    // show nothing (or a tiny loader) when lottie isn't available
    return null
  }

  // pick asset based on preset. Only reference animation files that actually exist in the repo
  // to avoid Metro bundler resolution errors. If you add new JSON assets, update this map.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ANIM_SPARKLE_BETTER = require('../../assets/animations/sparkle_better.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ANIM_SPARKLE = require('../../assets/animations/sparkle.json');

  let anim: any = ANIM_SPARKLE_BETTER;
  if (preset === 'sparkle') {
    anim = ANIM_SPARKLE_BETTER;
  } else if (preset === 'sporty') {
    // sporty preset currently uses the generic sparkle placeholder until a dedicated asset is added
    anim = ANIM_SPARKLE;
  } else {
    // classic maps to the simple sparkle placeholder
    anim = ANIM_SPARKLE;
  }

  return (
    <View style={style} pointerEvents="none">
      <LottieView
        ref={animationRef}
        source={anim}
        autoPlay
        loop
        style={{ width: size, height: size }}
        colorFilters={tintColor ? [{ keypath: 'dot', color: tintColor }] : undefined}
      />
    </View>
  )
}
