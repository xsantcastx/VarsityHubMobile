import {
    calculateDistance,
    verifyEventPostingPermission,
    verifyStoryCreationPermission,
} from '../src/lib/geofencing.js';
import { prisma } from '../src/lib/prisma.js';

type MockEvent = {
  id: string;
  title: string;
  date: Date;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
};

type MockGame = MockEvent;

type TestResult = {
  scenario: string;
  contentType: 'story' | 'post';
  distance_km: number;
  time_offset_hours: number;
  expected: boolean;
  result: boolean;
  passed: boolean;
  reason?: string;
};

const mockEvents = new Map<string, MockEvent>();
const mockGames = new Map<string, MockGame>();
const testResults: TestResult[] = [];

// Monkey-patch Prisma delegates
const eventDelegate = prisma.event as unknown as {
  findUnique: (args: any) => Promise<MockEvent | null>;
};
eventDelegate.findUnique = async (args: any) => {
  const id = args?.where?.id;
  return (id && mockEvents.get(id)) || null;
};

const gameDelegate = prisma.game as unknown as {
  findUnique: (args: any) => Promise<MockGame | null>;
};
gameDelegate.findUnique = async (args: any) => {
  const id = args?.where?.id;
  return (id && mockGames.get(id)) || null;
};

function kmToLatOffset(km: number): number {
  return km / 111.0; // 1 degree latitude ≈ 111 km
}

function setMockEvent(data: MockEvent) {
  mockEvents.set(data.id, data);
}

function setMockGame(data: MockGame) {
  mockGames.set(data.id, data);
}

async function testStoryCreation(
  distance_km: number,
  time_offset_hours: number,
  expected: boolean,
): Promise<void> {
  const eventTime = new Date(Date.now() + time_offset_hours * 60 * 60 * 1000);
  const eventId = `story-event-${distance_km}-${time_offset_hours}`;

  const mock = {
    id: eventId,
    title: `Story Test Event`,
    date: eventTime,
    latitude: 40.7128,
    longitude: -74.006,
    location: 'Test Venue',
  } satisfies MockEvent;

  setMockEvent(mock);
  setMockGame(mock);

  const userLat = 40.7128 + kmToLatOffset(distance_km);
  const userLon = -74.006;

  try {
    const result = await verifyStoryCreationPermission(
      eventId,
      'test-user',
      userLat,
      userLon,
    );

    const passed = result.allowed === expected;
    testResults.push({
      scenario: `Story: ${distance_km}km, ${time_offset_hours > 0 ? '+' : ''}${time_offset_hours}h`,
      contentType: 'story',
      distance_km,
      time_offset_hours,
      expected,
      result: result.allowed,
      passed,
      reason: result.reason,
    });
  } catch (err) {
    testResults.push({
      scenario: `Story: ${distance_km}km, ${time_offset_hours > 0 ? '+' : ''}${time_offset_hours}h`,
      contentType: 'story',
      distance_km,
      time_offset_hours,
      expected,
      result: false,
      passed: false,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

async function testPostCreation(
  distance_km: number,
  time_offset_hours: number,
  expected: boolean,
): Promise<void> {
  const eventTime = new Date(Date.now() + time_offset_hours * 60 * 60 * 1000);
  const eventId = `post-event-${distance_km}-${time_offset_hours}`;

  const mock = {
    id: eventId,
    title: `Post Test Event`,
    date: eventTime,
    latitude: 34.0522,
    longitude: -118.2437,
    location: 'Test Arena',
  } satisfies MockEvent;

  setMockEvent(mock);
  setMockGame(mock);

  const userLat = 34.0522 + kmToLatOffset(distance_km);
  const userLon = -118.2437;

  try {
    const result = await verifyEventPostingPermission(
      eventId,
      'test-user',
      userLat,
      userLon,
    );

    const passed = result.allowed === expected;
    testResults.push({
      scenario: `Post: ${distance_km}km, ${time_offset_hours > 0 ? '+' : ''}${time_offset_hours}h`,
      contentType: 'post',
      distance_km,
      time_offset_hours,
      expected,
      result: result.allowed,
      passed,
      reason: result.reason,
    });
  } catch (err) {
    testResults.push({
      scenario: `Post: ${distance_km}km, ${time_offset_hours > 0 ? '+' : ''}${time_offset_hours}h`,
      contentType: 'post',
      distance_km,
      time_offset_hours,
      expected,
      result: false,
      passed: false,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runMatrixTests(): Promise<void> {
  console.log('🧪 Starting Edge-Case Matrix Runner...\n');

  // Story radius: 2km (event day only)
  const storyDistances = [0, 0.5, 1, 1.5, 2, 2.1, 2.5, 5, 10, 15, 20, 30];
  const storyTimeOffsets = [
    -24, -12, -6, -1, 0, 1, 6, 12, 24,
  ]; // Hours from event

  console.log('📍 Story Tests (2km radius, event day only)');
  for (const distance of storyDistances) {
    for (const timeOffset of storyTimeOffsets) {
      const now = new Date();
      const eventTime = new Date(Date.now() + timeOffset * 60 * 60 * 1000);
      const dayStart = new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate(), 23, 59, 59, 999);
      const sameDay = now >= dayStart && now <= dayEnd;
      const userLat = 40.7128 + kmToLatOffset(distance);
      const userLon = -74.006;
      const distanceKm = calculateDistance(userLat, userLon, 40.7128, -74.006, 'km');
      const withinRadius = distanceKm <= 2;
      const expected = sameDay && withinRadius;

      await testStoryCreation(distance, timeOffset, expected);
    }
  }

  console.log('\n📍 Post Tests (15km radius, 120h window: -48h to +72h)');
  // Post radius: 15km (48h before through 72h after)
  const postDistances = [0, 5, 10, 15, 15.1, 20, 25, 30];
  const postTimeOffsets = [-72, -60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60, 72];

  for (const distance of postDistances) {
    for (const timeOffset of postTimeOffsets) {
      const now = new Date();
      const eventTime = new Date(Date.now() + timeOffset * 60 * 60 * 1000);
      const windowOpenTime = new Date(eventTime.getTime() - 48 * 60 * 60 * 1000);
      const windowCloseTime = new Date(eventTime.getTime() + 48 * 60 * 60 * 1000);
      const userLat = 34.0522 + kmToLatOffset(distance);
      const userLon = -118.2437;
      const distanceKm = calculateDistance(userLat, userLon, 34.0522, -118.2437, 'km');

      let expected = true;
      if (now < windowOpenTime) {
        expected = false;
      } else if (now >= windowCloseTime) {
        expected = false;
      } else if (now > eventTime) {
        // After event: requires prior post (not mocked here) so expect rejection
        expected = false;
      } else if (distanceKm > 15) {
        expected = false;
      }

      await testPostCreation(distance, timeOffset, expected);
    }
  }

  // Print results summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY\n');

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Show failures
  if (failed > 0) {
    console.log('FAILURES:');
    console.log('-'.repeat(80));
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`${r.scenario}`);
        console.log(
          `  Expected: ${r.expected} | Got: ${r.result} | Reason: ${r.reason || 'None'}`,
        );
      });
    console.log('-'.repeat(80));
  }

  // Boundary analysis
  console.log('\nBOUNDARY ANALYSIS:');
  console.log('-'.repeat(80));

  const storyBoundaries = testResults
    .filter((r) => r.contentType === 'story' && r.time_offset_hours === 0)
    .sort((a, b) => a.distance_km - b.distance_km);

  const postBoundaries = testResults
    .filter((r) => r.contentType === 'post' && r.time_offset_hours === 0)
    .sort((a, b) => a.distance_km - b.distance_km);

  console.log('Story Distance Boundary (at event time):');
  storyBoundaries.forEach((r) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.distance_km}km: ${r.result ? 'ALLOWED' : 'BLOCKED'}`);
  });

  console.log('\nPost Distance Boundary (at event time):');
  postBoundaries.forEach((r) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.distance_km}km: ${r.result ? 'ALLOWED' : 'BLOCKED'}`);
  });

  // Time window analysis for posts at 15km
  console.log('\nPost Time Window (at 15km boundary):');
  const timeWindowTests = testResults
    .filter(
      (r) =>
        r.contentType === 'post' &&
        Math.abs(r.distance_km - 15) < 0.01,
    )
    .sort((a, b) => a.time_offset_hours - b.time_offset_hours);

  timeWindowTests.forEach((r) => {
    const status = r.passed ? '✅' : '❌';
    const timeStr = `${r.time_offset_hours > 0 ? '+' : ''}${r.time_offset_hours}h`;
    console.log(`  ${status} ${timeStr}: ${r.result ? 'ALLOWED' : 'BLOCKED'}`);
  });

  console.log('\n' + '='.repeat(80));
  process.exitCode = failed > 0 ? 1 : 0;
}

runMatrixTests()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
