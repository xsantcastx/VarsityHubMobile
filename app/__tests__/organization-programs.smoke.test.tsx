/**
 * Render smoke test for the org detail screen (app/organizations/[id].tsx).
 * Real (non-seed) organizations redirect straight to /organization, so this
 * screen's Teams section only actually renders for seed/demo orgs — but the
 * sport-program grouping added on top of the legacy "Group X" description
 * sectioning is exercised here against a mocked seed org so a future org
 * landing on this route (or a seed org backfilled with programs) is covered.
 * See app/__tests__/organization.smoke.test.tsx for the primary
 * (tabs)/organization.tsx coverage.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  saveToLibraryAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: require('@/test-utils/screenMocks').hostPassthrough('QRCode'),
}));
jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  default: require('@/test-utils/screenMocks').hostPassthrough('ViewShot'),
}));
jest.mock('@/hooks/useShareLink', () => ({
  useShareLink: () => ({ share: jest.fn(), copyLink: jest.fn(), webUrl: null }),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  useLocalSearchParams: () => ({ id: 'seed1' }),
}));

const mockOrgGet = jest.fn();
const mockPrograms = jest.fn();
const mockFindSeedOrganization = jest.fn();
const mockSeedOrganizationToPayload = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Organization: {
    get: (...args: any[]) => mockOrgGet(...args),
    programs: (...args: any[]) => mockPrograms(...args),
  },
}));
jest.mock('@/data/seedOrganizations', () => ({
  findSeedOrganization: (...args: any[]) => mockFindSeedOrganization(...args),
  seedOrganizationToPayload: (...args: any[]) => mockSeedOrganizationToPayload(...args),
}));

import OrganizationDetailScreen from '../organizations/[id]';
import { QueryWrapper } from '../../test-utils/screenMocks';

const seedOrg = { id: 'seed1', name: 'Seed Org' };

const groupedTeamA = {
  id: 't1',
  name: 'Varsity Tigers',
  sport: 'Basketball',
  level: 'varsity',
  program_id: 'prog1',
};

const groupedTeamB = {
  id: 't2',
  name: 'JV Tigers',
  sport: 'Basketball',
  level: 'jv',
  program_id: 'prog1',
};

const ungroupedTeam = {
  id: 't3',
  name: 'Club Squad',
  sport: 'Soccer',
  level: null,
  program_id: null,
};

beforeEach(() => {
  mockOrgGet.mockReset().mockResolvedValue(seedOrg);
  mockFindSeedOrganization
    .mockReset()
    .mockImplementation((id: string) => (id === 'seed1' ? seedOrg : null));
  mockPrograms.mockReset().mockResolvedValue({
    programs: [{ id: 'prog1', sport: 'basketball', gender: 'girls', name: null, teams: [] }],
  });
});

describe('OrganizationDetailScreen (organizations/[id]) — program grouping', () => {
  it("fully-ungrouped org (no program_id on any team) renders today's flat team row, no program row", async () => {
    mockSeedOrganizationToPayload.mockReset().mockReturnValue({
      ...seedOrg,
      teams: [ungroupedTeam],
    });

    render(
      <QueryWrapper>
        <OrganizationDetailScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Club Squad')).toBeTruthy();
    expect(screen.queryByText('Girls Basketball')).toBeNull();
  });

  it('groups teams sharing a program_id into one program row, leaves the ungrouped team its own row', async () => {
    mockSeedOrganizationToPayload.mockReset().mockReturnValue({
      ...seedOrg,
      teams: [groupedTeamA, groupedTeamB, ungroupedTeam],
    });

    render(
      <QueryWrapper>
        <OrganizationDetailScreen />
      </QueryWrapper>
    );

    // One collapsed program row, not two per-team rows.
    expect(await screen.findByText('Girls Basketball')).toBeTruthy();
    await waitFor(() => expect(mockPrograms).toHaveBeenCalled());
    expect(screen.queryByText('Varsity Tigers')).toBeNull();
    expect(screen.queryByText('JV Tigers')).toBeNull();
    expect(await screen.findByText('2 teams · Varsity, JV')).toBeTruthy();

    // Ungrouped team keeps its own per-team row.
    expect(await screen.findByText('Club Squad')).toBeTruthy();
  });
});
