import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CoachSettings from '../components/settings/CoachSettings';
import TeamMemberSettings from '../components/settings/TeamMemberSettings';
import FanSettings from '../components/settings/FanSettings';
import UniversalSettings from '../components/settings/UniversalSettings';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to fetch user", error);
        // Handle not logged in case if necessary
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const renderSettingsForRole = () => {
    if (!user) return null;

    // Use initial_role_selection to distinguish team members from fans
    const role = user.initial_role_selection || user.user_role;

    switch (role) {
      case 'coach_organizer':
        return <CoachSettings />;
      case 'team_member':
        return <TeamMemberSettings />;
      case 'fan':
      default:
        return <FanSettings />;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-background rounded-lg border shadow-sm">
          {renderSettingsForRole()}
          <UniversalSettings />
        </div>
      </main>
    </div>
  );
}