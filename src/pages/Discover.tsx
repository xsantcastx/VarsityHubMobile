import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import CoachOrganizerDiscover from '../components/discover/CoachOrganizerDiscover';
import CommunityDiscover from '../components/discover/CommunityDiscover';

export default function Discover() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  // Route to appropriate Discover page based on user role
  if (user?.user_role === 'coach_organizer') {
    return <CoachOrganizerDiscover />;
  }

  return <CommunityDiscover />;
}