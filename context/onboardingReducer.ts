/**
 * Onboarding State Machine
 * 
 * Single source of truth for onboarding flow with deterministic step calculation.
 * Prevents race conditions and ensures coaches complete steps 2-6 before step 7.
 */

import { OnboardingState } from './OnboardingContext';

// Step definitions - single source of truth
export const ONBOARDING_STEPS = {
  STEP_1_ROLE: { id: 1, route: '/onboarding/step-1-role', index: 0 },
  STEP_2_BASIC: { id: 2, route: '/onboarding/step-2-basic', index: 1 },
  STEP_3_PLAN: { id: 3, route: '/onboarding/step-3-plan', index: 2 },
  STEP_4_ORGANIZATION: { id: 4, route: '/onboarding/step-4-organization', index: 3 },
  STEP_6_AUTHORIZED_USERS: { id: 6, route: '/onboarding/step-6-authorized-users', index: 4 },
  STEP_7_PROFILE: { id: 7, route: '/onboarding/step-7-profile', index: 5 },
  STEP_8_INTERESTS: { id: 8, route: '/onboarding/step-8-interests', index: 6 },
  STEP_9_FEATURES: { id: 9, route: '/onboarding/step-9-features', index: 7 },
  STEP_10_CONFIRMATION: { id: 10, route: '/onboarding/step-10-confirmation', index: 8 },
} as const;

export const STEP_ROUTES = [
  ONBOARDING_STEPS.STEP_1_ROLE.route,
  ONBOARDING_STEPS.STEP_2_BASIC.route,
  ONBOARDING_STEPS.STEP_3_PLAN.route,
  ONBOARDING_STEPS.STEP_4_ORGANIZATION.route,
  ONBOARDING_STEPS.STEP_6_AUTHORIZED_USERS.route,
  ONBOARDING_STEPS.STEP_7_PROFILE.route,
  ONBOARDING_STEPS.STEP_8_INTERESTS.route,
  ONBOARDING_STEPS.STEP_9_FEATURES.route,
  ONBOARDING_STEPS.STEP_10_CONFIRMATION.route,
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
  | { type: 'INIT_FROM_PROFILE'; profile: Partial<OnboardingState> }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SKIP'; stepId: number }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; data: Partial<OnboardingState> }
  | { type: 'SAVE_FAIL'; error: Error }
  | { type: 'SET_STEP'; stepIndex: number; reason?: string }
  | { type: 'UPDATE_DRAFT'; data: Partial<OnboardingState> };

/**
 * Determines if a step is complete based on required fields
 */
function isStepComplete(stepId: number, state: OnboardingState, role?: 'fan' | 'coach'): boolean {
  switch (stepId) {
    case 1: // Role selection
      return !!state.role;
    case 2: // Basic info
      return !!(state.username && state.dob && (state.zip || state.zip_code));
    case 3: // Plan selection (coaches only)
      if (role !== 'coach') return true; // Fans skip this
      return !!state.plan;
    case 4: // Organization (coaches only)
      if (role !== 'coach') return true; // Fans skip this
      return !!(state.team_id || state.organization_id);
    case 6: // Authorized users (optional for coaches, but must be visited)
      return !!state.step_6_visited; // Must visit this step before continuing
    case 7: // Profile
      return !!state.username; // At minimum, username is required
    case 8: // Interests
      return true; // Optional
    case 9: // Features
      return true; // Optional
    case 10: // Confirmation
      return false; // Final step, not "complete" until onboarding is done
    default:
      return false;
  }
}

/**
 * Calculates the next incomplete step for a coach
 * NEVER jumps ahead - always returns the first incomplete required step
 */
export function nextIncompleteStep(
  state: OnboardingState,
  role?: 'fan' | 'coach'
): number {
  const isCoach = role === 'coach';
  
  // Step 1: Role (always required)
  if (!isStepComplete(1, state, role)) {
    return ONBOARDING_STEPS.STEP_1_ROLE.index;
  }
  
  // Step 2: Basic info (always required)
  if (!isStepComplete(2, state, role)) {
    return ONBOARDING_STEPS.STEP_2_BASIC.index;
  }
  
  // For coaches, steps 3-6 are required before step 7
  if (isCoach) {
    // Step 3: Plan (coaches only)
    if (!isStepComplete(3, state, role)) {
      return ONBOARDING_STEPS.STEP_3_PLAN.index;
    }
    
    // Step 4: Organization (coaches only)
    if (!isStepComplete(4, state, role)) {
      return ONBOARDING_STEPS.STEP_4_ORGANIZATION.index;
    }
    
    // Step 6: Authorized users (optional, but MUST be visited/skipped before step 7)
    // Check if step 6 has been visited
    if (!isStepComplete(6, state, role)) {
      return ONBOARDING_STEPS.STEP_6_AUTHORIZED_USERS.index;
    }
  }
  
  // Step 7: Profile (after required steps for coaches)
  // Only reachable if coach has completed steps 2-4 and visited step 6
  // OR if fan (fans skip steps 3-6)
  if (!isStepComplete(7, state, role)) {
    return ONBOARDING_STEPS.STEP_7_PROFILE.index;
  }
  
  // Step 8: Interests (optional)
  if (!isStepComplete(8, state, role)) {
    return ONBOARDING_STEPS.STEP_8_INTERESTS.index;
  }
  
  // Step 9: Features (optional)
  if (!isStepComplete(9, state, role)) {
    return ONBOARDING_STEPS.STEP_9_FEATURES.index;
  }
  
  // Step 10: Confirmation (final)
  return ONBOARDING_STEPS.STEP_10_CONFIRMATION.index;
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
      console.log(`[ONBOARDING REDUCER] State:`, {
        role: state.draftData.role,
        hasStep2: !!(state.draftData.username && state.draftData.dob),
        hasStep3: !!state.draftData.plan,
        hasStep4: !!(state.draftData.team_id || state.draftData.organization_id),
        isSaving: state.isSaving,
      });
    }
  };

  switch (event.type) {
    case 'INIT_FROM_PROFILE': {
      if (state.initialized) {
        // Prevent double initialization
        return state;
      }
      
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
      if (state.isSaving) {
        // Prevent navigation during save
        return state;
      }
      
      const currentStepId = STEP_ROUTES[state.currentStepIndex] 
        ? Object.values(ONBOARDING_STEPS).find(s => s.index === state.currentStepIndex)?.id || 0
        : 0;
      
      // Calculate next step deterministically
      const nextStep = nextIncompleteStep(state.draftData, state.draftData.role);
      
      // Never jump backwards unless validation fails
      const safeNextStep = Math.max(state.currentStepIndex + 1, nextStep);
      const clampedNextStep = Math.min(safeNextStep, STEP_ROUTES.length - 1);
      
      logTransition(state.currentStepIndex, clampedNextStep, 'NEXT');
      
      return {
        ...state,
        currentStepIndex: clampedNextStep,
        completedStepIds: new Set([...state.completedStepIds, currentStepId]),
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: clampedNextStep,
          reason: 'NEXT',
          timestamp: Date.now(),
        },
      };
    }

    case 'BACK': {
      if (state.isSaving) {
        return state;
      }
      
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
      if (state.isSaving) {
        return state;
      }
      
      const skippedStepId = event.stepId;
      const nextStep = nextIncompleteStep(state.draftData, state.draftData.role);
      
      logTransition(state.currentStepIndex, nextStep, `SKIP_${skippedStepId}`);
      
      return {
        ...state,
        currentStepIndex: nextStep,
        completedStepIds: new Set([...state.completedStepIds, skippedStepId]),
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: nextStep,
          reason: `SKIP_${skippedStepId}`,
          timestamp: Date.now(),
        },
      };
    }

    case 'SAVE_START': {
      return {
        ...state,
        isSaving: true,
      };
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
        completedStepIds: new Set([...state.completedStepIds]),
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: nextStep,
          reason: 'SAVE_SUCCESS',
          timestamp: Date.now(),
        },
      };
    }

    case 'SAVE_FAIL': {
      return {
        ...state,
        isSaving: false,
      };
    }

    case 'SET_STEP': {
      if (state.isSaving) {
        return state;
      }
      
      const targetStep = Math.max(0, Math.min(event.stepIndex, STEP_ROUTES.length - 1));
      const reason = event.reason || 'SET_STEP';
      
      logTransition(state.currentStepIndex, targetStep, reason);
      
      return {
        ...state,
        currentStepIndex: targetStep,
        lastTransition: {
          fromStep: state.currentStepIndex,
          toStep: targetStep,
          reason,
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
