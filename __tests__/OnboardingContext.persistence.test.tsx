import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { OBProvider, useOnboarding } from '@/context/OnboardingContext';

type OnboardingContextValue = ReturnType<typeof useOnboarding>;

let latestContext: OnboardingContextValue | null = null;

function Harness() {
  latestContext = useOnboarding();
  return null;
}

describe('OnboardingContext persistence', () => {
  beforeEach(async () => {
    latestContext = null;
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  async function renderProvider() {
    render(
      <OBProvider>
        <Harness />
      </OBProvider>
    );

    await waitFor(() => {
      expect(latestContext?.isLoaded).toBe(true);
    });
  }

  async function initializeReducer() {
    await act(async () => {
      latestContext?.hydrateFromServer({ role: 'fan' });
    });

    await waitFor(() => {
      expect(latestContext?.reducerState.initialized).toBe(true);
    });
  }

  it('persists canonical reducer snapshot when draft data changes without a step change', async () => {
    await renderProvider();
    await initializeReducer();

    await act(async () => {
      latestContext?.setState({
        role: 'coach',
        username: 'coachuser',
        step_2_visited: true,
      });
    });

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('onboarding_reducer_state');
      const snapshot = raw ? JSON.parse(raw) : null;

      expect(snapshot?.draftData).toMatchObject({
        role: 'coach',
        username: 'coachuser',
        step_2_visited: true,
      });
    });
  });

  it('persists completed step IDs even when current step index stays the same', async () => {
    await renderProvider();
    await initializeReducer();

    await act(async () => {
      latestContext?.dispatch({ type: 'RESTORE_COMPLETED_STEPS', stepIds: [2] });
    });

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('onboarding_reducer_state');
      const snapshot = raw ? JSON.parse(raw) : null;

      expect(snapshot?.completedStepIds).toEqual([2]);
    });
  });

  it('applies server nulls so cleared fields do not survive from local draft state', async () => {
    await renderProvider();
    await initializeReducer();

    await act(async () => {
      latestContext?.setState({
        role: 'coach',
        organization_id: 'org_123',
        pending_plan: 'legend',
      });
    });

    await act(async () => {
      latestContext?.hydrateFromServer({
        role: 'coach',
        organization_id: null,
        pending_plan: null,
      });
    });

    await waitFor(async () => {
      expect((latestContext?.state as any)?.organization_id).toBeNull();
      expect((latestContext?.state as any)?.pending_plan).toBeNull();

      const raw = await AsyncStorage.getItem('onboarding_state');
      const persisted = raw ? JSON.parse(raw) : null;

      expect(persisted?.organization_id).toBeNull();
      expect(persisted?.pending_plan).toBeNull();
    });
  });

  it('clears local-only step_3_visited during server hydration so stale completion cannot survive', async () => {
    await renderProvider();
    await initializeReducer();

    await act(async () => {
      latestContext?.setState({
        role: 'coach',
        organization_id: 'org_123',
        join_request_pending: true,
        step_3_visited: true,
      });
    });

    await act(async () => {
      latestContext?.hydrateFromServer({
        role: 'coach',
        organization_id: null,
        join_request_pending: false,
        step_3_visited: true,
      });
    });

    await waitFor(async () => {
      expect((latestContext?.state as any)?.organization_id).toBeNull();
      expect((latestContext?.state as any)?.join_request_pending).toBe(false);
      expect((latestContext?.state as any)?.step_3_visited).toBe(false);

      const raw = await AsyncStorage.getItem('onboarding_state');
      const persisted = raw ? JSON.parse(raw) : null;

      expect(persisted?.step_3_visited).toBe(false);
    });
  });
});
