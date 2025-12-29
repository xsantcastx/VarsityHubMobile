// Centralized events API wrappers and error normalization
import { httpGet, httpPut } from '@/api/http';
import { Event as EventEntity } from '@/api/entities';

export interface Event {
  id: string;
  name: string;
  date: string;
  // ...other event fields
}

export interface EventApproval {
  id: string;
  eventId: string;
  status: 'pending' | 'approved' | 'rejected';
  // ...other approval fields
}

export function normalizeApiError(error: any): string {
  if (error?.response?.data?.message) return error.response.data.message;
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred.';
}

export async function fetchEvents(): Promise<Event[]> {
  try {
    const res = await httpGet('/events');
    return res;
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function fetchEventApprovals(): Promise<EventApproval[]> {
  try {
    const res = await httpGet('/events/approvals');
    return res;
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function approveEvent(id: string): Promise<EventApproval> {
  try {
    const res = await httpPut(`/events/approvals/${id}/approve`, {});
    return res;
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function rejectEvent(id: string): Promise<EventApproval> {
  try {
    const res = await httpPut(`/events/approvals/${id}/reject`, {});
    return res;
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

// Thin wrappers around existing Event entity methods for pitches/fan submissions
export async function pitchEvent(payload: Parameters<typeof EventEntity.pitch>[0]) {
  try {
    return await EventEntity.pitch(payload);
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function listPitches() {
  try {
    return await EventEntity.listPitches();
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function approvePitch(id: string) {
  try {
    return await EventEntity.approvePitch(id);
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

export async function rejectPitch(id: string) {
  try {
    return await EventEntity.rejectPitch(id);
  } catch (e) {
    throw new Error(normalizeApiError(e));
  }
}

// Add more typed event API functions as needed
