/**
 * Unit tests for onboarding reducer and step calculation
 */

import { nextIncompleteStep, onboardingReducer, createInitialState, OnboardingReducerState } from '../context/onboardingReducer';
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
    expect(result).toBe(2); // STEP_3_PLAN.index
  });

  it('should return step 4 for coach if step 3 visited but step 4 not visited', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
      step_2_visited: true,
      step_3_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(3); // STEP_4_ORGANIZATION.index
  });

  it('should return step 6 for coach if steps 2-5 are complete', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
      team_id: 'team-123',
      step_2_visited: true,
      step_3_visited: true,
      step_4_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(5); // STEP_6_AUTHORIZED_USERS.index
  });

  it('should NOT skip to step 7 if step 6 has not been visited', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
      team_id: 'team-123',
      step_2_visited: true,
      step_3_visited: true,
      step_4_visited: true,
    };
    const result = nextIncompleteStep(state, 'coach');
    // Should be step 6, not step 7
    expect(result).toBe(5); // STEP_6_AUTHORIZED_USERS.index
    expect(result).not.toBe(6); // STEP_7_PROFILE.index
  });

  it('should skip coach steps for fans and go to profile then confirmation', () => {
    const state: OnboardingState = {
      role: 'fan',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      step_2_visited: true,
    };
    const result = nextIncompleteStep(state, 'fan');
    // Fans skip steps 3-6, so next incomplete is step 7 (profile)
    expect(result).toBe(6); // STEP_7_PROFILE.index
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
      currentStepIndex: 4,
      draftData: {
        role: 'coach',
        username: 'testuser',
        plan: 'rookie',
        team_id: 'team-123',
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
    // Should not change step if saving
    expect(newState.currentStepIndex).toBe(1);
  });

  it('should handle SAVE_START and SAVE_SUCCESS', async () => {
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

    // Step 3: Basic info complete, need plan
    steps.push(nextIncompleteStep(state, 'coach'));
    state = { ...state, plan: 'rookie', step_3_visited: true };

    // Step 4: Plan selected, need organization
    steps.push(nextIncompleteStep(state, 'coach'));
    state = { ...state, step_4_visited: true, team_id: 'team-123' };

    // Step 6: Team created, need to visit authorized users
    steps.push(nextIncompleteStep(state, 'coach'));

    // Verify steps are in order
    expect(steps).toEqual([0, 1, 2, 3, 5]); // no_role->role, role->basic, basic->plan, plan->org, org->auth_users
    // Verify step 7 (index 6) is NOT in the sequence yet
    expect(steps).not.toContain(6);
  });
});
