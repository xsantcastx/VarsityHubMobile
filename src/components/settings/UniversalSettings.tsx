
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SendEmail } from '@/api/entities';
import { createPageUrl } from '@/utils';
import SettingsSection from './SettingsSection';
import SettingsItem from './SettingsItem';
import { Gavel, HelpCircle, LogOut } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UniversalSettings() {
  const navigate = useNavigate();
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        await User.logout();
        navigate(createPageUrl('Feed'));
      } catch (error) {
        console.error("Failed to logout:", error);
      }
    }
  };

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      alert("Account deletion requested. You will receive an email to confirm this action.");
      // In a real app, this would trigger an account deletion flow
    }
  };

  const handleContactSubmit = async () => {
    setIsSending(true);
    try {
      const currentUser = await User.me();
      await SendEmail({
        to: 'support@varsityhub.app',
        from_name: currentUser.username || 'VarsityHub User',
        subject: `Support: ${contactSubject}`,
        body: `Message from ${currentUser.email}:\n\n${contactMessage}`
      });
      setShowContactForm(false);
      alert("Thanks! We’ll respond as soon as possible.");
    } catch (error) {
      console.error("Failed to send contact form:", error);
      alert("There was an error sending your message. Please try again.");
    } finally {
      setIsSending(false);
      setContactMessage('');
      setContactSubject('');
    }
  };

  const handleReportAbuse = () => {
    navigate(createPageUrl('ReportAbuse'));
  };

  const handleRestartOnboarding = async () => {
    if (confirm("Are you sure? This will reset your onboarding status and log you out.")) {
      try {
        await User.updateMyUserData({ onboarding_completed: false });
        await User.logout();
        // The layout will handle redirecting to onboarding on next login.
        // We can navigate to the home page, which will prompt a login.
        navigate('/'); 
      } catch (error) {
        console.error("Failed to restart onboarding:", error);
        alert("An error occurred while resetting your onboarding progress. Please try again.");
      }
    }
  };

  return (
    <div className="mt-8 pt-6 border-t">
       <h2 className="px-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</h2>
      <SettingsSection title="Legal" icon={Gavel}>
        <SettingsItem label="View Core Values" control="arrow" onClick={() => navigate(createPageUrl('CoreValues'))} />
        <SettingsItem label="Report Abuse" control="arrow" onClick={handleReportAbuse} />
        <SettingsItem label="DM Restrictions Summary" control="arrow" onClick={() => navigate(createPageUrl('DMRestrictions'))} />
      </SettingsSection>

      <SettingsSection title="Support & Feedback" icon={HelpCircle}>
        <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
          <DialogTrigger asChild>
            <div>
              <SettingsItem label="Contact Varsity Hub Team" control="arrow" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contact Support</DialogTitle>
              <DialogDescription>
                We'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div>
                  <Label htmlFor="subject" className="text-right">Subject</Label>
                  <Input id="subject" value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} />
               </div>
              <div>
                <Label htmlFor="message" className="text-right">Message</Label>
                <Textarea id="message" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} rows={5} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowContactForm(false)}>Cancel</Button>
              <Button onClick={handleContactSubmit} disabled={isSending || !contactMessage || !contactSubject}>
                {isSending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SettingsItem label="App Walkthrough / Help Guide" control="arrow" onClick={() => navigate(createPageUrl('AppGuide'))} />
        <SettingsItem label="Leave Feedback" control="arrow" onClick={() => window.open('mailto:feedback@varsityhub.com?subject=App Feedback')} />
      </SettingsSection>
      <SettingsSection title="Session" icon={LogOut}>
        <SettingsItem label="Log Out" onClick={handleLogout} />
        <SettingsItem label="Delete Account" onClick={handleDeleteAccount} />
        <SettingsItem 
          label="Restart Onboarding" 
          description="This will reset your onboarding status and log you out."
          onClick={handleRestartOnboarding} 
        />
      </SettingsSection>
    </div>
  );
}
