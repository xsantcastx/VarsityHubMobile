import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  createInitialState,
  nextIncompleteStep,
  onboardingReducer,
  OnboardingReducerState,
  OnboardingEvent,
  STEP_ROUTES,
} from './onboardingReducer';

const ONBOARDING_STATE_KEY = 'onboarding_state';
const ONBOARDING_PROGRESS_KEY = 'onboarding_progress';
const ONBOARDING_REDUCER_STATE_KEY = 'onboarding_reducer_state';

export type Affiliation = 'none' | 'school' | 'independent' | 'university' | 'high_school' | 'club' | 'youth' | 'professional';
export type Plan = 'rookie' | 'veteran' | 'legend';
// Rookie is a plan, not a role
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
  // Track which steps have been explicitly visited/completed
  step_2_visited?: boolean;
  step_3_visited?: boolean;
};

type Ctx = { 
  state: OnboardingState; 
  setState: (newState: React.SetStateAction<OnboardingState>) => void;
  clearOnboarding: () => Promise<void>;
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
  const [reducerState, dispatch] = useReducer(
    onboardingReducer,
    createInitialState()
  );

  // Load state from AsyncStorage on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(ONBOARDING_STATE_KEY);
        const savedProgress = await AsyncStorage.getItem(ONBOARDING_PROGRESS_KEY);
        const savedReducerState = await AsyncStorage.getItem(ONBOARDING_REDUCER_STATE_KEY);
        
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          setState(parsedState);
          
          // Initialize reducer from saved state
          if (!initRef.current && parsedState) {
            dispatch({ type: 'INIT_FROM_PROFILE', profile: parsedState });
            initRef.current = true;
          }
        }
        
        if (savedProgress) {
          const parsedProgress = parseInt(savedProgress, 10);
          setProgress(parsedProgress);
          
          // Sync reducer state with saved progress
          if (!initRef.current) {
            dispatch({ type: 'SET_STEP', stepIndex: parsedProgress, reason: 'LOAD_FROM_STORAGE' });
          }
        }
        
        if (savedReducerState) {
          try {
            const parsed = JSON.parse(savedReducerState);
            // Restore reducer state if available
            if (parsed && !initRef.current) {
              // Merge with current state
              dispatch({ type: 'INIT_FROM_PROFILE', profile: parsed.draftData || {} });
              initRef.current = true;
            }
          } catch {
            // Ignore parse errors
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

  // Persist state to AsyncStorage on change
  const setAndPersistState = useCallback((newState: React.SetStateAction<OnboardingState>) => {
    setState(prevState => {
      const updatedState = typeof newState === 'function' ? newState(prevState) : newState;
      AsyncStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(updatedState));
      
      // Sync with reducer
      dispatch({ type: 'UPDATE_DRAFT', data: updatedState });
      
      return updatedState;
    });
  }, []);

  const setAndPersistProgress = useCallback((newProgress: number) => {
    setProgress(newProgress);
    AsyncStorage.setItem(ONBOARDING_PROGRESS_KEY, newProgress.toString());
    
    // Sync with reducer
    dispatch({ type: 'SET_STEP', stepIndex: newProgress, reason: 'LEGACY_SET_PROGRESS' });
  }, []);

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
      AsyncStorage.setItem(ONBOARDING_REDUCER_STATE_KEY, JSON.stringify({
        currentStepIndex: reducerState.currentStepIndex,
        completedStepIds: Array.from(reducerState.completedStepIds),
        draftData: reducerState.draftData,
        isSaving: reducerState.isSaving,
        initialized: reducerState.initialized,
      })).catch(e => {
        if (__DEV__) console.error('Failed to persist reducer state', e);
      });
    }
    // Use specific primitives to avoid re-triggering on object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducerState.currentStepIndex, reducerState.isSaving, reducerState.initialized, isLoaded]);

  // Calculate next step deterministically
  const nextStep = useCallback(() => {
    return nextIncompleteStep(reducerState.draftData, reducerState.draftData.role);
  }, [reducerState.draftData]);

  const canNavigate = !reducerState.isSaving;

  const value = useMemo(() => ({
    state,
    setState: setAndPersistState,
    clearOnboarding,
    progress,
    setProgress: setAndPersistProgress,
    isLoaded,
    reducerState,
    dispatch,
    nextStep,
    canNavigate,
  }), [state, setAndPersistState, clearOnboarding, progress, setAndPersistProgress, isLoaded, reducerState, dispatch, nextStep, canNavigate]);

  return (
    <OBContext.Provider value={value}>
      {children}
    </OBContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OBContext);
  if (!ctx) throw new Error('useOnboarding must be used within OBProvider');
  return ctx;
}

export function useOnboardingOptional() {
  return useContext(OBContext);
}
