import { jest } from '@jest/globals';
import {
    calculateDistance,
    isWithinGeofence,
    verifyEventPostingPermission,
    verifyStoryCreationPermission,
} from '../lib/geofencing.js';

type MockPrisma = {
  event: { findUnique: jest.Mock };
  game: { findUnique: jest.Mock };
  post: { findFirst: jest.Mock };
};

jest.mock('../lib/prisma.js', () => ({
  prisma: {
    event: { findUnique: jest.fn() },
    game: { findUnique: jest.fn() },
    post: { findFirst: jest.fn() },
  },
}));

jest.mock('../lib/geofence-telemetry.js', () => ({
  logRejection: jest.fn(),
}));

const prisma = (await import('../lib/prisma.js')).prisma as unknown as MockPrisma;

describe('geofencing utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-10T12:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calculates realistic distances', () => {
    const miles = calculateDistance(34.0522, -118.2437, 36.1699, -115.1398, 'miles');
    expect(miles).toBeGreaterThan(220);
    expect(miles).toBeLessThan(280);
  });

  it('checks geofence radius', () => {
    expect(isWithinGeofence(34.0522, -118.2437, 34.0522, -118.25, 1)).toBe(true);
    expect(isWithinGeofence(34.0522, -118.2437, 34.20, -118.2437, 1)).toBe(false);
  });

  describe('verifyEventPostingPermission', () => {
    const baseEvent = {
      id: 'evt_1',
      title: 'Championship',
      date: '2025-01-12T18:00:00Z',
      latitude: 34.05,
      longitude: -118.25,
      location: 'LA Coliseum',
    } as const;

    it('rejects when event is missing', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      const result = await verifyEventPostingPermission('evt_missing', 'user1', 34.05, -118.25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Event not found/i);
    });

    it('rejects before posting window opens', async () => {
      prisma.event.findUnique.mockResolvedValue(baseEvent);
      jest.setSystemTime(new Date('2025-01-09T10:00:00Z'));
      const result = await verifyEventPostingPermission('evt_1', 'user1', 34.05, -118.25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Posting opens 48 hours/i);
    });

    it('rejects when location is missing', async () => {
      prisma.event.findUnique.mockResolvedValue(baseEvent);
      jest.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      const result = await verifyEventPostingPermission('evt_1', 'user1', null, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Location access required/i);
    });

    it('rejects when user is outside 15km radius', async () => {
      prisma.event.findUnique.mockResolvedValue(baseEvent);
      jest.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      const result = await verifyEventPostingPermission('evt_1', 'user1', 34.40, -118.25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/15km/i);
      expect(result.distance).toBeGreaterThan(15);
    });

    it('allows posting inside window and radius', async () => {
      prisma.event.findUnique.mockResolvedValue(baseEvent);
      jest.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      const result = await verifyEventPostingPermission('evt_1', 'user1', 34.049, -118.251);
      expect(result.allowed).toBe(true);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThan(2);
    });
  });

  describe('verifyStoryCreationPermission', () => {
    const baseGame = {
      id: 'game_1',
      title: 'Semifinal',
      date: '2025-01-10T18:00:00Z',
      latitude: 34.05,
      longitude: -118.25,
      location: 'LA Coliseum',
    } as const;

    it('rejects when not on event day', async () => {
      prisma.game.findUnique.mockResolvedValue(baseGame);
      jest.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      const result = await verifyStoryCreationPermission('game_1', 'user1', 34.05, -118.25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Stories are available only on the day/i);
    });

    it('rejects when location missing', async () => {
      prisma.game.findUnique.mockResolvedValue(baseGame);
      jest.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      const result = await verifyStoryCreationPermission('game_1', 'user1', null, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Location required/i);
    });

    it('rejects when outside 2km radius', async () => {
      prisma.game.findUnique.mockResolvedValue(baseGame);
      jest.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      const result = await verifyStoryCreationPermission('game_1', 'user1', 34.08, -118.25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/2km/i);
    });

    it('allows story when on event day within radius', async () => {
      prisma.game.findUnique.mockResolvedValue(baseGame);
      jest.setSystemTime(new Date('2025-01-10T12:00:00Z'));
      const result = await verifyStoryCreationPermission('game_1', 'user1', 34.049, -118.251);
      expect(result.allowed).toBe(true);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThan(2);
    });
  });
});
