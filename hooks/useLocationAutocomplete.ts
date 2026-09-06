import { useCallback, useEffect, useRef, useState } from 'react';
import { autocompleteLocations, type PlaceSuggestion } from '@/api/geocoding';

type LocationErrors = Record<string, string>;

type UseLocationAutocompleteOptions = {
  suggestionLimit?: number;
  debounceMs?: number;
  onClearLocationError?: (updater: (prev: LocationErrors) => LocationErrors) => void;
  debugLabel?: string;
};

export function useLocationAutocomplete({
  suggestionLimit = 6,
  debounceMs = 300,
  onClearLocationError,
  debugLabel = 'Location autocomplete',
}: UseLocationAutocompleteOptions = {}) {
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [locationQuerying, setLocationQuerying] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearPendingRequest = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearLocationError = useCallback(() => {
    onClearLocationError?.(prev => ({ ...prev, location: '' }));
  }, [onClearLocationError]);

  const requestLocationSuggestions = useCallback(
    (text: string) => {
      clearPendingRequest();

      if (text.length < 3) {
        setLocationSuggestions([]);
        setLocationQuerying(false);
        return;
      }

      setLocationQuerying(true);
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const suggestions = await autocompleteLocations(text, suggestionLimit);
          if (controller.signal.aborted) return;
          setLocationSuggestions(suggestions);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (__DEV__) console.warn(`${debugLabel} failed:`, error);
          setLocationSuggestions([]);
        } finally {
          if (!controller.signal.aborted) setLocationQuerying(false);
        }
      }, debounceMs);
    },
    [clearPendingRequest, debounceMs, debugLabel, suggestionLimit]
  );

  const handleLocationChange = useCallback(
    (text: string) => {
      setLocation(text);
      setLocationTouched(true);
      setSelectedPlace(null);
      clearLocationError();

      if (text.length >= 3) {
        requestLocationSuggestions(text);
      } else {
        clearPendingRequest();
        setLocationSuggestions([]);
        setLocationQuerying(false);
      }
    },
    [clearLocationError, clearPendingRequest, requestLocationSuggestions]
  );

  const handleSelectLocation = useCallback(
    (suggestion: PlaceSuggestion) => {
      clearPendingRequest();
      setLocation(suggestion.description);
      setSelectedPlace(suggestion);
      setLocationSuggestions([]);
      setLocationQuerying(false);
      setLocationTouched(true);
      clearLocationError();
    },
    [clearLocationError, clearPendingRequest]
  );

  useEffect(() => clearPendingRequest, [clearPendingRequest]);

  return {
    location,
    setLocation,
    locationSuggestions,
    locationQuerying,
    locationTouched,
    setLocationTouched,
    selectedPlace,
    setSelectedPlace,
    handleLocationChange,
    handleSelectLocation,
  };
}
