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

  it('should return step 2 if role is selected but basic info is missing', () => {
    const state: OnboardingState = { role: 'coach' };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(1); // STEP_2_BASIC.index
  });

  it('should return step 3 for coach if step 2 is complete but plan is missing', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(2); // STEP_3_PLAN.index
  });

  it('should return step 4 for coach if step 3 is complete but organization is missing', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(3); // STEP_4_ORGANIZATION.index
  });

  it('should return step 6 for coach if steps 2-4 are complete', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
      team_id: 'team-123',
    };
    const result = nextIncompleteStep(state, 'coach');
    expect(result).toBe(4); // STEP_6_AUTHORIZED_USERS.index (note: step 5 doesn't exist)
  });

  it('should NOT skip to step 7 if step 6 has not been visited', () => {
    const state: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
      plan: 'rookie',
      team_id: 'team-123',
    };
    const result = nextIncompleteStep(state, 'coach');
    // Should be step 6, not step 7
    expect(result).toBe(4); // STEP_6_AUTHORIZED_USERS.index
    expect(result).not.toBe(5); // STEP_7_PROFILE.index
  });

  it('should skip coach steps for fans and go to confirmation', () => {
    // Fans with completed step 2 (username, dob, zip) skip steps 3-6.
    // Step 7 is "complete" because username is set.
    // Steps 8 and 9 are optional (always return true).
    // So the next incomplete step is step 10 (confirmation).
    const state: OnboardingState = {
      role: 'fan',
      username: 'testuser',
      dob: '2000-01-01',
      zip: '12345',
    };
    const result = nextIncompleteStep(state, 'fan');
    expect(result).toBe(8); // STEP_10_CONFIRMATION.index (step 7 is already satisfied by username)
  });

  it('should enforce step order for coaches - never jump ahead', () => {
    // Even if progress says step 7, should return to first incomplete step
    const incompleteState: OnboardingState = {
      role: 'coach',
      username: 'testuser',
      // Missing dob and zip - should return to step 2
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
    // Start with no role - step 1 will be the first incomplete step
    let state: OnboardingState = {};

    // Simulate completing each step
    steps.push(nextIncompleteStep(state, 'coach')); // Should be step 2 (role already set)
    state = { ...state, role: 'coach' };

    // Step 2: Role selected, need basic info
    steps.push(nextIncompleteStep(state, 'coach')); // Should be step 2 (index 1)
    state = { ...state, username: 'test', dob: '2000-01-01', zip: '12345' };

    // Step 3: Basic info complete, need plan
    steps.push(nextIncompleteStep(state, 'coach')); // Should be step 3 (index 2)
    state = { ...state, plan: 'rookie' };

    // Step 4: Plan selected, need organization
    steps.push(nextIncompleteStep(state, 'coach')); // Should be step 4 (index 3)
    state = { ...state, team_id: 'team-123' };

    // Step 6: Organization created, need to visit step 6
    steps.push(nextIncompleteStep(state, 'coach')); // Should be step 6 (index 4)

    // Verify steps are in order and no steps are skipped
    expect(steps).toEqual([1, 1, 2, 3, 4]); // step 2, 2, 3, 4, 6
    // Verify step 7 (index 5) is NOT in the sequence
    expect(steps).not.toContain(5); // STEP_7_PROFILE.index
  });
});
