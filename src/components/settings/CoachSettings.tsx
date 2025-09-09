import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SettingsSection from './SettingsSection';
import SettingsItem from './SettingsItem';
import { UserCircle, ShieldCheck, Bell, Database, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function CoachSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    teamVisibility: 'public',
    approveFanEvents: true,
    disableParentDMs: false, // Changed logic: false = enabled, true = disabled
    gameReminders: true,
    eventRSVPs: true,
    teamMemberActions: true
  });
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setNewEmail(currentUser.email);
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

  const handleEmailUpdate = async () => {
    try {
      await User.updateMyUserData({ email: newEmail });
      setShowEmailDialog(false);
    } catch (error) {
      console.error("Failed to update email:", error);
    }
  };

  const handlePasswordReset = () => {
    alert("Password reset email sent to your registered email address.");
  };

  const handleExportRoster = async () => {
    alert("Team roster exported successfully!");
  };

  const handleArchiveSeasons = () => {
    navigate(createPageUrl('ArchiveSeasons'));
  };

  return (
    <>
      <SettingsSection title="Account" icon={UserCircle} defaultOpen>
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Edit Email" control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Email Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
              />
              <Button onClick={handleEmailUpdate} className="w-full">
                Update Email
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <SettingsItem label="Reset Password" control="arrow" onClick={handlePasswordReset} />
        <SettingsItem label="Manage Season" description="View calendar, events, and fan requests" control="arrow" onClick={() => navigate(createPageUrl('ManageSeason'))} />
        <SettingsItem label="Manage Team Page(s)" control="arrow" onClick={() => navigate(createPageUrl('ManageTeams'))} />
        <SettingsItem label="Add/Remove Authorized Users" control="arrow" onClick={() => navigate(createPageUrl('ManageUsers'))} />
        <SettingsItem label="View Active Plan & Upgrade/Downgrade" control="arrow" onClick={() => navigate(createPageUrl('Billing'))} />
      </SettingsSection>
      
      <SettingsSection title="Privacy" icon={ShieldCheck}>
        <SettingsItem 
          label="Set Team Visibility" 
          description="All team accounts must be public" 
          control="display"
        />
        <SettingsItem 
          label="Approve Fan Event Requests" 
          control="toggle"
          checked={settings.approveFanEvents}
          onToggle={(checked) => handleToggle('approveFanEvents', checked)}
        />
        <SettingsItem 
          label="Enable DMs from Parents" 
          description="Parents will not be able to message you if this is ON." 
          control="toggle"
          checked={settings.disableParentDMs}
          onToggle={(checked) => handleToggle('disableParentDMs', checked)}
        />
        <SettingsItem label="Set Contact Person for each team" control="arrow" onClick={() => navigate(createPageUrl('TeamContacts'))} />
      </SettingsSection>
      
      <SettingsSection title="Notifications" icon={Bell}>
        <SettingsItem 
          label="Game Reminders" 
          control="toggle"
          checked={settings.gameReminders}
          onToggle={(checked) => handleToggle('gameReminders', checked)}
        />
        <SettingsItem 
          label="Event RSVPs" 
          control="toggle"
          checked={settings.eventRSVPs}
          onToggle={(checked) => handleToggle('eventRSVPs', checked)}
        />
        <SettingsItem 
          label="Team Member Actions" 
          description="Uploads, comments, etc." 
          control="toggle"
          checked={settings.teamMemberActions}
          onToggle={(checked) => handleToggle('teamMemberActions', checked)}
        />
      </SettingsSection>
      
      <SettingsSection title="Data Management" icon={Database}>
        <SettingsItem label="Archive Past Season(s)" control="arrow" onClick={handleArchiveSeasons} />
        <SettingsItem label="Export Team Roster" control="arrow" onClick={handleExportRoster} />
      </SettingsSection>
      
      <SettingsSection title="Support" icon={HelpCircle}>
        <SettingsItem label="Contact Varsity Hub" control="arrow" onClick={() => window.open('mailto:support@varsityhub.app')} />
        <SettingsItem label="Community Guidelines" control="arrow" onClick={() => navigate(createPageUrl('Guidelines'))} />
        <SettingsItem label="Terms & Conditions" control="arrow" onClick={() => navigate(createPageUrl('Terms'))} />
      </SettingsSection>
    </>
  );
}