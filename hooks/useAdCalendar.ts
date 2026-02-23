/**
 * useAdCalendar - Data layer for ad calendar screen
 * Encapsulates API calls for ad-calendar.tsx
 */

import { Advertisement, Payments } from '@/api/entities';
import { httpGet, httpPost } from '@/api/http';
import { useCallback, useEffect, useState } from 'react';

const todayISO = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const maxDateISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().split('T')[0];
};

export interface UseAdCalendarResult {
  reserved: Set<string>;
  fullDates: Set<string>;
  zipCode: string;
  paymentsStatus: { stripe_configured?: boolean; has_webhook_secret?: boolean } | null;
  paymentsStatusLoading: boolean;
  paymentsStatusError: string | null;
  loadReservations: () => Promise<void>;
  loadAvailability: (zip: string) => Promise<void>;
  loadPaymentsStatus: () => Promise<void>;
  applyPromo: (code: string, subtotalCents: number) => Promise<{ valid: boolean; code?: string; discount_cents?: number; reason?: string } | null>;
  fetchAlternatives: (zip: string, dates: string[]) => Promise<Array<{ zip: string; distance: number }>>;
  startCheckout: (adId: string, dates: string[], promoCode?: string) => Promise<{ free?: boolean; url?: string }>;
}

export function useAdCalendar(adId: string | undefined): UseAdCalendarResult {
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [fullDates, setFullDates] = useState<Set<string>>(new Set());
  const [zipCode, setZipCode] = useState<string>('');
  const [paymentsStatus, setPaymentsStatus] = useState<UseAdCalendarResult['paymentsStatus']>(null);
  const [paymentsStatusLoading, setPaymentsStatusLoading] = useState(true);
  const [paymentsStatusError, setPaymentsStatusError] = useState<string | null>(null);

  const loadAvailability = useCallback(async (zip: string) => {
    try {
      const from = todayISO();
      const to = maxDateISO();
      const data = await httpGet(`/ads/availability?zip=${encodeURIComponent(zip)}&from=${from}&to=${to}`);
      if (data?.availability) {
        const fullDatesSet = new Set<string>();
        Object.entries(data.availability).forEach(([dateISO, info]: [string, any]) => {
          if (!info?.available || (info?.slotsRemaining ?? 0) <= 0) {
            fullDatesSet.add(dateISO);
          }
        });
        setFullDates(fullDatesSet);
      }
    } catch (e) {
      if (__DEV__) console.error('[useAdCalendar] loadAvailability:', e);
    }
  }, []);

  const loadReservations = useCallback(async () => {
    if (!adId) {
      setReserved(new Set());
      return;
    }
    try {
      const res: any = await Advertisement.reservationsForAd(String(adId));
      const dates = Array.isArray(res?.dates) ? res.dates : [];
      setReserved(new Set<string>(dates));
      if (res?.ad?.target_zip_code) {
        const zip = res.ad.target_zip_code;
        setZipCode(zip);
        await loadAvailability(zip);
      }
    } catch {
      setReserved(new Set());
    }
  }, [adId, loadAvailability]);

  const loadPaymentsStatus = useCallback(async () => {
    try {
      const status = await Payments.configStatus();
      setPaymentsStatus(status);
      setPaymentsStatusError(null);
    } catch {
      setPaymentsStatusError('Unable to confirm payment readiness right now.');
    } finally {
      setPaymentsStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    void loadPaymentsStatus();
  }, [loadPaymentsStatus]);

  const applyPromo = useCallback(async (code: string, subtotalCents: number) => {
    try {
      const data = await httpPost('/promos/preview', {
        code,
        subtotal_cents: subtotalCents,
        service: 'booking',
      });
      return data;
    } catch (e: any) {
      throw new Error(e?.message || 'Failed to apply promo');
    }
  }, []);

  const fetchAlternatives = useCallback(async (zip: string, dates: string[]) => {
    if (!zip || dates.length === 0) return [];
    try {
      const dateString = dates.join(',');
      const data = await httpGet(
        `/ads/alternative-zips?zip=${encodeURIComponent(zip)}&dates=${encodeURIComponent(dateString)}`
      );
      return data?.alternatives && Array.isArray(data.alternatives) ? data.alternatives : [];
    } catch (e) {
      if (__DEV__) console.error('[useAdCalendar] fetchAlternatives:', e);
      return [];
    }
  }, []);

  const startCheckout = useCallback(async (adIdParam: string, dates: string[], promoCode?: string) => {
    const data: any = await httpPost('/payments/checkout', {
      ad_id: String(adIdParam),
      dates,
      promo_code: promoCode || undefined,
    });
    return data;
  }, []);

  return {
    reserved,
    fullDates,
    zipCode,
    paymentsStatus,
    paymentsStatusLoading,
    paymentsStatusError,
    loadReservations,
    loadAvailability,
    loadPaymentsStatus,
    applyPromo,
    fetchAlternatives,
    startCheckout,
  };
}
