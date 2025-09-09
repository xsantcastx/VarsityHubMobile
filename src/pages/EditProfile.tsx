
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Camera, Save, Upload, LogOut, UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const sportsOptions = [
  'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 'Other',
  'Track & Field', 'Swimming', 'Hockey', 'Lacrosse', 'Wrestling', 'Golf',
  'Softball', 'Cross Country', 'Gymnastics', 'Cheerleading', 'Esports'
];

export default function EditProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    zip_code: '',
    avatar_url: '',
    sports_interests: [],
    push_notifications_enabled: true,
    profile_discoverable: true, // Keep this for data consistency, even if UI control is removed
    // Coach-specific fields
    team_emblem_url: '',
    school_affiliated: false,
    contact_person_name: '',
    contact_person_email: '',
    // Team member fields
    allow_fan_dms: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setFormData({
          username: currentUser.username || '',
          full_name: currentUser.full_name || '',
          bio: currentUser.bio || '',
          zip_code: currentUser.zip_code || '',
          avatar_url: currentUser.avatar_url || '',
          sports_interests: currentUser.sports_interests || [],
          push_notifications_enabled: currentUser.push_notifications_enabled !== false,
          profile_discoverable: currentUser.profile_discoverable !== false, // Keep this
          team_emblem_url: currentUser.team_emblem_url || '',
          school_affiliated: currentUser.school_affiliated || false,
          contact_person_name: currentUser.contact_person_name || '',
          contact_person_email: currentUser.contact_person_email || '',
          allow_fan_dms: currentUser.allow_fan_dms !== false
        });
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await User.updateMyUserData(formData);
      navigate(-1); // Go back to profile
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSportToggle = (sport) => {
    const newSports = formData.sports_interests.includes(sport) ?
      formData.sports_interests.filter((s) => s !== sport) :
      [...formData.sports_interests, sport];

    if (!formData.sports_interests.includes(sport) && newSports.length > 3) {
      return; // Block adding more than 3 sports
    }

    setFormData({ ...formData, sports_interests: newSports });
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({ ...prev, avatar_url: file_url }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await User.logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeactivateAccount = () => {
    alert('Account deactivation request submitted. You will receive an email to confirm this action.');
    setShowDeactivateDialog(false);
  };

  const getUserRole = () => {
    return user?.initial_role_selection || user?.user_role;
  };

  const isCoach = getUserRole() === 'coach_organizer';
  const isTeamMember = getUserRole() === 'team_member';
  const isVeteranOrLegend = ['veteran', 'legend'].includes(user?.selected_plan);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Edit Profile</h1>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90"
        >
          {isSaving ? 'Saving...' : <Save className="w-4 h-4" />}
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Photo Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 mx-auto">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback className="text-3xl font-semibold bg-gray-100 text-gray-600">
                  {formData.username ? formData.username[0].toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-full bg-white border-2"
                  disabled={isUploading}
                  asChild
                >
                  <span>
                    {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> : <Camera className="w-4 h-4" />}
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-2">Tap to change photo</p>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Display Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Username"
                disabled={!isCoach} // Only coaches can change username after creation
              />
              {!isCoach && <p className="text-xs text-gray-500">Username cannot be changed</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biography</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => {
                  if (e.target.value.length <= 120) {
                    handleInputChange('bio', e.target.value);
                  }
                }}
                placeholder="Tell everyone a bit about yourself..."
                rows={3}
                maxLength={120}
              />
              <p className="text-xs text-gray-500">{formData.bio.length}/120 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => handleInputChange('zip_code', e.target.value)}
                placeholder="e.g., 90210"
                maxLength={5}
              />
              <p className="text-xs text-gray-500">Used for local event discovery</p>
            </div>
          </CardContent>
        </Card>

        {/* Sports Interests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sports Interests (up to 3)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {sportsOptions.map((sport) => {
                const isSelected = formData.sports_interests.includes(sport);
                const limitReached = formData.sports_interests.length >= 3;
                return (
                  <Badge
                    key={sport}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer p-2 text-center justify-center text-xs transition-all ${
                      limitReached && !isSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                    }`}
                    onClick={() => handleSportToggle(sport)}
                  >
                    {sport}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Coach-Specific Fields */}
        {isCoach && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Coach Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Affiliated with School</Label>
                  <p className="text-xs text-gray-500">Are you part of an educational institution?</p>
                </div>
                <Switch
                  checked={formData.school_affiliated}
                  onCheckedChange={(checked) => handleInputChange('school_affiliated', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Point of Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_person_name}
                  onChange={(e) => handleInputChange('contact_person_name', e.target.value)}
                  placeholder="Contact person for your teams"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Point of Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_person_email}
                  onChange={(e) => handleInputChange('contact_person_email', e.target.value)}
                  placeholder="Contact email for your teams"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Member-Specific Fields */}
        {isTeamMember && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team Member Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow DMs from Fans</Label>
                  <p className="text-xs text-gray-500">Let other fans message you directly</p>
                </div>
                <Switch
                  checked={formData.allow_fan_dms}
                  onCheckedChange={(checked) => handleInputChange('allow_fan_dms', checked)}
                />
              </div>
              
              {user?.team_name && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Team Affiliation</p>
                  <p className="text-sm text-green-600">{user.team_name}</p>
                  <p className="text-xs text-green-500">Approved by your coach/organizer</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notifications</Label>
                <p className="text-xs text-gray-500">Receive notifications about games and updates</p>
              </div>
              <Switch
                checked={formData.push_notifications_enabled}
                onCheckedChange={(checked) => handleInputChange('push_notifications_enabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Out</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to log out of your account?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLogout}>
                    Log Out
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                  <UserX className="w-4 h-4 mr-2" />
                  Deactivate Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deactivate Account</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to deactivate your account? This action will hide your profile and content but can be reversed by contacting support.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeactivateDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeactivateAccount}>
                    Deactivate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Save Button (Mobile) */}
        <div className="pb-8">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
