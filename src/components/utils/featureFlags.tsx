// Feature flag utilities
// These control which features are visible in the UI

export const FEATURE_FLAGS = {
  FREELANCER_FEATURES: false, // Set to true to enable
  SPONSORSHIP_AUCTIONS: false,
  ADVANCED_AD_AUCTIONS: false,
  MEDIA_DOWNLOADS: false,
  PROMO_CODES: false,
  LIVE_SCORING: false,
  PUSH_NOTIFICATIONS: false
};

export const isFeatureEnabled = (featureName) => {
  return FEATURE_FLAGS[featureName] || false;
};

// Development helper - shows all available features
export const getAllFeatures = () => {
  return Object.keys(FEATURE_FLAGS).map(key => ({
    name: key,
    enabled: FEATURE_FLAGS[key]
  }));
};

// Admin panel could use this to toggle features
export const toggleFeature = (featureName, enabled) => {
  // This would typically make an API call to update feature flags
  // For now, just log the action
  console.log(`Feature ${featureName} ${enabled ? 'enabled' : 'disabled'}`);
};