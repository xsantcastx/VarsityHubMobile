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
};

const OBContext = createContext<Ctx | null>(null);

export function OBProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState>({});
  const [history, setHistory] = useState<OnboardingState[]>([]);
  const [progress, setProgress] = useState<number>(0);

  // On mount, try to preload onboarding state from server-side user prefs
  useEffect(() => {
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
  }, []);

  const clearOnboarding = () => {
    setState({});
    setProgress(0);
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
    <OBContext.Provider value={{ state, setState, clearOnboarding, history, pushHistory, restoreHistory, progress, setProgress, resetWithHistorySave }}>
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

