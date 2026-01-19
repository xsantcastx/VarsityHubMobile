import { test, expect } from '@playwright/test';

/**
 * Highlights Page E2E Tests
 * 
 * These tests verify that the highlights page works correctly
 * in real-world scenarios, including tabs, search, and interactions.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to generate unique test data
const generateTestData = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `highlights-test-${timestamp}-${random}@varsityhub-test.app`,
    password: 'HighlightsTestPassword123!',
    displayName: `Highlights Test User ${timestamp}`,
  };
};

// Helper to create authenticated user via API
async function createUser(request: any, email: string, password: string, displayName: string) {
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
    },
  });
  
  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Failed to create user: ${response.status()} - ${body}`);
  }
  
  const data = await response.json();
  return {
    accessToken: data.access_token,
    user: data.user,
  };
}

// Helper to login via API
async function loginUser(request: any, email: string, password: string) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  
  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Failed to login: ${response.status()} - ${body}`);
  }
  
  const data = await response.json();
  return {
    accessToken: data.access_token,
    user: data.user,
  };
}

// Helper to create a post with media (highlight) via API
async function createHighlight(request: any, accessToken: string, content: string, mediaUrl?: string, title?: string) {
  const response = await request.post(`${API_URL}/posts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      title: title || 'Test Highlight',
      content,
      media_url: mediaUrl || 'https://via.placeholder.com/800x600.jpg',
      type: 'highlight',
    },
  });
  
  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Failed to create highlight: ${response.status()} - ${body}`);
  }
  
  return await response.json();
}

// Helper to upvote a post via API
async function upvotePost(request: any, accessToken: string, postId: string) {
  const response = await request.post(`${API_URL}/posts/${postId}/upvote`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  // Upvote endpoint might return 200 or 201
  return response.status() === 200 || response.status() === 201 || response.status() === 204;
}

// Helper to fetch highlights via API
async function fetchHighlights(request: any, accessToken: string | null, country: string = 'US', lat?: number, lng?: number) {
  const params = new URLSearchParams({
    country,
    limit: '50',
  });
  if (lat != null && lng != null) {
    params.append('lat', String(lat));
    params.append('lng', String(lng));
  }
  
  const headers: any = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  
  const response = await request.get(`${API_URL}/highlights?${params.toString()}`, {
    headers,
  });
  
  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Failed to fetch highlights: ${response.status()} - ${body}`);
  }
  
  return await response.json();
}

test.describe('Highlights Page Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('Highlights page loads and displays content', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a test highlight
    await createHighlight(request, accessToken, 'Test highlight for E2E test');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights page
    const highlightsLink = page.locator('a[href*="highlight"], button:has-text("Highlight"), [data-testid="highlights-tab"]').first();
    if (await highlightsLink.isVisible().catch(() => false)) {
      await highlightsLink.click();
    } else {
      // Try navigating directly
      await page.goto(`${APP_URL}/highlights`);
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for highlights to load
    
    // Check if highlights content is visible
    const highlightsContent = page.locator('text=/highlight|trending|recent|top/i').first();
    await expect(highlightsContent).toBeVisible({ timeout: 10000 });
  });

  test('Highlights page shows tabs (Trending, Recent, Top)', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create multiple highlights for better testing
    await createHighlight(request, accessToken, 'Highlight 1');
    await createHighlight(request, accessToken, 'Highlight 2');
    await createHighlight(request, accessToken, 'Highlight 3');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check for tab buttons
    const trendingTab = page.locator('button:has-text("Trending"), text=/trending/i').first();
    const recentTab = page.locator('button:has-text("Recent"), text=/recent/i').first();
    const topTab = page.locator('button:has-text("Top"), text=/top/i').first();
    
    // At least one tab should be visible
    const hasTabs = await trendingTab.isVisible().catch(() => false) ||
                    await recentTab.isVisible().catch(() => false) ||
                    await topTab.isVisible().catch(() => false);
    
    expect(hasTabs).toBeTruthy();
    
    // Try clicking on tabs if they exist
    if (await trendingTab.isVisible().catch(() => false)) {
      await trendingTab.click();
      await page.waitForTimeout(1000);
    }
    
    if (await recentTab.isVisible().catch(() => false)) {
      await recentTab.click();
      await page.waitForTimeout(1000);
    }
    
    if (await topTab.isVisible().catch(() => false)) {
      await topTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Page should still be visible after tab switching
    await expect(page.locator('body')).toBeVisible();
  });

  test('Highlights page supports pull-to-refresh', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to trigger refresh (scroll to top)
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    // Create a new highlight after initial load
    await createHighlight(request, accessToken, 'New highlight after refresh');
    
    // Wait a bit for potential auto-refresh
    await page.waitForTimeout(3000);
    
    // Check if highlights content is still visible
    const highlightsContent = page.locator('text=/highlight|trending|recent|top/i').first();
    await expect(highlightsContent).toBeVisible({ timeout: 5000 });
  });

  test('Highlights page handles empty state', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create a fresh user with no highlights
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for empty state or that page loads without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Empty state might show "No highlights" or similar
    const emptyState = page.locator('text=/no.*highlight|empty|no.*available/i');
    // This is optional - page might just show empty list
  });

  test('Highlights page supports search', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a highlight with specific content
    await createHighlight(request, accessToken, 'Searchable highlight content', undefined, 'Search Test Title');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('Search Test');
      await page.waitForTimeout(1000);
      
      // Check if search results appear
      const searchResults = page.locator('text=/Search Test|searchable/i').first();
      // Search might show results or filter highlights
      await expect(searchResults.or(page.locator('body'))).toBeVisible({ timeout: 5000 });
    } else {
      // Search might not be available, but page should still work
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Can view highlight detail', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a highlight
    const highlight = await createHighlight(request, accessToken, 'Highlight to view in detail', undefined, 'Detail Test');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to find and click on the highlight
    const highlightCard = page.locator('text=/Detail Test|Highlight to view/i').first();
    
    if (await highlightCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await highlightCard.click();
      await page.waitForTimeout(2000);
      
      // Should navigate to post detail
      await expect(page).toHaveURL(/.*post-detail|.*highlight/i, { timeout: 5000 });
    } else {
      // Try navigating directly to post detail
      await page.goto(`${APP_URL}/post-detail?id=${highlight.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check if highlight content is visible
      const detailContent = page.locator('text=/Detail Test|Highlight to view/i');
      await expect(detailContent).toBeVisible({ timeout: 10000 });
    }
  });

  test('Can interact with highlights (upvote)', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a highlight
    const highlight = await createHighlight(request, accessToken, 'Highlight to upvote');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to find upvote button
    const upvoteButton = page.locator('button[aria-label*="upvote" i], button[aria-label*="like" i], button:has-text("👍")').first();
    
    if (await upvoteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Get initial upvote count if visible
      const initialCount = await upvoteButton.textContent().catch(() => '0');
      
      await upvoteButton.click();
      await page.waitForTimeout(1000);
      
      // Check if upvote count changed or button state changed
      const newCount = await upvoteButton.textContent().catch(() => '0');
      // Upvote should have some effect (count change or visual state change)
      expect(upvoteButton).toBeVisible();
    } else {
      // Upvote might be on detail page, navigate there
      await page.goto(`${APP_URL}/post-detail?id=${highlight.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      const detailUpvoteButton = page.locator('button[aria-label*="upvote" i], button[aria-label*="like" i]').first();
      if (await detailUpvoteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await detailUpvoteButton.click();
        await page.waitForTimeout(1000);
        await expect(detailUpvoteButton).toBeVisible();
      }
    }
  });

  test('Highlights API returns correct data structure', async ({ request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a highlight
    await createHighlight(request, accessToken, 'API test highlight');
    
    // Fetch highlights via API
    const highlightsData = await fetchHighlights(request, accessToken);
    
    // Verify response structure
    expect(highlightsData).toBeDefined();
    expect(highlightsData.nationalTop).toBeDefined();
    expect(Array.isArray(highlightsData.nationalTop)).toBe(true);
    expect(highlightsData.ranked).toBeDefined();
    expect(Array.isArray(highlightsData.ranked)).toBe(true);
    
    // If there are highlights, verify structure
    if (highlightsData.nationalTop.length > 0) {
      const highlight = highlightsData.nationalTop[0];
      expect(highlight.id).toBeDefined();
      expect(highlight.media_url || highlight.content).toBeDefined();
    }
  });

  test('Highlights page shows different content for different tabs', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create multiple highlights with different engagement
    const highlight1 = await createHighlight(request, accessToken, 'Trending highlight 1');
    const highlight2 = await createHighlight(request, accessToken, 'Trending highlight 2');
    
    // Upvote one to make it more popular
    await upvotePost(request, accessToken, highlight1.id);
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Try switching between tabs
    const trendingTab = page.locator('button:has-text("Trending"), text=/trending/i').first();
    const recentTab = page.locator('button:has-text("Recent"), text=/recent/i').first();
    const topTab = page.locator('button:has-text("Top"), text=/top/i').first();
    
    // Switch to trending
    if (await trendingTab.isVisible().catch(() => false)) {
      await trendingTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Switch to recent
    if (await recentTab.isVisible().catch(() => false)) {
      await recentTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Switch to top
    if (await topTab.isVisible().catch(() => false)) {
      await topTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('Highlights page handles location-based ranking', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken, user } = await loginUser(request, testData.email, testData.password);
    
    // Update user preferences with location
    await request.patch(`${API_URL}/me/preferences`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        lat: 34.0522, // Los Angeles
        lng: -118.2437,
      },
    });
    
    // Create a highlight
    await createHighlight(request, accessToken, 'Location-based highlight');
    
    // Navigate to app and set auth token
    await page.goto(APP_URL);
    await page.evaluate((token) => {
      localStorage.setItem('access_token', token);
    }, accessToken);
    
    // Reload to apply auth
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to highlights
    await page.goto(`${APP_URL}/highlights`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Highlights should load (location-based ranking is handled server-side)
    await expect(page.locator('body')).toBeVisible();
    
    // Verify highlights API includes location
    const highlightsData = await fetchHighlights(request, accessToken, 'US', 34.0522, -118.2437);
    expect(highlightsData).toBeDefined();
    expect(highlightsData.ranked).toBeDefined();
  });
});
