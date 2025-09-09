import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BannerAd({ ad = null }) {
  const navigate = useNavigate();

  // If no ad is passed, display the placeholder
  if (!ad) {
    return (
      <Card 
        className="overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:shadow-md transition-shadow hover:border-blue-400"
        onClick={() => navigate(createPageUrl('SubmitAd'))}
      >
        <div className="flex items-center justify-center p-4 h-24">
          <div className="text-center">
            <h3 className="font-semibold text-sm text-gray-800">Your Ad Here</h3>
            <p className="text-xs text-gray-600">Click to submit a local ad</p>
          </div>
        </div>
      </Card>
    );
  }

  // Display the actual ad
  return (
    <Card 
      className="overflow-hidden border border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => window.open(ad.website_url || '#', '_blank')}
    >
      <div className="h-24 relative overflow-hidden">
        <img 
          src={ad.banner_url || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?q=80&w=2070&auto=format&fit=crop"} 
          alt={ad.business_name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-white/90">
            Sponsored
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2">
          <h3 className="font-semibold text-sm text-white drop-shadow-md">{ad.business_name}</h3>
        </div>
      </div>
    </Card>
  );
}