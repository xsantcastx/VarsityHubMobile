/** One image frame for event creation, feed cards, and event detail. */
export const EVENT_BANNER_ASPECT_RATIO = 16 / 9;
export const EVENT_BANNER_OUTPUT_WIDTH = 1200;
export const EVENT_LIVE_WINDOW_HOURS = [5, 12] as const;
export type EventLiveWindowHours = (typeof EVENT_LIVE_WINDOW_HOURS)[number];
