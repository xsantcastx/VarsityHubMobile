import { describe, expect, it } from '@jest/globals';
import { getCoachFlowState } from '../lib/coachApplications.js';

describe('getCoachFlowState', () => {
  const buildApplication = (
    overrides: Partial<Parameters<typeof getCoachFlowState>[1]> = {}
  ): Parameters<typeof getCoachFlowState>[1] => ({
    id: 'app_1',
    status: 'submitted',
    organization_name: 'Westhill',
    org_type: 'school',
    location: 'Stamford, CT',
    zip_code: '06902',
    place_id: null,
    supporting_document_url: null,
    background_url: null,
    payload: {} as any,
    submitted_at: new Date(),
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  const buildJoinRequest = (
    overrides: Partial<NonNullable<Parameters<typeof getCoachFlowState>[2]>> = {}
  ): NonNullable<Parameters<typeof getCoachFlowState>[2]> => ({
    id: 'join_1',
    organization_id: 'org_1',
    user_id: 'user_1',
    status: 'pending',
    message: 'Would love to help coach.',
    rejection_reason: null,
    created_at: new Date(),
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  });

  it('keeps a newly submitted coach application on the waiting screen', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        proceeding_as_fan: false,
      },
      buildApplication()
    );

    expect(state).toEqual({
      account_state: 'coach_application_submitted',
      next_step: '/onboarding/league-pending-approval',
    });
  });

  it('lets a pending applicant continue as a fan when proceeding_as_fan is set', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        proceeding_as_fan: true,
      },
      buildApplication()
    );

    expect(state).toEqual({
      account_state: 'coach_application_submitted',
      next_step: '/(tabs)',
    });
  });

  it('prefers the canonical proceeding_as_fan column over stale preferences', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        proceeding_as_fan: true,
        preferences: {
          role: 'fan',
          proceeding_as_fan: false,
        },
      } as any,
      {
        id: 'app_1',
        status: 'submitted',
        organization_name: 'Westhill',
        org_type: 'school',
        location: 'Stamford, CT',
        zip_code: '06902',
        place_id: null,
        supporting_document_url: null,
        background_url: null,
        payload: {},
        submitted_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
        review_note: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    expect(state).toEqual({
      account_state: 'coach_application_submitted',
      next_step: '/(tabs)',
    });
  });

  it('routes pending coaches with incomplete basics back to step 2 before the application flow', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        username: '',
        preferences: { role: 'coach' },
        proceeding_as_fan: false,
      },
      null
    );

    expect(state).toEqual({
      account_state: 'coach_basic_info_required',
      next_step: '/onboarding/step-2-basic',
    });
  });

  it('routes pending coaches with complete basics into the application flow', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        username: 'coachuser',
        date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
        preferences: { role: 'coach', zip_code: '06902' },
        proceeding_as_fan: false,
      },
      null
    );

    expect(state).toEqual({
      account_state: 'coach_application_required',
      next_step: '/onboarding/coach-application',
    });
  });

  it('routes an existing-organization join request to the join waiting screen', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        organization_id: 'org_1',
        proceeding_as_fan: false,
      },
      null,
      buildJoinRequest()
    );

    expect(state).toEqual({
      account_state: 'coach_pending_approval',
      next_step: '/onboarding/pending-approval',
    });
  });

  it('lets a rejected applicant continue as a fan without pretending onboarding is complete', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'REJECTED',
        onboarding_completed: false,
        proceeding_as_fan: true,
      },
      buildApplication({
        id: 'app_2',
        status: 'rejected',
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
        review_note: 'Need better documentation',
      })
    );

    expect(state).toEqual({
      account_state: 'coach_application_rejected',
      next_step: '/(tabs)',
    });
  });

  it('keeps an org-backed pending coach in fan mode on tabs', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        organization_id: 'org_123',
        proceeding_as_fan: true,
      },
      null
    );

    expect(state).toEqual({
      account_state: 'coach_pending_approval',
      next_step: '/(tabs)',
    });
  });

  it('prefers the canonical proceeding_as_fan column for org-backed pending coaches', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        organization_id: 'org_123',
        proceeding_as_fan: true,
        preferences: {
          role: 'fan',
          organization_id: 'org_123',
          proceeding_as_fan: false,
        },
      } as any,
      null
    );

    expect(state).toEqual({
      account_state: 'coach_pending_approval',
      next_step: '/(tabs)',
    });
  });

  it('routes a denied organization join request back to the join review screen', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'REJECTED',
        onboarding_completed: false,
        organization_id: 'org_1',
        proceeding_as_fan: false,
      },
      null,
      buildJoinRequest({
        status: 'denied',
        reviewed_at: new Date(),
        reviewed_by: 'owner_1',
        rejection_reason: 'Roster is full',
      })
    );

    expect(state).toEqual({
      account_state: 'coach_pending_approval',
      next_step: '/onboarding/pending-approval',
    });
  });

  it('routes approved coaches without an accepted agreement to the agreement step', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'APPROVED',
        onboarding_completed: false,
        organization_id: null,
        coach_agreement_accepted_at: null,
        coach_agreement_version: null,
      },
      buildApplication({
        id: 'app_3',
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
      })
    );

    expect(state).toEqual({
      account_state: 'coach_agreement_required',
      next_step: '/onboarding/coach-agreement',
    });
  });

  it('routes approved coaches with an accepted agreement but no organization to final setup', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'APPROVED',
        onboarding_completed: false,
        organization_id: null,
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
      },
      buildApplication({
        id: 'app_3',
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
      })
    );

    expect(state).toEqual({
      account_state: 'coach_final_setup_required',
      next_step: '/onboarding/step-3-league',
    });
  });

  it('treats approved coaches with an accepted agreement and organization as active', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'APPROVED',
        onboarding_completed: true,
        organization_id: 'org_approved',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
      },
      buildApplication({
        id: 'app_3',
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
      })
    );

    expect(state).toEqual({
      account_state: 'coach_active',
      next_step: '/(tabs)',
    });
  });
});
