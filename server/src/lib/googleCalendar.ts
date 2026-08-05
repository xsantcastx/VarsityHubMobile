import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

/**
 * Google Calendar integration for syncing VarsityHub events.
 * Handles token management, event creation, and calendar operations.
 */

/**
 * Create an OAuth2 client with stored user tokens.
 */
export function createGoogleCalendarClient(
  accessToken: string,
  refreshToken?: string | null
): calendar_v3.Calendar {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });

  return google.calendar({
    version: 'v3',
    auth: oauth2Client,
  });
}

/**
 * Exchange OAuth code for tokens and refresh.
 */
export async function exchangeOAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    return {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };
  } catch (error) {
    throw new Error(`Failed to exchange Google OAuth code: ${String(error)}`);
  }
}

/**
 * Sync a single event to Google Calendar.
 */
export async function syncEventToGoogleCalendar(
  calendarClient: calendar_v3.Calendar,
  event: {
    id: string;
    title: string;
    description?: string;
    start_time: Date;
    end_time: Date;
    location?: string;
  },
  calendarId: string = 'primary'
): Promise<string | null> {
  try {
    const response = await (calendarClient.events as any).create({
      calendarId,
      requestBody: {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start_time.toISOString() },
        end: { dateTime: event.end_time.toISOString() },
        location: event.location,
        // Use event ID as extendedProperties to enable idempotency
        extendedProperties: {
          private: {
            varsityhub_event_id: event.id,
          },
        },
      },
    });

    return response.data.id || null;
  } catch (error: any) {
    // Log but don't throw — partial sync is acceptable
    console.error('[calendar] Failed to sync event:', {
      eventId: event.id,
      error: error.message,
    });
    return null;
  }
}

/**
 * Batch sync multiple events to Google Calendar.
 */
export async function batchSyncEventsToGoogleCalendar(
  calendarClient: calendar_v3.Calendar,
  events: Array<{
    id: string;
    title: string;
    description?: string;
    start_time: Date;
    end_time: Date;
    location?: string;
  }>,
  calendarId: string = 'primary',
  maxBatchSize: number = 50
): Promise<{ synced: number; skipped: number; errors: Array<{ eventId: string; error: string }> }> {
  const results = { synced: 0, skipped: 0, errors: [] as Array<{ eventId: string; error: string }> };

  // Split into batches to avoid overwhelming the API
  for (let i = 0; i < events.length; i += maxBatchSize) {
    const batch = events.slice(i, i + maxBatchSize);

    for (const event of batch) {
      try {
        const created = await syncEventToGoogleCalendar(calendarClient, event, calendarId);
        if (created) {
          results.synced++;
        } else {
          results.skipped++;
        }
      } catch (error: any) {
        results.errors.push({
          eventId: event.id,
          error: error.message,
        });
      }

      // Rate limit: 1 event per 100ms to stay well below Google's quota
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Check if Google Calendar credentials are available.
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

/**
 * Build the OAuth authorization URL for Google Calendar.
 */
export function buildGoogleCalendarAuthUrl(state: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state,
  });
}

