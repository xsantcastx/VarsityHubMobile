import type { Request } from 'express';

type ReverseGeocodeResult = {
  place_id: string | null;
  place_name: string | null;
  locality: string | null;
  admin_area: string | null;
  country: string | null;
  country_code: string | null;
};

const cache = new Map<string, any>();

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

function normCountry(code?: string | null): string | null {
  if (!code) return null;
  return code.trim().toUpperCase().slice(0, 2);
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const key = getApiKey();
  const ck = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(ck)) return cache.get(ck);
  if (!key) return { place_id: null, place_name: null, locality: null, admin_area: null, country: null, country_code: null };
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat+","+lng)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data: any = await res.json().catch(() => ({}));
  let out: ReverseGeocodeResult = { place_id: null, place_name: null, locality: null, admin_area: null, country: null, country_code: null };
  const best = Array.isArray(data?.results) && data.results.length ? data.results[0] : null;
  if (best) {
    out.place_id = best.place_id || null;
    out.place_name = best.formatted_address || null;
    const comps = best.address_components || [];
    const byType = (t: string) => comps.find((c: any) => Array.isArray(c.types) && c.types.includes(t));
    out.locality = byType('locality')?.long_name || byType('postal_town')?.long_name || null;
    out.admin_area = byType('administrative_area_level_1')?.long_name || null;
    out.country = byType('country')?.long_name || null;
    out.country_code = normCountry(byType('country')?.short_name) || null;
  }
  cache.set(ck, out);
  return out;
}

export async function geocodeZip(zip: string, country?: string | null): Promise<{ lat: number | null; lng: number | null; country_code: string | null }>
{
  const key = getApiKey();
  const cc = normCountry(country) || 'US';
  const q = `${zip},${cc}`;
  const ck = `zip:${q}`;
  if (cache.has(ck)) return cache.get(ck);
  if (!key) return { lat: null, lng: null, country_code: cc };
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data: any = await res.json().catch(() => ({}));
  let lat: number | null = null, lng: number | null = null, country_code: string | null = cc;
  const best = Array.isArray(data?.results) && data.results.length ? data.results[0] : null;
  if (best?.geometry?.location) {
    lat = Number(best.geometry.location.lat);
    lng = Number(best.geometry.location.lng);
  }
  const comps = best?.address_components || [];
  const byType = (t: string) => comps.find((c: any) => Array.isArray(c.types) && c.types.includes(t));
  country_code = normCountry(byType('country')?.short_name) || country_code;
  const out = { lat, lng, country_code };
  cache.set(ck, out);
  return out;
}

export function getCountryFromReqOrPrefs(req: Request & { user?: any }, prefs?: any): string | null {
  const fromPrefs = prefs?.country_code || prefs?.country || null;
  return normCountry(fromPrefs) || null;
}

