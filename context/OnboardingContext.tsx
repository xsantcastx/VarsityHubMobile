import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import {
  createInitialState,
  nextIncompleteStep,
  onboardingReducer,
  OnboardingReducerState,
  OnboardingEvent,
} from './onboardingReducer';

const ONBOARDING_STATE_KEY = 'onboarding_state';
const ONBOARDING_PROGRESS_KEY = 'onboarding_progress';
const ONBOARDING_REDUCER_STATE_KEY = 'onboarding_reducer_state';

type ServerOnboardingPatch = Partial<{
  [K in keyof OnboardingState]: OnboardingState[K] | null;
}>;

function normalizeServerOnboardingPatch(
  serverPrefs: Record<string, unknown>
): ServerOnboardingPatch {
  const filtered = Object.fromEntries(
    Object.entries(serverPrefs).filter(([, v]) => v !== undefined)
  ) as ServerOnboardingPatch;

  // `step_3_visited` is a local draft milestone, not a server-owned field.
  // Always clear it on server hydration so stale local completion cannot
  // survive once canonical auth state has been fetched.
  delete filtered.step_3_visited;
  filtered.step_3_visited = false;

  return filtered;
}

export type Affiliation =
  | 'none'
  | 'other'
  | 'school'
  | 'independent'
  | 'university'
  | 'high_school'
  | 'club'
  | 'youth'
  | 'professional';
export type Plan = 'rookie' | 'veteran' | 'legend';
// Rookie is a plan, not a role
export type UserRole = 'fan' | 'coach';
export type TeamRole = 'Team Manager' | 'Coach' | 'Admin';
export type Intent = 'find_local_games' | 'add_players' | 'follow';
export type Interest =
  | 'Football'
  | 'Basketball'
  | 'Baseball'
  | 'Soccer'
  | 'Volleyball'
  | 'Track & Field'
  | 'Swimming'
  | 'Hockey'
  | 'Other';

export type OnboardingState = {
  role?: UserRole;
  username?: string;
  display_name?: string;
  affiliation?: Affiliation;
  dob?: string;
  zip?: string;
  zip_code?: string | null;
  plan?: Plan;
  pending_plan?: Plan;
  payment_pending?: boolean;
  // Total number of teams the user intends to manage (selected during plan purchase)
  team_count_total?: number;
  team_id?: string;
  team_name?: string;
  organization_id?: string;
  organization_name?: string;
  organization_place_id?: string | null;
  organization_location?: string | null;
  join_request_pending?: boolean;
  sport?: string;
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
  // Track which steps have been explicitly visited/completed
  step_2_visited?: boolean;
  step_3_visited?: boolean;
};

type Ctx = {
  state: OnboardingState;
  setState: (newState: React.SetStateAction<OnboardingState>) => void;
  clearOnboarding: () => Promise<void>;
  /** Overwrite local AsyncStorage state with server preferences — DB always wins on conflict */
  hydrateFromServer: (serverPrefs: Record<string, unknown>) => void;
  progress: number;
  setProgress: (progress: number) => void;
  isLoaded: boolean;
  // Reducer-based API
  reducerState: OnboardingReducerState;
  dispatch: (event: OnboardingEvent) => void;
  nextStep: () => number;
  canNavigate: boolean;
};

const OBContext = createContext<Ctx | null>(null);

export function OBProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState>({});
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const initRef = useRef(false);

  // Reducer-based state management
  const [reducerState, dispatch] = useReducer(onboardingReducer, createInitialState());

  // Load state from AsyncStorage on mount.
  // ONBOARDING_REDUCER_STATE_KEY is the canonical local source — it is persisted on every
  // state change and includes draftData, step index, and completed steps. The older
  // ONBOARDING_STATE_KEY / ONBOARDING_PROGRESS_KEY keys are only read as a migration
  // fallback when the canonical key is missing (first install or legacy devices).
  // Server preferences (hydrateFromServer) always win over anything loaded here.
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedReducerState = await AsyncStorage.getItem(ONBOARDING_REDUCER_STATE_KEY);

        if (savedReducerState) {
          // Canonical source — use it exclusively
          const parsed = JSON.parse(savedReducerState);
          if (parsed?.draftData) {
            setState(parsed.draftData);
            dispatch({ type: 'INIT_FROM_PROFILE', profile: parsed.draftData });
          }
          // Restore completedStepIds from persistence (was written but never read back)
          if (Array.isArray(parsed?.completedStepIds) && parsed.completedStepIds.length > 0) {
            dispatch({ type: 'RESTORE_COMPLETED_STEPS', stepIds: parsed.completedStepIds });
          }
          if (typeof parsed?.currentStepIndex === 'number') {
            setProgress(parsed.currentStepIndex);
          }
          initRef.current = true;
        } else {
          // Legacy fallback — only reached on first install or migration
          const savedState = await AsyncStorage.getItem(ONBOARDING_STATE_KEY);
          const savedProgress = await AsyncStorage.getItem(ONBOARDING_PROGRESS_KEY);
          if (savedState) {
            const parsedState = JSON.parse(savedState);
            setState(parsedState);
            dispatch({ type: 'INIT_FROM_PROFILE', profile: parsedState });
            initRef.current = true;
          }
          if (savedProgress) {
            setProgress(parseInt(savedProgress, 10));
          }
        }
      } catch (e) {
        if (__DEV__) console.error('Failed to load onboarding state from storage', e);
      } finally {
        setIsLoaded(true);
        if (!initRef.current) {
          initRef.current = true;
        }
      }
    };
    loadState();
  }, []);

  // v1.0.2 audit fix: AsyncStorage writes were fire-and-forget. If storage fails
  // (quota, permissions), UI state silently diverges from persisted state.
  // Log failures so we can trace them; user experience continues via in-memory state.
  // v1.0.2 pass 4: wrapped in useCallback so downstream callbacks keep stable references.
  const persistAsync = useCallback((key: string, value: string) => {
    AsyncStorage.setItem(key, value).catch(err => {
      if (__DEV__)
        console.warn(
          `[OnboardingContext] AsyncStorage.setItem failed for ${key}:`,
          err?.message || err
        );
      captureBreadcrumb(
        'Onboarding state persistence failed',
        'onboarding.storage',
        {
          key,
        },
        'warning'
      );
      captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { context: 'onboarding_storage_persist_failed' },
        key,
      });
    });
  }, []);

  // Persist state to AsyncStorage on change
  const setAndPersistState = useCallback(
    (newState: React.SetStateAction<OnboardingState>) => {
      setState(prevState => {
        const updatedState = typeof newState === 'function' ? newState(prevState) : newState;
        persistAsync(ONBOARDING_STATE_KEY, JSON.stringify(updatedState));

        // Sync with reducer
        dispatch({ type: 'UPDATE_DRAFT', data: updatedState });

        return updatedState;
      });
    },
    [persistAsync]
  );

  const setAndPersistProgress = useCallback(
    (newProgress: number) => {
      setProgress(newProgress);
      persistAsync(ONBOARDING_PROGRESS_KEY, newProgress.toString());

      // Sync with reducer
      dispatch({ type: 'SET_STEP', stepIndex: newProgress, reason: 'LEGACY_SET_PROGRESS' });
    },
    [persistAsync]
  );

  const hydrateFromServer = useCallback(
    (serverPrefs: Record<string, unknown>) => {
      if (!serverPrefs || Object.keys(serverPrefs).length === 0) return;
      // Apply all defined values, including nulls, so server-side clears wipe stale
      // local draft data instead of leaving old IDs/plans behind.
      const filtered = normalizeServerOnboardingPatch(serverPrefs);
      if (Object.keys(filtered).length === 0) return;
      setState(prev => {
        const merged = { ...prev, ...filtered } as OnboardingState;
        persistAsync(ONBOARDING_STATE_KEY, JSON.stringify(merged));
        return merged;
      });
      dispatch({ type: 'INIT_FROM_PROFILE', profile: filtered as Partial<OnboardingState> });
    },
    [persistAsync]
  );

  const clearOnboarding = useCallback(async () => {
    setState({});
    setProgress(0);
    dispatch({ type: 'RESET' });
    try {
      await AsyncStorage.removeItem(ONBOARDING_STATE_KEY);
      await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
      await AsyncStorage.removeItem(ONBOARDING_REDUCER_STATE_KEY);
    } catch (e) {
      if (__DEV__) console.error('Failed to clear onboarding state from storage', e);
    }
  }, []);

  // Persist reducer state
  useEffect(() => {
    if (isLoaded && reducerState.initialized) {
      persistAsync(
        ONBOARDING_REDUCER_STATE_KEY,
        JSON.stringify({
          currentStepIndex: reducerState.currentStepIndex,
          completedStepIds: Array.from(reducerState.completedStepIds),
          draftData: reducerState.draftData,
          isSaving: reducerState.isSaving,
          initialized: reducerState.initialized,
        })
      );
    }
  }, [
    reducerState.currentStepIndex,
    reducerState.completedStepIds,
    reducerState.draftData,
    reducerState.isSaving,
    reducerState.initialized,
    isLoaded,
    persistAsync,
  ]);

  // Calculate next step deterministically
  const nextStep = useCallback(() => {
    return nextIncompleteStep(reducerState.draftData, reducerState.draftData.role);
  }, [reducerState.draftData]);

  const canNavigate = !reducerState.isSaving;

  const value = useMemo(
    () => ({
      state,
      setState: setAndPersistState,
      clearOnboarding,
      hydrateFromServer,
      progress,
      setProgress: setAndPersistProgress,
      isLoaded,
      reducerState,
      dispatch,
      nextStep,
      canNavigate,
    }),
    [
      state,
      setAndPersistState,
      clearOnboarding,
      progress,
      setAndPersistProgress,
      isLoaded,
      reducerState,
      dispatch,
      nextStep,
      canNavigate,
    ]
  );

  return <OBContext.Provider value={value}>{children}</OBContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OBContext);
  if (!ctx) throw new Error('useOnboarding must be used within OBProvider');
  return ctx;
}

export function useOnboardingOptional() {
  return useContext(OBContext);
}
