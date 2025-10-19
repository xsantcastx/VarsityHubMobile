import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export type Affiliation = 'none' | 'university' | 'high_school' | 'club' | 'youth';
export type Plan = 'rookie' | 'veteran' | 'legend';
export type UserRole = 'fan' | 'coach';
export type TeamRole = 'Team Manager' | 'Coach' | 'Admin';
export type Intent = 'find_local_games' | 'add_players' | 'follow';
export type Interest = 'Football' | 'Basketball' | 'Baseball' | 'Soccer' | 'Volleyball' | 'Track & Field' | 'Swimming' | 'Hockey' | 'Other';

export type OnboardingState = {
  role?: UserRole;
  username?: string;
  display_name?: string;
  affiliation?: Affiliation;
  dob?: string;
  zip?: string;
  zip_code?: string | null;
  plan?: Plan;
  team_id?: string;
  team_name?: string;
  organization_id?: string;
  organization_name?: string;
  sport?: string;
  authorized?: Array<{ email?: string; user_id?: string; role?: TeamRole; assign_team?: string }>;
  authorized_users?: Array<{ email?: string; user_id?: string; role?: TeamRole; assign_team?: string }>;
  avatar_url?: string;
  bio?: string;
  sports_interests?: Interest[];
  primary_intents?: Intent[];
  personalization_goals?: Intent[];
  season_start?: string;
  season_end?: string;
  location_enabled?: boolean;
  notifications_enabled?: boolean;
  messaging_policy_accepted?: boolean;
  // flag used when a payment/checkout is pending during onboarding
  payment_pending?: boolean | string;
};

type Ctx = { 
  state: OnboardingState; 
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  clearOnboarding: () => void;
  // history stack of saved onboarding snapshots
  history: OnboardingState[];
  pushHistory: (snapshot: OnboardingState) => void;
  restoreHistory: (index: number) => void;
  // simple progress indicator (0-based step index)
  progress: number;
  setProgress: (step: number) => void;
  // reset but save current snapshot into history first
  resetWithHistorySave: () => void;
  // flag to indicate if AsyncStorage has been loaded
  isLoaded: boolean;
};

const OBContext = createContext<Ctx | null>(null);

const STORAGE_KEY = '@onboarding_state';
const PROGRESS_KEY = '@onboarding_progress';

export function OBProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState>({});
  const [history, setHistory] = useState<OnboardingState[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedState, savedProgress] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(PROGRESS_KEY)
        ]);
        
        console.log('[OBProvider] Loaded from AsyncStorage - Progress:', savedProgress, 'State:', savedState?.substring(0, 100));
        
        if (!mounted) return;
        
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setState(parsed);
        }
        
        if (savedProgress) {
          const progressNum = parseInt(savedProgress, 10);
          console.log('[OBProvider] Setting progress to:', progressNum);
          setProgress(progressNum);
        }
        
        setIsLoaded(true);
      } catch (e) {
        console.warn('Failed to load onboarding state from storage', e);
        setIsLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // On mount, try to preload onboarding state from server-side user prefs
  // But only if we haven't already loaded from AsyncStorage
  useEffect(() => {
    if (!isLoaded) return; // Wait for AsyncStorage to load first
    
    let mounted = true;
    (async () => {
      try {
        // Only bother if state is empty
        if (Object.keys(state || {}).length === 0) {
          const me: any = await User.me();
          if (!mounted || !me) return;
          const prefs = me?.preferences || {};
              const preload: OnboardingState = {
                role: prefs.role || me?.role,
                display_name: prefs.display_name ?? me?.display_name,
                dob: prefs.dob || undefined,
                zip_code: prefs.zip_code || undefined,
                plan: prefs.plan || undefined,
                avatar_url: me?.avatar_url || undefined,
                bio: prefs.bio || undefined,
                sports_interests: prefs.sports_interests ?? prefs.sports ?? undefined,
                primary_intents: prefs.primary_intents ?? undefined,
                authorized_users: prefs.authorized_users ?? undefined,
              };
              // Debug: log preload vs current to help trace restart-onboarding issues
              try {
                // eslint-disable-next-line no-console
                console.debug('[OBProvider] preload', { preload, cur: state });
              } catch (e) {}
          // Only set if we actually found any meaningful fields.
          // When merging server-preloaded values, do NOT overwrite any
          // values the user may have already set during this session.
          // Spread preload first, then current state so current values take precedence.
          if (Object.keys(preload).length > 0) setState((cur) => ({ ...(preload as any), ...(cur || {}) }));
        }
      } catch (e) {
        // best-effort; swallow errors
        console.warn('Onboarding preload failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [isLoaded]);

  // Save state to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save onboarding state to storage', e);
      }
    })();
  }, [state, isLoaded]);

  // Save progress to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    
    (async () => {
      try {
        console.log('[OBProvider] Saving progress to AsyncStorage:', progress);
        await AsyncStorage.setItem(PROGRESS_KEY, progress.toString());
      } catch (e) {
        console.warn('Failed to save onboarding progress to storage', e);
      }
    })();
  }, [progress, isLoaded]);

  const clearOnboarding = () => {
    setState({});
    setProgress(0);
    // Also clear from AsyncStorage
    AsyncStorage.multiRemove([STORAGE_KEY, PROGRESS_KEY]).catch((e) => {
      console.warn('Failed to clear onboarding from storage', e);
    });
  };

  const pushHistory = (snapshot: OnboardingState) => {
    setHistory((h) => [snapshot, ...h].slice(0, 10)); // keep last 10
  };

  const restoreHistory = (index: number) => {
    const snap = history[index];
    if (snap) setState(snap);
  };

  const resetWithHistorySave = () => {
    pushHistory(state);
    clearOnboarding();
  };
  
  return (
    <OBContext.Provider value={{ state, setState, clearOnboarding, history, pushHistory, restoreHistory, progress, setProgress, resetWithHistorySave, isLoaded }}>
      {children}
    </OBContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OBContext);
  if (!ctx) throw new Error('useOnboarding must be used within OBProvider');
  return ctx;
}

// Non-throwing variant: returns null when OBProvider isn't mounted.
export function useOnboardingOptional() {
  return useContext(OBContext);
}

