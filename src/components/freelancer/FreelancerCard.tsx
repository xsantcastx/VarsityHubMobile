import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, MapPin, Camera, Video, Users, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { isFeatureEnabled } from '@/components/utils/featureFlags';

// HIDDEN FEATURE: Freelancer marketplace
export default function FreelancerCard({ freelancer, onBook, onMessage }) {
  const [showPortfolio, setShowPortfolio] = useState(false);
  
  if (!isFeatureEnabled('FREELANCER_FEATURES')) {
    return null; // Hidden when feature flag is disabled
  }

  const getSpecialtyIcon = (specialty) => {
    switch (specialty) {
      case 'photography': return Camera;
      case 'videography': return Video;
      case 'athletic_trainer': return Users;
      default: return Camera;
    }
  };

  const getSpecialtyColor = (specialty) => {
    switch (specialty) {
      case 'photography': return 'bg-blue-100 text-blue-800';
      case 'videography': return 'bg-purple-100 text-purple-800';
      case 'athletic_trainer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={freelancer.avatar_url} />
                <AvatarFallback>
                  {freelancer.full_name?.charAt(0) || 'F'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{freelancer.full_name}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>{freelancer.service_locations?.[0] || 'Local area'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">4.8</span>
              <span className="text-xs text-muted-foreground">(24)</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {freelancer.freelancer_specialties?.map((specialty, index) => {
              const IconComponent = getSpecialtyIcon(specialty);
              return (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className={getSpecialtyColor(specialty)}
                >
                  <IconComponent className="w-3 h-3 mr-1" />
                  {specialty.replace('_', ' ')}
                </Badge>
              );
            })}
          </div>

          {freelancer.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {freelancer.bio}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Starting at</p>
              <p className="font-bold text-lg">
                ${freelancer.freelancer_rates?.hourly_rate || 75}/hr
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onMessage?.(freelancer)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Message
              </Button>
              <Button 
                size="sm"
                onClick={() => onBook?.(freelancer)}
              >
                Book Now
              </Button>
            </div>
          </div>

          {freelancer.portfolio_items?.length > 0 && (
            <div>
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => setShowPortfolio(!showPortfolio)}
                className="w-full"
              >
                {showPortfolio ? 'Hide' : 'View'} Portfolio ({freelancer.portfolio_items.length})
              </Button>
              
              {showPortfolio && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-2 gap-2 mt-3"
                >
                  {freelancer.portfolio_items.slice(0, 4).map((item, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      {item.type === 'image' ? (
                        <img 
                          src={item.url} 
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}