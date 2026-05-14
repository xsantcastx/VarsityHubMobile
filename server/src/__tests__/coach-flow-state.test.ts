import { describe, expect, it } from '@jest/globals';
import { getCoachFlowState } from '../lib/coachApplications.js';

describe('getCoachFlowState', () => {
  it('keeps a newly submitted coach application on the waiting screen', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'PENDING',
        onboarding_completed: false,
        proceeding_as_fan: false,
      },
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

  it('lets a rejected applicant continue as a fan without pretending onboarding is complete', () => {
    const state = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'REJECTED',
        onboarding_completed: false,
        proceeding_as_fan: true,
      },
      {
        id: 'app_2',
        status: 'rejected',
        organization_name: 'Westhill',
        org_type: 'school',
        location: 'Stamford, CT',
        zip_code: '06902',
        place_id: null,
        supporting_document_url: null,
        background_url: null,
        payload: {},
        submitted_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
        review_note: 'Need better documentation',
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    expect(state).toEqual({
      account_state: 'coach_application_rejected',
      next_step: '/(tabs)',
    });
  });

  it('treats approved coaches as active without extra agreement or setup gates', () => {
    const firstApprovedState = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'APPROVED',
        onboarding_completed: false,
        organization_id: null,
        coach_agreement_accepted_at: null,
      },
      {
        id: 'app_3',
        status: 'approved',
        organization_name: 'Westhill',
        org_type: 'school',
        location: 'Stamford, CT',
        zip_code: '06902',
        place_id: null,
        supporting_document_url: null,
        background_url: null,
        payload: {},
        submitted_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
        review_note: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    expect(firstApprovedState).toEqual({
      account_state: 'coach_active',
      next_step: '/(tabs)',
    });

    const secondApprovedState = getCoachFlowState(
      {
        role: 'coach',
        approval_status: 'APPROVED',
        onboarding_completed: false,
        organization_id: null,
        coach_agreement_accepted_at: new Date(),
      },
      {
        id: 'app_3',
        status: 'approved',
        organization_name: 'Westhill',
        org_type: 'school',
        location: 'Stamford, CT',
        zip_code: '06902',
        place_id: null,
        supporting_document_url: null,
        background_url: null,
        payload: {},
        submitted_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: 'admin_1',
        review_note: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    expect(secondApprovedState).toEqual({
      account_state: 'coach_active',
      next_step: '/(tabs)',
    });
  });
});
