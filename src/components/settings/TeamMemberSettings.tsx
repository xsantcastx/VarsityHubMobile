
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SettingsSection from './SettingsSection';
import SettingsItem from './SettingsItem';
import { UserCircle, ShieldCheck, Bell, Heart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TeamMemberSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    profileVisibility: 'public',
    restrictInteractions: true,
    gameUpdates: true,
    postMentions: true,
    teamChatAlerts: true
  });
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [showJerseyDialog, setShowJerseyDialog] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setNewUsername(currentUser.username || '');
        setNewPosition(currentUser.position || '');
        setNewJerseyNumber(currentUser.jersey_number || '');
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, []);

  const handleToggle = async (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
    try {
      await User.updateMyUserData({ [setting]: value });
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  };

  const handleUsernameUpdate = async () => {
    try {
      await User.updateMyUserData({ username: newUsername });
      setShowUsernameDialog(false);
      setUser(prev => ({ ...prev, username: newUsername }));
    } catch (error) {
      console.error("Failed to update username:", error);
    }
  };

  const handlePositionUpdate = async () => {
    try {
      await User.updateMyUserData({ position: newPosition });
      setShowPositionDialog(false);
      setUser(prev => ({ ...prev, position: newPosition }));
    } catch (error) {
      console.error("Failed to update position:", error);
    }
  };

  const handleJerseyUpdate = async () => {
    try {
      await User.updateMyUserData({ jersey_number: newJerseyNumber });
      setShowJerseyDialog(false);
      setUser(prev => ({ ...prev, jersey_number: newJerseyNumber }));
    } catch (error) {
      console.error("Failed to update jersey number:", error);
    }
  };

  const handleLeaveTeam = () => {
    if (confirm("Are you sure you want to leave this team? This action cannot be undone.")) {
      // In a real app, this would remove the user from the team
      alert("You have left the team successfully.");
    }
  };

  return (
    <>
      <SettingsSection title="Account" icon={UserCircle} defaultOpen>
        <Dialog open={showUsernameDialog} onOpenChange={setShowUsernameDialog}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Edit Username" control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Username</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
              />
              <Button onClick={handleUsernameUpdate} className="w-full">
                Update Username
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Set Position" description="Player, Scout, Manager..." control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Position</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                value={newPosition} 
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="e.g., Point Guard, Manager, Scout"
              />
              <Button onClick={handlePositionUpdate} className="w-full">
                Update Position
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showJerseyDialog} onOpenChange={setShowJerseyDialog}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Jersey Number" control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Jersey Number</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                value={newJerseyNumber} 
                onChange={(e) => setNewJerseyNumber(e.target.value)}
                placeholder="e.g., 23"
                type="number"
                max="99"
              />
              <Button onClick={handleJerseyUpdate} className="w-full">
                Update Jersey Number
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <SettingsItem label="View Approved Teams" control="arrow" onClick={() => navigate(createPageUrl('MyTeams'))} />
        <SettingsItem label="View My Team" control="arrow" onClick={() => navigate(createPageUrl('MyTeam'))} />
        <SettingsItem label="Leave Team" control="arrow" onClick={handleLeaveTeam} />
      </SettingsSection>
      
      <SettingsSection title="Privacy" icon={ShieldCheck}>
        <SettingsItem label="DM Rules Summary" description="DMs are disabled between minors and adults" control="arrow" onClick={() => navigate(createPageUrl('DMRules'))} />
      </SettingsSection>
      
      <SettingsSection title="Notifications" icon={Bell}>
        <SettingsItem 
          label="Game/Event Updates" 
          control="toggle"
          checked={settings.gameUpdates}
          onToggle={(checked) => handleToggle('gameUpdates', checked)}
        />
        <SettingsItem 
          label="Post Mentions or Upvotes" 
          control="toggle"
          checked={settings.postMentions}
          onToggle={(checked) => handleToggle('postMentions', checked)}
        />
        <SettingsItem 
          label="Team Chat Alerts" 
          control="toggle"
          checked={settings.teamChatAlerts}
          onToggle={(checked) => handleToggle('teamChatAlerts', checked)}
        />
      </SettingsSection>

      <SettingsSection title="My Content" icon={Heart}>
        <SettingsItem label="View Favorites" description="Posts you've saved" control="arrow" onClick={() => navigate(createPageUrl('Favorites'))} />
      </SettingsSection>
    </>
  );
}
