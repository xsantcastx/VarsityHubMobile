import { prisma } from '../src/lib/prisma.js';
import {
  verifyEventPostingPermission,
  verifyStoryCreationPermission,
} from '../src/lib/geofencing.js';

type MockEvent = {
  id: string;
  title: string;
  date: Date;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
};

type MockGame = {
  id: string;
  title: string;
  date: Date;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
};

const mockEvents = new Map<string, MockEvent>();
const mockGames = new Map<string, MockGame>();

// Monkey-patch Prisma delegates so we can supply mock data without a database
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

function setMockEvent(data: MockEvent) {
  mockEvents.set(data.id, data);
}

function setMockGame(data: MockGame) {
  mockGames.set(data.id, data);
}

function kmToLatOffset(km: number) {
  return km / 111;
}

async function runScenarios() {
  console.log('\n=== Story Scenarios ===');
  const storyGameId = 'game-123';
  const storyEventDate = new Date();

  setMockGame({
    id: storyGameId,
    title: 'Sample Game',
    date: storyEventDate,
    latitude: 40.7128,
    longitude: -74.006,
    location: 'Sample Venue',
  });

  const within2km = {
    lat: 40.7128 + kmToLatOffset(1),
    lon: -74.006,
  };

  const outside2km = {
    lat: 40.7128 + kmToLatOffset(5),
    lon: -74.006,
  };

  const storyInside = await verifyStoryCreationPermission(
    storyGameId,
    'user-1',
    within2km.lat,
    within2km.lon,
  );
  console.log('Story within 2km:', storyInside);

  const storyOutside = await verifyStoryCreationPermission(
    storyGameId,
    'user-1',
    outside2km.lat,
    outside2km.lon,
  );
  console.log('Story outside 2km:', storyOutside);

  // Day-before scenario (event tomorrow -> rejects today)
  setMockGame({
    id: 'game-early',
    title: 'Tomorrow Game',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    latitude: 40.7128,
    longitude: -74.006,
    location: 'Tomorrow Venue',
  });
  const storyBefore = await verifyStoryCreationPermission(
    'game-early',
    'user-1',
    within2km.lat,
    within2km.lon,
  );
  console.log('Story day before event:', storyBefore);

  console.log('\n=== Event Post Scenarios ===');
  const eventId = 'event-123';
  setMockEvent({
    id: eventId,
    title: 'Current Event',
    date: new Date(),
    latitude: 34.0522,
    longitude: -118.2437,
    location: 'Downtown Arena',
  });

  const within15km = {
    lat: 34.0522 + kmToLatOffset(5),
    lon: -118.2437,
  };
  const outside15km = {
    lat: 34.0522 + kmToLatOffset(25),
    lon: -118.2437,
  };

  const postInside = await verifyEventPostingPermission(
    eventId,
    'user-1',
    within15km.lat,
    within15km.lon,
  );
  console.log('Post within window & 15km:', postInside);

  const postOutside = await verifyEventPostingPermission(
    eventId,
    'user-1',
    outside15km.lat,
    outside15km.lon,
  );
  console.log('Post outside 15km:', postOutside);

  // Before window (event 3 days in future)
  setMockEvent({
    id: 'event-future',
    title: 'Future Event',
    date: new Date(Date.now() + 72 * 60 * 60 * 1000),
    latitude: 34.0522,
    longitude: -118.2437,
    location: 'Future Arena',
  });
  const postBeforeWindow = await verifyEventPostingPermission(
    'event-future',
    'user-1',
    within15km.lat,
    within15km.lon,
  );
  console.log('Post 72h before event (should fail):', postBeforeWindow);

  // After window (event 3 days ago)
  setMockEvent({
    id: 'event-past',
    title: 'Past Event',
    date: new Date(Date.now() - 72 * 60 * 60 * 1000),
    latitude: 34.0522,
    longitude: -118.2437,
    location: 'Past Arena',
  });
  const postAfterWindow = await verifyEventPostingPermission(
    'event-past',
    'user-1',
    within15km.lat,
    within15km.lon,
  );
  console.log('Post 72h after event (should fail):', postAfterWindow);
}

runScenarios()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
