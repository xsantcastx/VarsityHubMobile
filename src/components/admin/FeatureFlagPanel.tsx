import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getAllFeatures, toggleFeature } from '@/components/utils/featureFlags';
import { Settings, Eye, EyeOff } from 'lucide-react';

// ADMIN FEATURE: Feature flag management panel
// This would only be visible to admin users

export default function FeatureFlagPanel({ userRole }) {
  const features = getAllFeatures();

  // Only show to admin users
  if (userRole !== 'admin') {
    return null;
  }

  const handleToggle = (featureName, enabled) => {
    toggleFeature(featureName, enabled);
    // In a real app, this would update the backend and refresh the UI
    window.location.reload();
  };

  const getFeatureDescription = (featureName) => {
    const descriptions = {
      FREELANCER_FEATURES: 'Enable freelancer marketplace and booking system',
      SPONSORSHIP_AUCTIONS: 'Allow businesses to bid on event sponsorships',
      ADVANCED_AD_AUCTIONS: 'Premium ad slot bidding system',
      MEDIA_DOWNLOADS: 'Bulk media download capabilities',
      PROMO_CODES: 'Promotional discount code system',
      LIVE_SCORING: 'Real-time game score updates',
      PUSH_NOTIFICATIONS: 'Mobile push notification system'
    };
    return descriptions[featureName] || 'Feature description not available';
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Feature Flags (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {features.map(({ name, enabled }) => (
          <div key={name} className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor={name} className="font-medium">
                  {name.replace(/_/g, ' ')}
                </Label>
                {enabled ? (
                  <Badge className="bg-green-100 text-green-800">
                    <Eye className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Hidden
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {getFeatureDescription(name)}
              </p>
            </div>
            <Switch
              id={name}
              checked={enabled}
              onCheckedChange={(checked) => handleToggle(name, checked)}
            />
          </div>
        ))}
        
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <p className="font-medium text-yellow-800">Note:</p>
          <p className="text-yellow-700">
            Feature flags control UI visibility only. Backend functionality remains available for development.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}