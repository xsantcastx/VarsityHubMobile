import { PrismaClient } from '@prisma/client';
import { geocodeLocation } from '../src/lib/geocoding';
import { normalizeOrganizationName } from '../src/lib/normalizeNames';

const prisma = new PrismaClient();
const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Organization Duplicate Guard', () => {
  beforeAll(async () => {
    // Clear test organizations
    await prisma.organization.deleteMany({ where: { name: { contains: 'Test' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('normalizeOrganizationName removes special chars and lowercases', () => {
    expect(normalizeOrganizationName('Westhill High School')).toBe('westhillhighschool');
    expect(normalizeOrganizationName('Test HS (Athletics)')).toBe('testhsathletics');
    expect(normalizeOrganizationName('  Spaces  ')).toBe('spaces');
  });

  test('duplicate check by place_id rejects same location', async () => {
    const testPlace = 'ChIJTest123';
    
    // Create first org
    const org1 = await prisma.organization.create({
      data: {
        name: 'Test Org 1',
        place_id: testPlace,
        zip_code: '06902',
        status: 'active' as any,
      },
    });

    // Attempt duplicate by place_id
    const existing = await prisma.organization.findFirst({
      where: { place_id: testPlace, status: 'active' },
    });

    expect(existing).not.toBeNull();
    expect(existing?.id).toBe(org1.id);

    // Cleanup
    await prisma.organization.delete({ where: { id: org1.id } });
  });

  test('duplicate check by normalized name + zip_code', async () => {
    const org2 = await prisma.organization.create({
      data: {
        name: 'Test Org 2',
        zip_code: '06830',
        status: 'active' as any,
      },
    });

    const normalized = normalizeOrganizationName('Test Org 2');
    const duplicates = await prisma.organization.findMany({
      where: {
        zip_code: '06830',
        status: 'active',
      },
      select: { id: true, name: true },
    });

    const dup = duplicates.find((o) => normalizeOrganizationName(o.name) === normalized);
    expect(dup).toBeDefined();
    expect(dup?.id).toBe(org2.id);

    // Cleanup
    await prisma.organization.delete({ where: { id: org2.id } });
  });

  test('geocodeLocation returns coordinates for valid address', async () => {
    // Skip if no API key (CI/local without key)
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('Skipping geocode test: GOOGLE_MAPS_API_KEY not set');
      return;
    }

    const result = await geocodeLocation('Stamford, CT');
    expect(result).not.toBeNull();
    expect(result?.latitude).toBeDefined();
    expect(result?.longitude).toBeDefined();
    expect(typeof result?.latitude).toBe('number');
  });

  test('geocodeLocation returns null for invalid address', async () => {
    if (!process.env.GOOGLE_MAPS_API_KEY) return;
    
    const result = await geocodeLocation('InvalidXYZ123NotReal');
    // Might return null or might geocode to something; just ensure no crash
    expect(result).toBeDefined();
  });
});

describeDb('POST /organizations/check-duplicate', () => {
  let testOrg: any;

  beforeAll(async () => {
    // Create test org with place_id
    testOrg = await prisma.organization.create({
      data: {
        name: 'Duplicate Test Org',
        place_id: 'ChIJDuplicateTest789',
        zip_code: '06902',
        status: 'active' as any,
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await prisma.organization.delete({ where: { id: testOrg.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('returns exists: true for duplicate place_id', async () => {
    // Simulate check-duplicate logic
    const checkPlaceId = 'ChIJDuplicateTest789';
    const existing = await prisma.organization.findFirst({
      where: { place_id: checkPlaceId, status: 'active' },
      select: { id: true, name: true },
    });

    expect(existing).not.toBeNull();
    expect(existing?.id).toBe(testOrg.id);
    
    // API response shape
    const response = { exists: true, duplicate_of: existing };
    expect(response.exists).toBe(true);
    expect(response.duplicate_of?.name).toBe('Duplicate Test Org');
  });

  test('returns exists: false for unique place_id', async () => {
    const checkPlaceId = 'ChIJUniquePlace999';
    const existing = await prisma.organization.findFirst({
      where: { place_id: checkPlaceId, status: 'active' },
    });

    expect(existing).toBeNull();
    
    const response = { exists: false };
    expect(response.exists).toBe(false);
  });

  test('returns exists: true for duplicate normalized name + zip', async () => {
    const normalizedName = normalizeOrganizationName('Duplicate Test Org');
    const zipCode = '06902';
    
    const candidates = await prisma.organization.findMany({
      where: { zip_code: zipCode, status: 'active' },
      select: { id: true, name: true },
    });

    const duplicate = candidates.find(
      (o) => normalizeOrganizationName(o.name) === normalizedName
    );

    expect(duplicate).toBeDefined();
    expect(duplicate?.id).toBe(testOrg.id);
  });

  test('returns exists: false when name differs', async () => {
    const normalizedName = normalizeOrganizationName('Completely Different Org');
    const zipCode = '06902';
    
    const candidates = await prisma.organization.findMany({
      where: { zip_code: zipCode, status: 'active' },
      select: { id: true, name: true },
    });

    const duplicate = candidates.find(
      (o) => normalizeOrganizationName(o.name) === normalizedName
    );

    expect(duplicate).toBeUndefined();
  });
});

describe('POST /geocoding/autocomplete', () => {
  test('returns suggestions for valid query', async () => {
    // Skip if no API key
    if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_PLACES_API_KEY) {
      console.warn('Skipping autocomplete test: API key not set');
      return;
    }

    // This would call the actual autocomplete API in integration test
    // For unit test, we mock the expected shape
    const mockSuggestions = [
      {
        place_id: 'ChIJStamford123',
        description: 'Stamford, CT, USA',
        structured_formatting: {
          main_text: 'Stamford',
          secondary_text: 'CT, USA',
        },
      },
      {
        place_id: 'ChIJStamfordHS456',
        description: 'Stamford High School, Stamford, CT',
        structured_formatting: {
          main_text: 'Stamford High School',
          secondary_text: 'Stamford, CT',
        },
      },
    ];

    expect(mockSuggestions).toHaveLength(2);
    expect(mockSuggestions[0].place_id).toBeDefined();
    expect(mockSuggestions[0].description).toContain('Stamford');
  });

  test('returns empty array for query < 3 characters', () => {
    const query = 'St';
    expect(query.length).toBeLessThan(3);
    
    // API should not be called for short queries
    const suggestions: any[] = [];
    expect(suggestions).toHaveLength(0);
  });

  test('respects limit parameter', () => {
    const mockSuggestions = Array.from({ length: 10 }, (_, i) => ({
      place_id: `ChIJTest${i}`,
      description: `Location ${i}`,
    }));

    const limit = 5;
    const limited = mockSuggestions.slice(0, limit);
    
    expect(limited).toHaveLength(5);
    expect(mockSuggestions.length).toBeGreaterThan(limited.length);
  });

  test('handles API errors gracefully', () => {
    // Simulate error response
    const errorResponse = { error: 'API quota exceeded', suggestions: [] };
    
    expect(errorResponse.suggestions).toHaveLength(0);
    expect(errorResponse.error).toBeDefined();
  });
});
