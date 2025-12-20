export type SeedOrganization = {
  id: string;
  name: string;
  description: string;
  formatted_address: string;
  location?: string;
  org_type?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  teams?: number;
  members?: number;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const SEEDED_ORGANIZATIONS: SeedOrganization[] = [
  {
    id: 'seed-westhill-high-school',
    name: 'Westhill High School',
    description: 'Home of the Vikings — official athletics hub for Westhill High School in Stamford, Connecticut.',
    formatted_address: '125 Roxbury Rd, Stamford, CT 06902',
    location: 'Stamford, CT',
    org_type: 'school',
    zip_code: '06902',
    latitude: 41.0924,
    longitude: -73.5749,
    teams: 22,
    members: 140,
  },
];

export const ensureSeededOrganizations = <T extends { id: string; name: string }>(
  orgs: T[]
): T[] => {
  const normalized = new Set(orgs.map((org) => normalize(org.name)));
  const additions = SEEDED_ORGANIZATIONS.filter(
    (seed) => !normalized.has(normalize(seed.name))
  ).map((seed) => ({
    ...(seed as any),
    _count: seed.teams || seed.members ? {
      teams: seed.teams ?? 0,
      memberships: seed.members ?? 0,
    } : undefined,
  }));
  return orgs.concat(additions as T[]);
};

export const findSeedOrganization = (identifier?: string | null) => {
  if (!identifier) return null;
  const id = identifier.toLowerCase();
  return (
    SEEDED_ORGANIZATIONS.find((seed) => seed.id === id) ||
    SEEDED_ORGANIZATIONS.find((seed) => normalize(seed.name) === normalize(identifier))
  ) || null;
};

export const seedOrganizationToPayload = (seed: SeedOrganization) => ({
  id: seed.id,
  name: seed.name,
  description: seed.description,
  formatted_address: seed.formatted_address,
  location: seed.location,
  org_type: seed.org_type,
  zip_code: seed.zip_code,
  latitude: seed.latitude,
  longitude: seed.longitude,
  status: 'active',
  _count: seed.teams || seed.members ? {
    teams: seed.teams ?? 0,
    memberships: seed.members ?? 0,
  } : undefined,
});
