
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SettingsSection from './SettingsSection';
import SettingsItem from './SettingsItem';
import { UserCircle, Calendar, Bell, ShieldCheck, Heart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function FanSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    gameReminders: true,
    teamUpdates: true,
    commentsUpvotes: true,
    profileVisibility: 'public', // This state might still exist but its control will be removed from UI
    isParent: false,
  });
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showZipDialog, setShowZipDialog] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newZipCode, setNewZipCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setNewUsername(currentUser.username || '');
        setNewZipCode(currentUser.zip_code || '');
        setSettings(prev => ({ 
          ...prev, 
          isParent: currentUser.is_parent || false,
          profileVisibility: currentUser.profile_visibility || 'public' // Keep for initial state, but control is gone
        }));
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, []);

  const handleToggle = async (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
    try {
      // API expects 'is_parent' and 'profile_visibility' with underscore
      const apiSettingName = setting === 'isParent' ? 'is_parent' : 
                             setting === 'profileVisibility' ? 'profile_visibility' : setting;
      await User.updateMyUserData({ [apiSettingName]: value });
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

  const handleZipUpdate = async () => {
    try {
      await User.updateMyUserData({ zip_code: newZipCode });
      setShowZipDialog(false);
      setUser(prev => ({ ...prev, zip_code: newZipCode }));
    } catch (error) {
      console.error("Failed to update ZIP code:", error);
    }
  };

  const handlePasswordReset = () => {
    alert("Password reset email sent to your registered email address.");
  };

  const handleRequestEvent = () => {
    navigate(createPageUrl('CreateFanEvent'));
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

        <SettingsItem label="Reset Password" control="arrow" onClick={handlePasswordReset} />
        
        <Dialog open={showZipDialog} onOpenChange={setShowZipDialog}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Add ZIP Code" description="For local event discovery" control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update ZIP Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                value={newZipCode} 
                onChange={(e) => setNewZipCode(e.target.value)}
                placeholder="e.g., 90210"
                maxLength="5"
              />
              <Button onClick={handleZipUpdate} className="w-full">
                Update ZIP Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <SettingsItem label="Followed Teams" control="arrow" onClick={() => navigate(createPageUrl('Following'))} />
      </SettingsSection>
      
      <SettingsSection title="Events" icon={Calendar}>
        <SettingsItem label="Request to Host Event" control="arrow" onClick={handleRequestEvent} />
        <SettingsItem label="RSVP History" control="arrow" onClick={() => navigate(createPageUrl('RSVPHistory'))} />
      </SettingsSection>
      
      <SettingsSection title="Notifications" icon={Bell}>
        <SettingsItem 
          label="Game/Event Reminders" 
          control="toggle"
          checked={settings.gameReminders}
          onToggle={(checked) => handleToggle('gameReminders', checked)}
        />
        <SettingsItem 
          label="Team Updates" 
          control="toggle"
          checked={settings.teamUpdates}
          onToggle={(checked) => handleToggle('teamUpdates', checked)}
        />
        <SettingsItem 
          label="Comments & Upvotes" 
          control="toggle"
          checked={settings.commentsUpvotes}
          onToggle={(checked) => handleToggle('commentsUpvotes', checked)}
        />
      </SettingsSection>
      
      <SettingsSection title="Privacy" icon={ShieldCheck}>
        <SettingsItem label="Manage Blocked Users" control="arrow" onClick={() => navigate(createPageUrl('BlockedUsers'))} />
        {/* Profile Visibility Toggle removed */}
        <SettingsItem 
          label="I am a parent" 
          description="Disclose your parent status to coaches" 
          control="toggle"
          checked={settings.isParent}
          onToggle={(checked) => handleToggle('isParent', checked)}
        />
      </SettingsSection>

      <SettingsSection title="My Content" icon={Heart}>
        <SettingsItem label="View Favorites" description="Posts you've saved" control="arrow" onClick={() => navigate(createPageUrl('Favorites'))} />
      </SettingsSection>
    </>
  );
}
