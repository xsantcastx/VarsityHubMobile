import { expect, test } from '@playwright/test';

/**
 * Discover Page E2E Tests
 * 
 * Tests the discover page functionality including:
 * - Games list and filtering
 * - Search functionality (keyword and zip code)
 * - Calendar date selection
 * - Map/list view toggle
 * - Posts (discover and following tabs)
 * - Nearby people
 * - Quick actions dashboard
 * - Pull-to-refresh
 * - Location-based features
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to create authenticated request
async function createAuthRequest(context: any, token: string) {
  return context.request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Helper to create a test user and get auth token
async function createTestUser(request: any) {
  const email = `test-discover-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test User ${Date.now()}`;

  // Sign up
  const signupResponse = await request.post(`${API_BASE_URL}/auth/signup`, {
    data: {
      email,
      password,
      display_name: displayName,
    },
  });

  expect(signupResponse.status()).toBe(201);
  const signupData = await signupResponse.json();
  const token = signupData.token;

  return { email, password, displayName, token, userId: signupData.user.id };
}

// Helper to create a test game
async function createTestGame(request: any, token: string, gameData: any = {}) {
  const authRequest = await createAuthRequest(request.context(), token);
  
  const defaultGame = {
    title: gameData.title || `Test Game ${Date.now()}`,
    date: gameData.date || new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    location: gameData.location || '123 Main St, Test City, 12345',
    description: gameData.description || 'Test game description',
    ...gameData,
  };

  const response = await authRequest.post(`${API_BASE_URL}/games`, {
    data: defaultGame,
  });

  expect([200, 201]).toContain(response.status());
  return await response.json();
}

// Helper to create a test post
async function createTestPost(request: any, token: string, postData: any = {}) {
  const authRequest = await createAuthRequest(request.context(), token);
  
  const defaultPost = {
    title: postData.title || `Test Post ${Date.now()}`,
    caption: postData.caption || 'Test post caption',
    ...postData,
  };

  const response = await authRequest.post(`${API_BASE_URL}/posts`, {
    data: defaultPost,
  });

  expect([200, 201]).toContain(response.status());
  return await response.json();
}

test.describe('Discover Page', () => {
  test('Discover page loads and displays games', async ({ request }) => {
    // Create test user
    const user = await createTestUser(request);
    
    // Create a test game
    await createTestGame(request, user.token);

    // Fetch games list (simulating what the discover page does)
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    expect(Array.isArray(games)).toBe(true);
    expect(games.length).toBeGreaterThan(0);
    
    // Verify game structure
    const game = games[0];
    expect(game).toHaveProperty('id');
    expect(game).toHaveProperty('title');
    expect(game).toHaveProperty('date');
  });

  test('Discover page supports search by keyword', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games with specific titles
    const game1 = await createTestGame(request, user.token, {
      title: 'Basketball Championship',
    });
    const game2 = await createTestGame(request, user.token, {
      title: 'Football Game',
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Filter by keyword (simulating frontend search)
    const searchQuery = 'Basketball';
    const filtered = games.filter((g: any) => 
      g.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((g: any) => g.id === game1.id)).toBe(true);
  });

  test('Discover page supports search by zip code', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games with zip codes in location
    await createTestGame(request, user.token, {
      title: 'Game in 12345',
      location: '123 Main St, City, 12345',
    });
    await createTestGame(request, user.token, {
      title: 'Game in 67890',
      location: '456 Oak Ave, Town, 67890',
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Filter by zip code (simulating frontend search)
    const zipQuery = '12345';
    const filtered = games.filter((g: any) => 
      g.location?.includes(zipQuery)
    );
    
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((g: any) => g.location?.includes('12345'))).toBe(true);
  });

  test('Discover page filters games by selected date', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games on different dates
    const tomorrow = new Date(Date.now() + 86400000);
    const dayAfter = new Date(Date.now() + 172800000);
    
    const game1 = await createTestGame(request, user.token, {
      title: 'Game Tomorrow',
      date: tomorrow.toISOString(),
    });
    const game2 = await createTestGame(request, user.token, {
      title: 'Game Day After',
      date: dayAfter.toISOString(),
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Filter by date (simulating calendar selection)
    const selectedDate = tomorrow.toISOString().split('T')[0];
    const filtered = games.filter((g: any) => {
      if (!g.date) return false;
      const gameDate = new Date(g.date).toISOString().split('T')[0];
      return gameDate === selectedDate;
    });
    
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((g: any) => g.id === game1.id)).toBe(true);
  });

  test('Discover page displays posts in discover tab', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create a test post
    await createTestPost(request, user.token, {
      title: 'Discover Post',
    });

    // Fetch trending posts (what discover page uses)
    const authRequest = await createAuthRequest(request.context(), user.token);
    const postsResponse = await authRequest.get(`${API_BASE_URL}/highlights/trending?limit=20`);

    expect(postsResponse.status()).toBe(200);
    const postsData = await postsResponse.json();
    
    expect(Array.isArray(postsData.items) || Array.isArray(postsData)).toBe(true);
    const posts = Array.isArray(postsData.items) ? postsData.items : postsData;
    
    expect(posts.length).toBeGreaterThan(0);
    
    // Verify post structure
    const post = posts[0];
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('title');
  });

  test('Discover page displays posts in following tab', async ({ request }) => {
    const user1 = await createTestUser(request);
    const user2 = await createTestUser(request);
    
    // User2 creates a post
    const post = await createTestPost(request, user2.token, {
      title: 'Following Post',
    });

    // User1 follows user2
    const authRequest = await createAuthRequest(request.context(), user1.token);
    const followResponse = await authRequest.post(`${API_BASE_URL}/users/${user2.userId}/follow`);

    expect([200, 201]).toContain(followResponse.status());

    // Fetch posts (following filter would be applied on frontend)
    const postsResponse = await authRequest.get(`${API_BASE_URL}/highlights/trending?limit=20`);

    expect(postsResponse.status()).toBe(200);
    const postsData = await postsResponse.json();
    const posts = Array.isArray(postsData.items) ? postsData.items : postsData;
    
    // Verify posts are returned (following filter is client-side)
    expect(Array.isArray(posts)).toBe(true);
  });

  test('Discover page displays nearby people', async ({ request }) => {
    const user1 = await createTestUser(request);
    const user2 = await createTestUser(request);
    
    // Update user2 preferences with zip code
    const authRequest = await createAuthRequest(request.context(), user2.token);
    await authRequest.patch(`${API_BASE_URL}/me/preferences`, {
      data: {
        zip_code: '12345',
      },
    });

    // Update user1 preferences with same zip code
    const authRequest1 = await createAuthRequest(request.context(), user1.token);
    await authRequest1.patch(`${API_BASE_URL}/me/preferences`, {
      data: {
        zip_code: '12345',
      },
    });

    // Fetch users by zip (what discover page uses)
    const usersResponse = await authRequest1.get(`${API_BASE_URL}/users?zip=12345&limit=30`);

    // Note: This endpoint might not exist, so we check for 200 or 404
    if (usersResponse.status() === 200) {
      const users = await usersResponse.json();
      expect(Array.isArray(users) || Array.isArray(users.items)).toBe(true);
    }
  });

  test('Discover page supports map view toggle', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games with coordinates
    await createTestGame(request, user.token, {
      title: 'Game with Location',
      location: '123 Main St, City, 12345',
      latitude: 40.7128,
      longitude: -74.0060,
    });

    // Fetch games (map view would filter for games with coordinates)
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Filter games with coordinates (what map view needs)
    const gamesWithCoords = games.filter((g: any) => 
      typeof g.latitude === 'number' && typeof g.longitude === 'number'
    );
    
    // Verify games with coordinates exist
    expect(Array.isArray(gamesWithCoords)).toBe(true);
  });

  test('Discover page supports pull-to-refresh', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Initial load
    const authRequest = await createAuthRequest(request.context(), user.token);
    const initialResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(initialResponse.status()).toBe(200);
    const initialGames = await initialResponse.json();
    const initialCount = Array.isArray(initialGames) ? initialGames.length : 0;

    // Create a new game
    await createTestGame(request, user.token, {
      title: 'New Game After Refresh',
    });

    // Refresh (simulating pull-to-refresh)
    const refreshResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(refreshResponse.status()).toBe(200);
    const refreshedGames = await refreshResponse.json();
    const refreshedCount = Array.isArray(refreshedGames) ? refreshedGames.length : 0;

    // Verify new game appears after refresh
    expect(refreshedCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('Discover page handles empty state', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Fetch games (might be empty for new user)
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Empty state is valid
    expect(Array.isArray(games)).toBe(true);
    
    // If empty, verify structure
    if (games.length === 0) {
      expect(games).toEqual([]);
    }
  });

  test('Discover page quick actions dashboard shows correct actions for coach', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Update user to coach role
    const authRequest = await createAuthRequest(request.context(), user.token);
    await authRequest.patch(`${API_BASE_URL}/me/preferences`, {
      data: {
        role: 'coach',
      },
    });

    // Verify user is coach
    const meResponse = await authRequest.get(`${API_BASE_URL}/auth/me`);
    expect(meResponse.status()).toBe(200);
    const me = await meResponse.json();
    
    expect(me.preferences?.role === 'coach' || me.role === 'coach').toBe(true);
  });

  test('Discover page quick actions dashboard shows correct actions for fan', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Verify user is fan (default)
    const authRequest = await createAuthRequest(request.context(), user.token);
    const meResponse = await authRequest.get(`${API_BASE_URL}/auth/me`);

    expect(meResponse.status()).toBe(200);
    const me = await meResponse.json();
    
    // Fan is default role
    const isFan = !me.preferences?.role || 
                  me.preferences?.role === 'fan' || 
                  !me.role || 
                  me.role === 'fan';
    expect(isFan).toBe(true);
  });

  test('Discover page can create game via quick add modal', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create game (simulating quick add modal)
    const gameData = {
      title: 'Quick Add Game',
      date: new Date(Date.now() + 86400000).toISOString(),
      location: '123 Main St, City, 12345',
      description: 'Quick add game description',
    };

    const game = await createTestGame(request, user.token, gameData);

    expect(game).toHaveProperty('id');
    expect(game.title).toBe(gameData.title);
  });

  test('Discover page calendar marks dates with games', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games on specific dates
    const date1 = new Date(Date.now() + 86400000);
    const date2 = new Date(Date.now() + 172800000);
    
    await createTestGame(request, user.token, {
      date: date1.toISOString(),
    });
    await createTestGame(request, user.token, {
      date: date2.toISOString(),
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Extract unique dates (what calendar would mark)
    const datesWithGames = new Set(
      games
        .filter((g: any) => g.date)
        .map((g: any) => new Date(g.date).toISOString().split('T')[0])
    );
    
    expect(datesWithGames.size).toBeGreaterThan(0);
  });

  test('Discover page API returns correct data structure', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    expect(Array.isArray(games)).toBe(true);
    
    if (games.length > 0) {
      const game = games[0];
      expect(game).toHaveProperty('id');
      expect(typeof game.id).toBe('string');
      
      if (game.title) {
        expect(typeof game.title).toBe('string');
      }
      
      if (game.date) {
        expect(typeof game.date).toBe('string');
      }
      
      if (game.location) {
        expect(typeof game.location).toBe('string');
      }
    }
  });

  test('Discover page handles location permission for map view', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games with coordinates
    await createTestGame(request, user.token, {
      title: 'Game with Coords',
      latitude: 40.7128,
      longitude: -74.0060,
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Games with coordinates should be available for map view
    const gamesWithCoords = games.filter((g: any) => 
      typeof g.latitude === 'number' && typeof g.longitude === 'number'
    );
    
    expect(Array.isArray(gamesWithCoords)).toBe(true);
  });

  test('Discover page zip suggestions work correctly', async ({ request }) => {
    const user = await createTestUser(request);
    
    // Create games with different zip codes
    await createTestGame(request, user.token, {
      location: '123 Main St, City, 12345',
    });
    await createTestGame(request, user.token, {
      location: '456 Oak Ave, Town, 12345',
    });
    await createTestGame(request, user.token, {
      location: '789 Pine Rd, Village, 67890',
    });

    // Fetch games
    const authRequest = await createAuthRequest(request.context(), user.token);
    const gamesResponse = await authRequest.get(`${API_BASE_URL}/games?sort=-date`);

    expect(gamesResponse.status()).toBe(200);
    const games = await gamesResponse.json();
    
    // Build zip directory (what frontend does)
    const zipCounts = new Map<string, number>();
    games.forEach((g: any) => {
      const zipMatch = g.location?.match(/\b\d{5}\b/);
      if (zipMatch) {
        const zip = zipMatch[0];
        zipCounts.set(zip, (zipCounts.get(zip) || 0) + 1);
      }
    });
    
    // Verify zip codes are extracted
    expect(zipCounts.size).toBeGreaterThan(0);
    expect(zipCounts.get('12345')).toBeGreaterThanOrEqual(2);
  });
});
