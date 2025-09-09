import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, Trophy, Heart, Camera } from 'lucide-react';

export default function UserBadge({ user }) {
  if (!user) return null;

  const getBadgeConfig = () => {
    switch (user.user_role) {
      case 'athlete':
        return {
          icon: Star,
          text: 'A',
          className: 'bg-purple-600 text-white',
          title: 'Verified Athlete'
        };
      case 'coach_organizer':
        return {
          icon: Trophy,
          text: 'Coach',
          className: 'bg-green-600 text-white',
          title: 'Coach/Organizer'
        };
      case 'freelancer':
        return {
          icon: Camera,
          text: 'Pro',
          className: 'bg-orange-600 text-white',
          title: 'Freelancer'
        };
      default:
        return null;
    }
  };

  const badgeConfig = getBadgeConfig();
  
  if (!badgeConfig) return null;

  const IconComponent = badgeConfig.icon;

  return (
    <Badge 
      className={`${badgeConfig.className} text-xs font-bold px-2 py-1`}
      title={badgeConfig.title}
    >
      <IconComponent className="w-3 h-3 mr-1" />
      {badgeConfig.text}
    </Badge>
  );
}