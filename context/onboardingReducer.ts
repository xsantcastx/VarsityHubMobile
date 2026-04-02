/**
 * Onboarding State Machine (Simplified)
 *
 * 3-step onboarding:
 *   Step 1: Role selection (Fan / Coach)
 *   Step 2: Basic info (username, DOB, zip)
 *   Step 3: League (join or create) — coaches only
 *
 * After step 3:
 *   - Fan → mark complete, go to feed
 *   - Coach joining league → pending-approval (locked)
 *   - Coach creating league → league-pending-approval (locked)
 */

import { OnboardingState } from './OnboardingContext';

// Step definitions - single source of truth
export const ONBOARDING_STEPS = {
  STEP_1_ROLE: { id: 1, route: '/onboarding/step-1-role', index: 0 },
  STEP_2_BASIC: { id: 2, route: '/onboarding/step-2-basic', index: 1 },
  STEP_3_LEAGUE: { id: 3, route: '/onboarding/step-3-league', index: 2 },
} as const;

export const STEP_ROUTES = [
  ONBOARDING_STEPS.STEP_1_ROLE.route,
  ONBOARDING_STEPS.STEP_2_BASIC.route,
  ONBOARDING_STEPS.STEP_3_LEAGUE.route,
] as const;

export type OnboardingReducerState = {
  currentStepIndex: number;
  completedStepIds: Set<number>;
  draftData: OnboardingState;
  isSaving: boolean;
  initialized: boolean;
  lastTransition?: {
    fromStep: number;
    toStep: number;
    reason: string;
    timestamp: number;
  };
};

export type OnboardingEvent =
  | { type: 'RESET' }
  | { type: 'INIT_FROM_PROFILE'; profile: Partial<OnboardingState> }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SKIP'; stepId: number }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; data: Partial<OnboardingState> }
  | { type: 'SAVE_FAIL'; error: Error }
  | { type: 'SET_STEP'; stepIndex: number; reason?: string }
  | { type: 'UPDATE_DRAFT'; data: Partial<OnboardingState> }
  | { type: 'RESTORE_COMPLETED_STEPS'; stepIds: number[] };

/**
 * Determines if a step is complete based on required fields
 */
function isStepComplete(stepId: number, state: OnboardingState, role?: 'fan' | 'coach'): boolean {
  switch (stepId) {
    case 1: // Role selection
      return !!state.role;
    case 2: // Basic info
      return !!state.step_2_visited;
    case 3: // League (coaches only)
      if (role !== 'coach') return true; // Fans skip this
      return !!(state.join_request_pending || state.organization_id);
    default:
      return false;
  }
}

/**
 * Calculates the next incomplete step
 * Fans: step 1 → step 2 → done
 * Coaches: step 1 → step 2 → step 3 → pending screen
 */
export function nextIncompleteStep(
  state: OnboardingState,
  role?: 'fan' | 'coach'
): number {
  // Step 1: Role (always required)
  if (!isStepComplete(1, state, role)) {
    return ONBOARDING_STEPS.STEP_1_ROLE.index;
  }

  // Step 2: Basic info (always required)
  if (!isStepComplete(2, state, role)) {
    return ONBOARDING_STEPS.STEP_2_BASIC.index;
  }

  // Step 3: League (coaches only)
  if (role === 'coach') {
    if (!isStepComplete(3, state, role)) {
      return ONBOARDING_STEPS.STEP_3_LEAGUE.index;
    }
  }

  // All steps complete — return last step index (will be handled by caller)
  return role === 'coach' ? ONBOARDING_STEPS.STEP_3_LEAGUE.index : ONBOARDING_STEPS.STEP_2_BASIC.index;
}

/**
 * Onboarding reducer - single source of truth for state transitions
 */
export function onboardingReducer(
  state: OnboardingReducerState,
  event: OnboardingEvent
): OnboardingReducerState {
  const logTransition = (fromStep: number, toStep: number, reason: string) => {
    if (__DEV__) {
      console.log(`[ONBOARDING REDUCER] Transition: ${fromStep} → ${toStep} (${reason})`);
    }
  };

  switch (event.type) {
    case 'RESET': {
      return createInitialState();
    }

    case 'INIT_FROM_PROFILE': {
      // Always apply — do not gate on `initialized`. On multi-user devices,
      // the persisted `initialized: true` from user A would silently block
      // user B's profile from loading. The operation is idempotent so
      // re-applying the same profile data is harmless.
      const profile = event.profile;
      const nextStep = nextIncompleteStep(profile, profile.role);
      logTransition(state.currentStepIndex, nextStep, 'INIT_FROM_PROFILE');

      return {
        ...state,
        draftData: { ...state.draftData, ...profile },
        currentStepIndex: nextStep,
        initialized: true,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: nextStep,
          reason: 'INIT_FROM_PROFILE',
          timestamp: Date.now(),
        },
      };
    }

    case 'NEXT': {
      if (state.isSaving) return state;

      const nextStep = nextIncompleteStep(state.draftData, state.draftData.role);
      const clampedNextStep = Math.min(nextStep, STEP_ROUTES.length - 1);
      logTransition(state.currentStepIndex, clampedNextStep, 'NEXT');

      return {
        ...state,
        currentStepIndex: clampedNextStep,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: clampedNextStep,
          reason: 'NEXT',
          timestamp: Date.now(),
        },
      };
    }

    case 'BACK': {
      if (state.isSaving) return state;
      const prevStep = Math.max(0, state.currentStepIndex - 1);
      logTransition(state.currentStepIndex, prevStep, 'BACK');

      return {
        ...state,
        currentStepIndex: prevStep,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: prevStep,
          reason: 'BACK',
          timestamp: Date.now(),
        },
      };
    }

    case 'SKIP': {
      if (state.isSaving) return state;
      const nextStep = nextIncompleteStep(state.draftData, state.draftData.role);
      logTransition(state.currentStepIndex, nextStep, `SKIP_${event.stepId}`);

      return {
        ...state,
        currentStepIndex: nextStep,
        completedStepIds: new Set([...state.completedStepIds, event.stepId]),
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: nextStep,
          reason: `SKIP_${event.stepId}`,
          timestamp: Date.now(),
        },
      };
    }

    case 'SAVE_START': {
      return { ...state, isSaving: true };
    }

    case 'SAVE_SUCCESS': {
      const updatedData = { ...state.draftData, ...event.data };
      const nextStep = nextIncompleteStep(updatedData, updatedData.role);
      logTransition(state.currentStepIndex, nextStep, 'SAVE_SUCCESS');

      return {
        ...state,
        draftData: updatedData,
        currentStepIndex: nextStep,
        isSaving: false,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: nextStep,
          reason: 'SAVE_SUCCESS',
          timestamp: Date.now(),
        },
      };
    }

    case 'SAVE_FAIL': {
      return { ...state, isSaving: false };
    }

    case 'SET_STEP': {
      if (state.isSaving) return state;
      const targetStep = Math.max(0, Math.min(event.stepIndex, STEP_ROUTES.length - 1));
      logTransition(state.currentStepIndex, targetStep, event.reason || 'SET_STEP');

      return {
        ...state,
        currentStepIndex: targetStep,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: targetStep,
          reason: event.reason || 'SET_STEP',
          timestamp: Date.now(),
        },
      };
    }

    case 'UPDATE_DRAFT': {
      return {
        ...state,
        draftData: { ...state.draftData, ...event.data },
      };
    }

    case 'RESTORE_COMPLETED_STEPS': {
      const restored = new Set(state.completedStepIds);
      for (const id of event.stepIds) restored.add(id);
      return { ...state, completedStepIds: restored };
    }

    default:
      return state;
  }
}

/**
 * Initial state factory
 */
export function createInitialState(profile?: Partial<OnboardingState>): OnboardingReducerState {
  return {
    currentStepIndex: 0,
    completedStepIds: new Set(),
    draftData: profile || {},
    isSaving: false,
    initialized: false,
  };
}
