const { expo } = require('./app.json');

const readEnv = (key, fallback = '') => {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
};

const mapsKey =
  readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ||
  readEnv('GOOGLE_MAPS_API_KEY') ||
  readEnv('GOOGLE_MAPS_API_KEY_MOBILE');

module.exports = () => {
  const ios = {
    ...expo.ios,
    config: {
      ...(expo.ios?.config ?? {}),
      ...(mapsKey ? { googleMapsApiKey: mapsKey } : {}),
    },
  };

  const android = {
    ...expo.android,
    config: {
      ...(expo.android?.config ?? {}),
      googleMaps: {
        ...(expo.android?.config?.googleMaps ?? {}),
        ...(mapsKey ? { apiKey: mapsKey } : {}),
      },
    },
  };

  const extra = {
    ...(expo.extra ?? {}),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
      readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', expo.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''),
  };

  return {
    ...expo,
    ios,
    android,
    extra,
  };
};
