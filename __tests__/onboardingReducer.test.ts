/**
 * Unit tests for onboarding reducer and step calculation
 *
 * Simplified 3-step flow:
 *   Step 1: Role (fan/coach)
 *   Step 2: Basic info (username, DOB, zip)
 *   Step 3: League (coaches only — join or create)
 */

import {
  nextIncompleteStep,
  onboardingReducer,
  createInitialState,
  OnboardingReducerState,
} from '../context/onboardingReducer';
import { OnboardingState } from '../context/OnboardingContext';

describe('nextIncompleteStep', () => {
  it('should return step 1 if no role is selected', () => {
    const state: OnboardingState = {};
    const result = nextIncompleteStep(state);
    expect(result).toBe(0); // STEP_1_ROLE.index
  });

  it('should return step 2 if role is selected but basic info not visited', () => {
    const state: OnboardingState = { role: 'coach' };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(1); // STEP_2_BASIC.index
  });

  it('should return step 3 for coach if step 2 visited but step 3 not visited', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(2); // STEP_3_LEAGUE.index
  });

  it('should return step 2 (done) for fan after step 2 visited', () => {
    const state: OnboardingState = {
      role: 'fan',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
    };
    const result = nextIncompleteStep(state, 'fan');
    // Fans are done after step 2
    expect(result).toBe(1); // STEP_2_BASIC.index (last completed step)
  });

  it('should return step 3 (done) for coach after all steps visited', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
      step_3_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(2); // STEP_3_LEAGUE.index (last completed step)
  });

  it('should keep coach on step 3 when local org data exists but step 3 was never completed', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
      organization_id: 'org_123',
      join_request_pending: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(2); // stale ids do not complete step 3
  });

  it('should treat step_3_visited as the canonical local completion marker for coaches', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
      organization_id: 'org_123',
      join_request_pending: false,
      step_3_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(2);
  });

  it('should enforce step order for coaches - never jump ahead', () => {
    const incompleteState: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      // step_2_visited not set - should return to step 2
    };
    const result = nextIncompleteStep(incompleteState, 'coach');
    expect(result).toBe(1); // STEP_2_BASIC.index
  });
});

describe('onboardingReducer', () => {
  it('should reset reducer state', () => {
    const state: OnboardingReducerState = {
      ...createInitialState(),
      currentStepIndex: 2,
      draftData: {
        role: 'coach',
        username: 'testuser',
      },
      initialized: true,
      isSaving: true,
    };

    const newState = onboardingReducer(state, { type: 'RESET' });

    expect(newState.currentStepIndex).toBe(0);
    expect(newState.draftData).toEqual({});
    expect(newState.initialized).toBe(false);
    expect(newState.isSaving).toBe(false);
  });

  it('should initialize from profile', () => {
    const initialState = createInitialState();
    const profile: OnboardingState = {
      role: 'coach',
      username: 'testuser',
    };
    const newState = onboardingReducer(initialState, {
      type: 'INIT_FROM_PROFILE',
      profile,
    });
    expect(newState.draftData.role).toBe('coach');
    expect(newState.draftData.username).toBe('testuser');
    expect(newState.initialized).toBe(true);
  });

  it('should prevent navigation during save', () => {
    const state: OnboardingReducerState = {
      ...createInitialState(),
      isSaving: true,
      currentStepIndex: 1,
    };
    const newState = onboardingReducer(state, { type: 'NEXT' });
    expect(newState.currentStepIndex).toBe(1);
  });

  it('should handle SAVE_START and SAVE_SUCCESS', () => {
    const state = createInitialState();
    let currentState = onboardingReducer(state, { type: 'SAVE_START' });
    expect(currentState.isSaving).toBe(true);

    currentState = onboardingReducer(currentState, {
      type: 'SAVE_SUCCESS',
      data: { role: 'coach', username: 'testuser' },
    });
    expect(currentState.isSaving).toBe(false);
    expect(currentState.draftData.role).toBe('coach');
    expect(currentState.draftData.username).toBe('testuser');
  });

  it('should handle SAVE_FAIL', () => {
    const state: OnboardingReducerState = {
      ...createInitialState(),
      isSaving: true,
    };
    const newState = onboardingReducer(state, {
      type: 'SAVE_FAIL',
      error: new Error('Test error'),
    });
    expect(newState.isSaving).toBe(false);
  });
});

describe('Step order integration', () => {
  it('should maintain correct step order for coach onboarding', () => {
    const steps: number[] = [];
    let state: OnboardingState = {};

    // Step 1: No role yet
    steps.push(nextIncompleteStep(state, 'coach'));
    state = { ...state, role: 'coach' };

    // Step 2: Role selected, need basic info
    steps.push(nextIncompleteStep(state, 'coach'));
    state = { ...state, username: 'test', dob: '2000-01-01', zip: '12345', step_2_visited: true };

    // Step 3: Basic info complete, need league
    steps.push(nextIncompleteStep(state, 'coach'));
    state = { ...state, step_3_visited: true };

    // Done: All steps complete
    steps.push(nextIncompleteStep(state, 'coach'));

    // Verify steps are: role(0) → basic(1) → league(2) → done(2)
    expect(steps).toEqual([0, 1, 2, 2]);
  });

  it('should maintain correct step order for fan onboarding', () => {
    const steps: number[] = [];
    let state: OnboardingState = {};

    // Step 1: No role yet
    steps.push(nextIncompleteStep(state, 'fan'));
    state = { ...state, role: 'fan' };

    // Step 2: Role selected, need basic info
    steps.push(nextIncompleteStep(state, 'fan'));
    state = { ...state, username: 'test', dob: '2000-01-01', zip: '12345', step_2_visited: true };

    // Done: Fans are done after step 2
    steps.push(nextIncompleteStep(state, 'fan'));

    // Verify steps are: role(0) → basic(1) → done(1)
    expect(steps).toEqual([0, 1, 1]);
  });
});
