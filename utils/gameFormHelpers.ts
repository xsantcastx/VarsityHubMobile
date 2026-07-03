/**
 * Game Form Helpers
 *
 * Shared date/time helpers for the Add Game / Quick Add Game modals
 * (components/AddGameModal.tsx, components/QuickAddGameModal.tsx).
 * The two modals are intentionally separate products — do NOT merge them —
 * but their date/time picker formatting and past-date validation are
 * identical, so that logic lives here.
 */

/**
 * "Sat, Nov 15, 2025" — date-picker display format for game forms.
 */
export function formatGameDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "7:00 PM" — 12-hour time-picker display format for game forms.
 * Also used by QuickAddGameModal as its serialized time string, so the
 * options here must stay in sync with what the server expects.
 */
export function formatGameTime(time: Date): string {
  return time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * True when the picked date falls before today (compared against local
 * midnight). Shared "date cannot be in the past" validation check.
 */
export function isPastGameDate(date: Date): boolean {
  return date < new Date(new Date().setHours(0, 0, 0, 0));
}
