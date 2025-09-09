
import React, { useState } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Users,
  Trophy,
  Zap,
  Camera,
  Heart,
  Target,
  Star,
  CheckCircle,
  MapPin,
  Bell,
  Calendar as CalendarIcon,
  UserPlus,
  Briefcase,
  Eye,
  ArrowRight,
  ChevronLeft,
  Navigation,
  CreditCard,
  Search,
  Shield,
  Gem,
  Medal,
  Award,
  Building,
  AlertTriangle,
  ClipboardList,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from "@/components/ui/calendar";
import { addMonths, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const roleOptions = [
  {
    id: 'fan',
    title: 'Fan',
    description: 'Follow teams, attend games, support athletes',
    icon: Heart,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    subtext: null
  },
  {
    id: 'coach_organizer',
    title: 'Coach/Organizer',
    description: 'Lead teams, organize events, build communities',
    icon: Trophy,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    subtext: 'First season free'
  },
  {
    id: 'team_member',
    title: 'Team Member',
    description: 'I am a player, coach, or part of a team staff',
    icon: Users,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    subtext: null,
    note: 'Requires approval from your Coach/Organizer'
  }
];

const sportsOptions = [
  'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 'Other',
  'Track & Field', 'Swimming', 'Hockey', 'Lacrosse', 'Wrestling', 'Golf',
  'Softball', 'Cross Country', 'Gymnastics', 'Cheerleading', 'Esports'
];

const fanFeaturePreferences = [
  { id: 'find_teams', label: 'Find Local Teams', icon: Users },
  { id: 'find_fans', label: 'Find Other Fans', icon: MapPin },
  { id: 'follow_teams', label: 'Follow Teams/Players', icon: Eye }
];

const coachFeaturePreferences = [
  { id: 'find_games', label: 'Find Local Games', icon: MapPin },
  { id: 'add_players', label: 'Add Players', icon: UserPlus },
  { id: 'follow_teams', label: 'Follow Teams/Players', icon: Eye }
];

const athleteFeaturePreferences = [
  { id: 'find_games', label: 'Find Local Games', icon: MapPin },
  { id: 'join_team', label: 'Join a Team', icon: UserPlus },
  { id: 'follow_teams', label: 'Follow Teams/Players', icon: Eye }
];

// Updated coachPricingPlans structure
const coachPricingPlans = {
  rookie: {
    id: 'rookie',
    title: 'Rookie',
    regularPrice: 20,
    features: [
      'Manages 1 team',
      'First Season Free',
      'Add 1 authorized user',
      'Fans can pitch events for approval'
    ],
    popular: false,
    description: 'Best for individual coaches',
    icon: Award,
    useCase: 'Best for local coaches, e.g., Little League, Rec Leagues'
  },
  veteran: {
    id: 'veteran',
    title: 'Veteran',
    monthlyPrice: 7.50,
    annualPrice: 70, // Updated from 75 to 70
    features: [
      'Manages up to 6 teams',
      'Assigns up to 12 authorized users',
      'Creates School/Organization Page',
      'Includes year-round access',
      'Fan accounts can download media'
    ],
    popular: true,
    description: 'Save $20 annually', // Updated from $15 to $20
    icon: Gem,
    useCase: 'Ideal for athletic directors'
  },
  legend: {
    id: 'legend',
    title: 'Legend',
    annualPrice: 150,
    features: [
      'Manages unlimited teams & clubs',
      'Create academic or extracurricular pages',
      'Unlimited authorized users',
      'Includes year-round access'
    ],
    popular: false,
    description: 'For large-scale management',
    badge: Medal,
    useCase: 'Best for school administrators overseeing entire institutions'
  }
};

const featureDescriptions = {
  fan: "Connect with your local sports community and discover events.",
  team_member: "What do you want to do here?",
  coach_organizer: "What do you want to do here?"
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    user_role: '',
    initial_role_selection: '',
    username: '',
    email: '',
    date_of_birth: '',
    zip_code: '', // Changed from location to zip_code
    bio: '',
    sports_interests: [],
    feature_preferences: [],
    location_permission: false,
    notification_permission: false,
    position: '',
    jersey_number: '',
    team_name: '',
    team_age_group: '',
    selected_plan: '',
    billing_cycle: 'annual', // New field: 'monthly' or 'annual'
    school_affiliated: null,
    other_sport_text: '',
    season_start_date: null, // For Rookie plan
    season_end_date: null, // For Rookie plan
    // New fields for school/organization setup (Veteran/Legend) and Rookie team setup
    school_name: '', // Used for school name (Veteran/Legend) or parent organization name (Rookie)
    school_location: '', // Used for school location (Veteran/Legend) or team location (Rookie)
    school_contact_name: '',
    school_contact_email: '',
    school_description: '',
    school_type: '',
    authorized_users: [],
    current_user_email: '',
    current_user_team: '',
    current_user_role: 'team_manager', // Default role for added user
    // Onboarding status flags
    school_page_created: false, // General flag for organization/team page created
    authorized_users_added: false,
    team_pages_pending: true,
    schedule_skipped: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const selectedRole = roleOptions.find((role) => role.id === formData.initial_role_selection);

  const handleRoleSelect = (roleId) => {
    const actualRole = roleId === 'team_member' ? 'fan' : roleId;
    setFormData({
      ...formData,
      user_role: actualRole,
      initial_role_selection: roleId
    });
    setStep(2);
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

  const handleFeatureToggle = (featureId) => {
    const newFeatures = formData.feature_preferences.includes(featureId) ?
      formData.feature_preferences.filter((f) => f !== featureId) :
      [...formData.feature_preferences, featureId];
    setFormData({ ...formData, feature_preferences: newFeatures });
  };

  const getFeaturePreferencesForRole = () => {
    switch (formData.initial_role_selection) {
      case 'fan': return fanFeaturePreferences;
      case 'coach_organizer': return coachFeaturePreferences;
      case 'team_member': return athleteFeaturePreferences;
      default: return fanFeaturePreferences;
    }
  };

  // New helper function for email validation
  const validateEmail = (email, requiresEdu = false) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    if (requiresEdu && !email.toLowerCase().endsWith('.edu')) return false;
    return true;
  };

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const sportsInterestsToSend = [...formData.sports_interests];
      const otherIndex = sportsInterestsToSend.indexOf('Other');
      if (otherIndex > -1) {
        if (formData.other_sport_text.trim()) {
          sportsInterestsToSend[otherIndex] = formData.other_sport_text.trim();
        } else {
          sportsInterestsToSend.splice(otherIndex, 1);
        }
      }

      const isCoach = formData.initial_role_selection === 'coach_organizer';
      const isRookieCoach = isCoach && formData.selected_plan === 'rookie';
      const isVeteranOrLegend = ['veteran', 'legend'].includes(formData.selected_plan);

      await User.updateMyUserData({
        user_role: formData.user_role,
        initial_role_selection: formData.initial_role_selection,
        username: formData.username,
        email: formData.email,
        date_of_birth: formData.date_of_birth,
        zip_code: formData.zip_code,
        bio: formData.bio,
        sports_interests: sportsInterestsToSend,
        feature_preferences: formData.feature_preferences,
        position: formData.position,
        jersey_number: formData.jersey_number,
        team_name: isRookieCoach ? formData.team_name : undefined, // Only for Rookie coaches
        team_age_group: isRookieCoach ? formData.team_age_group : undefined, // Only for Rookie coaches
        subscription_status: 'active', // Assume successful payment/free plan activation
        onboarding_completed: true,
        school_affiliated: formData.school_affiliated,
        selected_plan: formData.selected_plan,
        billing_cycle: formData.billing_cycle,
        season_start_date: formData.season_start_date,
        season_end_date: formData.season_end_date,
        // Coach/Organizer specific fields (applicable to all coach types for school/organization name/location)
        school_name: isCoach ? formData.school_name : undefined,
        school_location: isCoach ? formData.school_location : undefined,
        authorized_users: isCoach ? formData.authorized_users : undefined, // Applicable to all coaches now

        // Fields specific to Veteran/Legend plans
        school_contact_name: isVeteranOrLegend ? formData.school_contact_name : undefined,
        school_contact_email: isVeteranOrLegend ? formData.school_contact_email : undefined,
        school_description: isVeteranOrLegend ? formData.school_description : undefined,
        school_type: isVeteranOrLegend ? formData.school_type : undefined,

        // Onboarding status flags
        school_page_created: isRookieCoach || isVeteranOrLegend ? true : formData.school_page_created, // True if any coach creates their org/team page
        authorized_users_added: isCoach && formData.authorized_users.length > 0 ? true : formData.authorized_users_added,
        team_pages_pending: formData.team_pages_pending,
        schedule_skipped: formData.schedule_skipped
      });

      navigate(createPageUrl('Feed'));
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepProgress = () => {
    const isCoach = formData.initial_role_selection === 'coach_organizer';
    if (!isCoach) return `${step}/6`;

    const isRookie = formData.selected_plan === 'rookie';
    const isVeteranOrLegend = ['veteran', 'legend'].includes(formData.selected_plan);

    // Determine total steps based on plan type for coaches
    let totalCoachSteps = 0;
    if (isRookie) {
      totalCoachSteps = 10; // Updated: Basic Info, Pricing, Rookie Season, Team Page, Authorized Users, Profile, Features, Permissions, Confirmation
    } else if (isVeteranOrLegend) {
      totalCoachSteps = 10; // Basic Info, Pricing, School Page, Authorized Users, Profile, Features, Permissions, Confirmation
    }

    return `${step}/${totalCoachSteps}`;
  };

  // Helper to adjust step number for display in shared components
  const getDisplayStepNumber = (actualStep) => {
    const isCoach = formData.initial_role_selection === 'coach_organizer';
    const isRookieCoach = isCoach && formData.selected_plan === 'rookie';
    const isVeteranOrLegendCoach = isCoach && ['veteran', 'legend'].includes(formData.selected_plan);
    const isFanOrTeamMember = !isCoach;

    if (isFanOrTeamMember) {
      if (actualStep === 3) return 3; // Profile
      if (actualStep === 7) return 4; // Features
      if (actualStep === 8) return 5; // Permissions
      if (actualStep === 9) return 6; // Confirmation
      return actualStep; // 1 (Role), 2 (Basic Info)
    }

    if (isRookieCoach) {
      return actualStep; // For Rookie coach, internal step is same as display step
    }

    if (isVeteranOrLegendCoach) {
      if (actualStep === 5) return 4; // School Page
      if (actualStep === 6) return 5; // Authorized Users
      if (actualStep === 7) return 6; // Profile
      if (actualStep === 8) return 7; // Features
      if (actualStep === 9) return 8; // Permissions
      if (actualStep === 10) return 9; // Confirmation
      return actualStep; // 1 (Role), 2 (Basic Info), 3 (Pricing)
    }

    return actualStep; // Default fallback, should ideally not be hit for defined flows
  };

  // --- Reusable Content Blocks ---
  const ProfileSetupStepContent = ({ currentStep, onBack, onContinue }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-lg mx-auto pt-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
            <h2 className="text-2xl font-bold">Create Your Profile</h2>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${selectedRole?.color} flex items-center justify-center mx-auto mb-4`}>
                {selectedRole && <selectedRole.icon className="w-12 h-12 text-white" />}
              </div>
              <Badge className="bg-primary text-slate-50 px-2.5 py-0.5 text-xs font-semibold inline-flex items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80">{selectedRole?.title}</Badge>
              {selectedRole?.id === 'team_member' &&
                <p className="text-xs text-slate-500 mt-2">Starting as Fan - awaiting coach approval</p>
              }
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Profile Picture</label>
              <Button variant="outline" className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Bio/Tagline</label>
              <Textarea
                placeholder="Tell everyone a bit about yourself..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3} />
            </div>

            {formData.initial_role_selection === 'team_member' &&
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <Input
                    placeholder="e.g., Point Guard"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Jersey #</label>
                  <Input
                    placeholder="e.g., 23"
                    value={formData.jersey_number}
                    onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })} />
                </div>
              </div>
            }

            <div>
              <Label className="block text-sm font-medium mb-3">Sports Interests (select up to 3)</Label>
              <div className="grid grid-cols-3 gap-2">
                {sportsOptions.map((sport) => {
                  const isSelected = formData.sports_interests.includes(sport);
                  const limitReached = formData.sports_interests.length >= 3;
                  return (
                    <Badge
                      key={sport}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer p-2 text-center justify-center text-xs transition-all ${limitReached && !isSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
                      onClick={() => handleSportToggle(sport)}>
                      {sport}
                    </Badge>
                  );
                })}
              </div>
              {formData.sports_interests.includes('Other') &&
                <div className="mt-4">
                  <Label className="block text-sm font-medium mb-2">Please specify "Other" sport</Label>
                  <Input
                    placeholder="e.g., Water Polo"
                    value={formData.other_sport_text}
                    onChange={(e) => setFormData({ ...formData, other_sport_text: e.target.value })} />

                </div>
              }
            </div>

            <Button onClick={onContinue} className="w-full">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );


  const FeaturePreferencesStepContent = ({ currentStep, onBack, onContinue }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-lg mx-auto pt-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
            <h2 className="2xl font-bold">What interests you most?</h2>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-slate-600 text-center mb-6">{featureDescriptions[formData.initial_role_selection]}</p>

            <div className="space-y-3">
              {getFeaturePreferencesForRole().map((feature) => {
                const IconComponent = feature.icon;
                const isSelected = formData.feature_preferences.includes(feature.id);
                return (
                  <motion.div
                    key={feature.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleFeatureToggle(feature.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected ?
                        'border-blue-500 bg-blue-50' :
                        'border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {feature.label}
                      </span>
                      {isSelected && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <Button
              onClick={onContinue}
              disabled={formData.feature_preferences.length === 0}
              className="w-full">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );


  const PermissionsStepContent = ({ currentStep, onBack, onContinue }) => {
    const [policyAgreed, setPolicyAgreed] = useState(false);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-lg mx-auto pt-8">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
              <h2 className="text-2xl font-bold">Enable Features</h2>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Location Access</h3>
                    <p className="text-sm text-slate-600 mb-3">Show nearby games and events in your area</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="location"
                        checked={formData.location_permission}
                        onCheckedChange={(checked) => setFormData({ ...formData, location_permission: checked })} />
                      <label htmlFor="location" className="text-sm font-medium">Allow location access</label>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Push Notifications</h3>
                    <p className="text-sm text-slate-600 mb-3">Get updates about games, RSVPs, and messages</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications"
                        checked={formData.notification_permission}
                        onCheckedChange={(checked) => setFormData({ ...formData, notification_permission: checked })} />
                      <Label htmlFor="notifications" className="text-sm font-medium">Enable notifications</Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Varsity Hub Messaging Policy</h3>
                    <div className="text-xs text-slate-600 space-y-2">
                      <p>Direct messaging is age-gated. Users 17 & under can only message other minors. Coach/Organizer accounts are accessible to all users. Varsity Hub prioritizes safety and compliance.</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-4">
                      <Checkbox
                        id="policy"
                        checked={policyAgreed}
                        onCheckedChange={(checked) => setPolicyAgreed(checked)} />

                      <Label htmlFor="policy" className="text-sm font-medium">I understand and agree to this policy.</Label>
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={onContinue} className="w-full" disabled={!policyAgreed}>
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );

  };


  const ConfirmationStepContent = ({ onContinue }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-lg mx-auto pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center">

          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold mb-2">You're all set!</h1>
          <p className="text-lg text-slate-600 mb-8">
            Welcome to VarsityHub, {formData.username}!
          </p>

          <Card className="mb-8 text-left">
            <CardHeader>
              <CardTitle>Getting Started Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Discover Games & Players</h4>
                  <p className="text-sm text-slate-600">Use the Discover tab to find upcoming games, follow live scores, and scout players.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Join the Action</h4>
                  <p className="text-sm text-slate-600">
                    {formData.initial_role_selection === 'fan' ?
                      "RSVP to events created by organizers or create your own! Organize fundraisers, birthdays, and watch parties." :
                      "RSVP to events created by organizers or create your own pickup game or watch party."
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Follow & Connect</h4>
                  <p className="text-sm text-slate-600">Follow your favorite teams and players to get their latest updates on your feed.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={onContinue}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-lg">
            {isSubmitting ?
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Setting up your account...
              </div> :
              <>
                Let's find your first game!
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            }
          </Button>
        </motion.div>
      </div>
    </div>
  );



  // Step 1: Account Type Selection
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to VarsityHub!</h1>
            <p className="text-lg text-slate-600">Which best describes you?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {roleOptions.map((role, index) => {
              const IconComponent = role.icon;
              return (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoleSelect(role.id)}
                  className="cursor-pointer">

                  <Card className={`h-full hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200 ${role.bgColor}`}>
                    <CardContent className="p-6 text-center">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${role.color} flex items-center justify-center mb-4 mx-auto shadow-lg`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold" style={{ color: role.textColor }}>{role.title}</h3>
                      {role.subtext &&
                        <p className={`text-sm font-medium ${role.textColor} mb-2`}>{role.subtext}</p>
                      }
                      <p className="text-slate-600 text-sm mb-2">{role.description}</p>
                      {role.note &&
                        <p className="text-xs text-slate-500 italic">{role.note}</p>
                      }
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Basic Info (with Coach Affiliation Question)
  if (step === 2) {
    const isCoach = formData.initial_role_selection === 'coach_organizer';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-lg mx-auto pt-8">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
              <h2 className="text-2xl font-bold">Basic Information</h2>
              {isCoach &&
                <p className="text-sm text-green-600 mt-1">First season free!</p>
              }
            </div>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="block text-sm font-medium mb-2">Username</Label>
                <Input
                  placeholder="Choose a public username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
              </div>

              {/* Coach Affiliation Question - Stacked Flow */}
              {isCoach ?
                <div>
                  <AnimatePresence mode="wait">
                    {formData.school_affiliated === null ?
                      <motion.div
                        key="affiliation-question"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-3 text-center">

                        <Label className="block text-sm font-medium">Are you affiliated with a school or independent organization?</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => setFormData({ ...formData, school_affiliated: true })}>School</Button>
                          <Button variant="outline" onClick={() => setFormData({ ...formData, school_affiliated: false })}>Independent</Button>
                        </div>
                      </motion.div> :

                      <motion.div
                        key="email-input"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}>

                        <Label className="block text-sm font-medium mb-2">Email</Label>
                        <Input
                          type="email"
                          placeholder={formData.school_affiliated ? "Enter your .edu email" : "Enter your email"}
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        {formData.email && !validateEmail(formData.email, formData.school_affiliated) &&
                          <p className="text-xs text-red-500 mt-1">
                            {formData.school_affiliated ? "Please enter a valid .edu email address." : "Please enter a valid email address."}
                          </p>
                        }
                        <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setFormData({ ...formData, school_affiliated: null, email: '' })}>Change affiliation</Button>
                      </motion.div>
                    }
                  </AnimatePresence>
                </div> :

                // Email for non-coaches
                <div>
                  <Label className="block text-sm font-medium mb-2">Email</Label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  {formData.email && !validateEmail(formData.email) &&
                    <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>
                  }
                </div>
              }

              <div>
                <Label className="block text-sm font-medium mb-2">Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                <p className="text-xs text-slate-500 mt-1">Required for messaging safety features</p>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">ZIP Code</Label>
                <Input
                  placeholder="e.g., 90210"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })} />
              </div>

              <Button
                onClick={() => setStep(3)}
                disabled={
                  !formData.username ||
                  !formData.date_of_birth ||
                  !formData.zip_code ||
                  (isCoach && formData.school_affiliated === null) || (
                    isCoach ? !validateEmail(formData.email, formData.school_affiliated) : !validateEmail(formData.email))
                }
                className="w-full">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Coach Pricing OR Fan/Team Member Profile Setup
  if (step === 3) {
    // Payment setup for Coach/Organizer
    if (formData.initial_role_selection === 'coach_organizer') {
      const handlePlanSelect = (planId) => {
        const newBillingCycle = planId === 'rookie' ? 'season' : planId === 'legend' ? 'annual' : formData.billing_cycle;
        setFormData({ ...formData, selected_plan: planId, billing_cycle: newBillingCycle });
      };

      const handleBillingCycleSelect = (cycle) => {
        setFormData({ ...formData, billing_cycle: cycle });
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="max-w-4xl mx-auto pt-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(2)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 text-center">
                <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
                <h2 className="text-2xl font-bold">Choose Your Plan</h2>
                <p className="text-slate-600">Select the best option for your coaching needs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.values(coachPricingPlans).map((plan) => {
                const isSelected = formData.selected_plan === plan.id;
                const PlanIconComponent = plan.icon || plan.badge;

                return (
                  <motion.div
                    key={plan.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-full">

                    <Card
                      className={`cursor-pointer transition-all duration-300 h-full flex flex-col ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:shadow-xl border-slate-200'} ${
                        plan.popular ? 'relative' : ''}`}
                      onClick={() => handlePlanSelect(plan.id)}>

                      {plan.popular &&
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                        </div>
                      }
                      <CardContent className="p-6 flex flex-col items-center text-center space-y-4 flex-grow">
                        <div className="flex items-center gap-3">
                          {PlanIconComponent && <PlanIconComponent className="w-7 h-7 text-primary" />}
                          <h3 className="text-xl font-bold">{plan.title}</h3>
                        </div>

                        <div className="text-center h-20 flex flex-col justify-center">
                          {plan.id === 'rookie' ?
                            <div>
                              <p className="text-4xl font-extrabold text-primary">FREE</p>
                              <p className="text-sm text-muted-foreground">First 6-month season</p>
                              <p className="text-xs text-slate-400 line-through">Regularly ${plan.regularPrice}</p>
                            </div> :
                            plan.id === 'veteran' ?
                              <div>
                                <p className="text-4xl font-extrabold">${plan.annualPrice}<span className="text-base font-medium text-muted-foreground">/year</span></p>
                                <p className="text-sm text-muted-foreground">or ${plan.monthlyPrice}/month</p>
                              </div> :

                              <div>
                                <p className="text-4xl font-extrabold">${plan.annualPrice}<span className="text-base font-medium text-muted-foreground">/year</span></p>
                                <p className="text-sm text-muted-foreground">&nbsp;</p>
                              </div>
                          }
                        </div>

                        <p className="text-sm text-slate-600 px-2 h-10">{plan.description}</p>

                        <ul className="space-y-2 text-sm text-slate-700 text-left pt-4 border-t w-full flex-grow">
                          {plan.features.map((feature, index) =>
                            <li key={index} className="flex items-start gap-3">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          )}
                        </ul>
                        <p className="text-xs text-slate-500 pt-2 italic mt-auto">{plan.useCase}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {formData.selected_plan === 'veteran' &&
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="my-6 p-4 border rounded-lg bg-secondary/50">

                <h3 className="text-center font-semibold mb-3">Choose Billing Cycle</h3>
                <ToggleGroup
                  type="single"
                  value={formData.billing_cycle}
                  onValueChange={handleBillingCycleSelect}
                  className="grid grid-cols-2">

                  <ToggleGroupItem value="monthly" className="flex flex-col h-auto py-2">
                    <span>Monthly</span>
                    <span className="text-sm font-bold">${coachPricingPlans.veteran.monthlyPrice}/month</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="annual" className="flex flex-col h-auto py-2">
                    <span>Annual</span>
                    <span className="text-sm font-bold">${coachPricingPlans.veteran.annualPrice}/year</span>
                    <Badge variant="outline" className="mt-1">Save $20</Badge>
                  </ToggleGroupItem>
                </ToggleGroup>
              </motion.div>
            }

            <Button
              onClick={() => setStep(formData.selected_plan === 'rookie' ? 4 : 5)} // Rookie goes to 4, Veteran/Legend go to 5
              disabled={!formData.selected_plan}
              className="w-full h-12 text-lg">
              <CreditCard className="w-5 h-5 mr-2" />
              Continue
            </Button>
          </div>
        </div>
      );

    } else {
      // Regular profile setup for Fan/Team Member
      return <ProfileSetupStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(2)} onContinue={() => setStep(7)} />;
    }
  }

  // Step 4: Rookie Season Calendar Setup (Only for Rookie Coach Plan)
  if (step === 4 && formData.initial_role_selection === 'coach_organizer' && formData.selected_plan === 'rookie') {
    const handleDateSelect = (date) => {
      setFormData({
        ...formData,
        season_start_date: date,
        season_end_date: date ? addMonths(date, 5) : null // Changed from 6 to 5 months
      });
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-lg mx-auto pt-8">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" onClick={() => setStep(3)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
              <h2 className="text-2xl font-bold">Set Your Season</h2>
              <p className="text-slate-600">Choose your 6-month free season window to activate your team page.</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <Calendar
                mode="single"
                selected={formData.season_start_date}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                initialFocus />

              {formData.season_start_date && formData.season_end_date &&
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="font-semibold text-blue-800">Your free season will run from:</p>
                  <p className="text-blue-700">
                    {format(formData.season_start_date, 'PPP')} to {format(formData.season_end_date, 'PPP')}
                  </p>
                </div>
              }
            </CardContent>
          </Card>
          <Button onClick={() => setStep(5)} disabled={!formData.season_start_date} className="w-full mt-4">
            Confirm Season & Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );

  }

  // Step 5: Rookie Team Page Creation OR Veteran/Legend School Page Creation OR Fan/Team Member Profile Setup
  if (step === 5) {
    const isRookieCoach = formData.initial_role_selection === 'coach_organizer' && formData.selected_plan === 'rookie';
    const isVeteranOrLegendCoach = formData.initial_role_selection === 'coach_organizer' && ['veteran', 'legend'].includes(formData.selected_plan);

    if (isRookieCoach) {
      // NEW: Rookie Team Page Creation
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="max-w-lg mx-auto pt-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(4)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 text-center">
                <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
                <h2 className="text-2xl font-bold">Create Your Team Page</h2>
                <p className="text-slate-600">Set up your team's official page</p>
              </div>
            </div>

            <Card className="mb-6 bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Trophy className="w-5 h-5" />
                  Team Page Benefits
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-green-700 space-y-2">
                <p>• Parents and fans can follow your team</p>
                <p>• Share updates, photos, and game results</p>
                <p>• Manage your roster and schedule</p>
                <p>• Receive fan event requests for approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name *</Label>
                  <Input
                    id="team-name"
                    placeholder="e.g., Eagles Varsity Football"
                    value={formData.team_name}
                    onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization">Organization *</Label>
                  <Input
                    id="organization"
                    placeholder="e.g., Lincoln Middle School, Metro Youth League"
                    value={formData.school_name}
                    onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-location">Location *</Label>
                  <Input
                    id="team-location"
                    placeholder="e.g., Springfield, IL"
                    value={formData.school_location}
                    onChange={(e) => setFormData({ ...formData, school_location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-age-group">Age Group/Level</Label>
                  <Select value={formData.team_age_group} onValueChange={(value) => setFormData({ ...formData, team_age_group: value })}>
                    <SelectTrigger id="team-age-group">
                      <SelectValue placeholder="Select age group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youth">Youth (Under 12)</SelectItem>
                      <SelectItem value="middle_school">Middle School</SelectItem>
                      <SelectItem value="high_school">High School</SelectItem>
                      <SelectItem value="adult_rec">Adult Recreation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => setStep(6)}
                  disabled={!formData.team_name || !formData.school_name || !formData.school_location}
                  className="w-full">
                  Create Team Page <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );

    } else if (isVeteranOrLegendCoach) {
      const pageType = formData.school_affiliated ? 'School' : 'League';
      const pageTypeLabel = formData.school_affiliated ? 'School/Organization' : 'League/Organization';

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="max-w-lg mx-auto pt-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(3)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 text-center">
                <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
                <h2 className="text-2xl font-bold">Create Your {pageType} Page</h2>
                <p className="text-slate-600">This is the hub where all your teams will live</p>
              </div>
            </div>

            {/* Hierarchy Explanation */}
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Building className="w-5 h-5" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700 space-y-2">
                <div className="font-mono text-xs bg-blue-100 p-3 rounded">
                  🏫 {formData.school_name || `Your ${pageType}`} ({pageType} Page)<br />
                  ├── 🏈 Varsity Football (Team Page)<br />
                  ├── 🏀 JV Basketball (Team Page)<br />
                  └── ⚽ Girls Soccer (Team Page)
                </div>
                <p><strong>{pageType} Page:</strong> Managed by you, displays all programs</p>
                <p><strong>Team Pages:</strong> Managed by Authorized Users you assign</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="school-name">{pageTypeLabel} Name *</Label>
                  <Input
                    id="school-name"
                    placeholder={formData.school_affiliated ? "e.g., Stamford High School" : "e.g., Metro Youth Basketball League"}
                    value={formData.school_name}
                    onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                  />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="school-location">Location *</Label>
                  <Input
                    id="school-location"
                    placeholder="e.g., Stamford, CT"
                    value={formData.school_location}
                    onChange={(e) => setFormData({ ...formData, school_location: e.target.value })}
                  />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="school-type">Organization Type</Label>
                  <Select value={formData.school_type} onValueChange={(value) => setFormData({ ...formData, school_type: value })}>
                    <SelectTrigger id="school-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.school_affiliated ? (
                        <>
                          <SelectItem value="public_school">Public School</SelectItem>
                          <SelectItem value="private_school">Private School</SelectItem>
                          <SelectItem value="charter_school">Charter School</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="aau_program">AAU Program</SelectItem>
                          <SelectItem value="club_organization">Club Organization</SelectItem>
                          <SelectItem value="recreational_league">Recreational League</SelectItem>
                        </>
                      )}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-name">Main Contact Person *</Label>
                  <Input
                    id="contact-name"
                    placeholder="Your full name"
                    value={formData.school_contact_name}
                    onChange={(e) => setFormData({ ...formData, school_contact_name: e.target.value })}
                  />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Contact Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder={formData.school_affiliated ? "your.email@school.edu" : "your.email@organization.com"}
                    value={formData.school_contact_email}
                    onChange={(e) => setFormData({ ...formData, school_contact_email: e.target.value })}
                  />

                </div>

                <div className="space-y-2">
                  <Label htmlFor="school-description">Description (Optional)</Label>
                  <Textarea
                    id="school-description"
                    placeholder={formData.school_affiliated ? "Brief description of your school or organization..." : "Brief description of your league or organization..."}
                    value={formData.school_description}
                    onChange={(e) => setFormData({ ...formData, school_description: e.target.value })}
                    rows={3}
                  />

                </div>

                <Button
                  onClick={() => setStep(6)}
                  disabled={!formData.school_name || !formData.school_location || !formData.school_contact_name || !formData.school_contact_email}
                  className="w-full">

                  Create {pageType} Page <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );

    } else {
      // Fan/Team Member profile setup
      return <ProfileSetupStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(2)} onContinue={() => setStep(7)} />;
    }
  }

  // Step 6: Add Authorized Users for ALL Coach Types OR Profile Setup for Fan/Team Member
  if (step === 6) {
    const isRookieCoach = formData.initial_role_selection === 'coach_organizer' && formData.selected_plan === 'rookie';
    const isVeteranOrLegendCoach = formData.initial_role_selection === 'coach_organizer' && ['veteran', 'legend'].includes(formData.selected_plan);

    if (isRookieCoach) {
      // NEW: Rookie Authorized Users (limited to 1)
      const addAuthorizedUser = () => {
        if (formData.current_user_email) {
          setFormData({
            ...formData,
            authorized_users: [
              ...formData.authorized_users,
              {
                email: formData.current_user_email,
                assigned_team: formData.team_name, // Assign to the team they just created
                role: formData.current_user_role,
                status: 'pending'
              }],
            current_user_email: '',
            current_user_role: 'assistant_coach'
          });
        }
      };

      const removeUser = (index) => {
        const updatedUsers = formData.authorized_users.filter((_, i) => i !== index);
        setFormData({ ...formData, authorized_users: updatedUsers });
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="max-w-lg mx-auto pt-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(5)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 text-center">
                <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
                <h2 className="text-2xl font-bold">Add Team Assistant</h2>
                <p className="text-slate-600">Add an assistant coach or team manager (optional)</p>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-green-800">✅ {formData.team_name} Created</CardTitle>
                <CardDescription>You can add 1 assistant to help manage your team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.authorized_users.length === 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Assistant Email</Label>
                      <Input
                        placeholder="assistant@email.com"
                        value={formData.current_user_email}
                        onChange={(e) => setFormData({ ...formData, current_user_email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={formData.current_user_role} onValueChange={(value) => setFormData({ ...formData, current_user_role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assistant_coach">Assistant Coach</SelectItem>
                          <SelectItem value="team_manager">Team Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={addAuthorizedUser}
                      className="w-full"
                      variant="outline"
                      disabled={!formData.current_user_email || !validateEmail(formData.current_user_email)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Assistant
                    </Button>
                  </>
                ) : (
                  <div className="p-3 bg-slate-100 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{formData.authorized_users[0].email}</p>
                        <p className="text-xs text-slate-600">{formData.authorized_users[0].role}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeUser(0)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button onClick={() => setStep(7)} className="w-full">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-slate-500 text-center">
                You can add or remove assistants later in Settings
              </p>
            </div>
          </div>
        </div>
      );

    } else if (isVeteranOrLegendCoach) {
      const pageType = formData.school_affiliated ? 'School' : 'League';

      const addAuthorizedUser = () => {
        if (formData.current_user_email && formData.current_user_team) {
          setFormData({
            ...formData,
            authorized_users: [
              ...formData.authorized_users,
              {
                email: formData.current_user_email,
                assigned_team: formData.current_user_team,
                role: formData.current_user_role,
                status: 'pending'
              }],

            current_user_email: '',
            current_user_team: '',
            current_user_role: 'team_manager'
          });
        }
      };

      const removeUser = (index) => {
        const updatedUsers = formData.authorized_users.filter((_, i) => i !== index);
        setFormData({ ...formData, authorized_users: updatedUsers });
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="max-w-lg mx-auto pt-8">
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(5)}> {/* Back to School/League Page Creation */}
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 text-center">
                <div className="text-sm text-slate-500">Step {getStepProgress()}</div>
                <h2 className="text-2xl font-bold">Add Authorized Users</h2>
                <p className="text-slate-600">They'll manage individual team pages under your {pageType.toLowerCase()}</p>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-green-800">✅ {formData.school_name} Created</CardTitle>
                <CardDescription>Now add users to manage your teams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>User Email</Label>
                  <Input
                    placeholder="coach@email.com"
                    value={formData.current_user_email}
                    onChange={(e) => setFormData({ ...formData, current_user_email: e.target.value })} />

                </div>

                <div className="space-y-2">
                  <Label>Assign to Team</Label>
                  <Input
                    placeholder="e.g., Varsity Football"
                    value={formData.current_user_team}
                    onChange={(e) => setFormData({ ...formData, current_user_team: e.target.value })} />

                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formData.current_user_role} onValueChange={(value) => setFormData({ ...formData, current_user_role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_manager">Team Manager</SelectItem>
                      <SelectItem value="assistant_coach">Assistant Coach</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={addAuthorizedUser} className="w-full" variant="outline"
                  disabled={!formData.current_user_email || !formData.current_user_team || !validateEmail(formData.current_user_email)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </CardContent>
            </Card>

            {/* Current Authorized Users */}
            {formData.authorized_users.length > 0 &&
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Authorized Users ({formData.authorized_users.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {formData.authorized_users.map((user, index) =>
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-100 rounded">
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-slate-600">{user.assigned_team} • {user.role}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeUser(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            }

            <div className="space-y-3">
              <Button
                onClick={() => setStep(7)}
                className="w-full">

                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-xs text-slate-500 text-center">
                You can add more users later in Settings
              </p>
            </div>
          </div>
        </div>
      );

    } else {
      // Fan/Team Member Feature Preferences (from step 3)
      return <FeaturePreferencesStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(3)} onContinue={() => setStep(8)} />;
    }
  }

  // Step 7: Coach Profile Setup OR Fan/Team Member Permissions
  if (step === 7) {
    const isCoach = formData.initial_role_selection === 'coach_organizer';

    if (isCoach) {
      // Coach Profile Setup (Rookie or Veteran/Legend)
      return <ProfileSetupStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(6)} onContinue={() => setStep(8)} />;
    } else {
      // Fan/Team Member Permissions
      return <PermissionsStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(7)} onContinue={completeOnboarding} />;
    }
  }

  // Step 8: Coach Feature Preferences OR Fan/Team Member Confirmation
  if (step === 8) {
    const isCoach = formData.initial_role_selection === 'coach_organizer';

    if (isCoach) {
      // Coach Feature Preferences (Rookie or Veteran/Legend)
      return <FeaturePreferencesStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(7)} onContinue={() => setStep(9)} />;
    } else {
      // Fan/Team Member Confirmation
      return <ConfirmationStepContent onContinue={completeOnboarding} />;
    }
  }

  // Step 9: Coach Permissions
  if (step === 9 && formData.initial_role_selection === 'coach_organizer') {
    return (
      <div>
        <PermissionsStepContent currentStep={getDisplayStepNumber(step)} onBack={() => setStep(8)} onContinue={() => setStep(10)} />
        {formData.selected_plan === 'veteran' || formData.selected_plan === 'legend' ? (
          <div className="max-w-lg mx-auto p-4">
            <Card className="mt-4 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800"><Building className="w-5 h-5" />School vs. Team Pages</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700 space-y-2">
                <p><strong className="font-semibold">School Pages</strong> (created by you) are the main hub for your organization.</p>
                <p><strong className="font-semibold">Team Pages</strong> (created by your Authorized Users) are the public-facing pages for individual teams, nested under your school.</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    );
  }

  // Step 10: Coach Confirmation (Rookie or Veteran/Legend)
  if (step === 10 && formData.initial_role_selection === 'coach_organizer') {
    const isRookieCoach = formData.selected_plan === 'rookie';
    const isVeteranOrLegendCoach = ['veteran', 'legend'].includes(formData.selected_plan);
    const pageType = formData.school_affiliated ? 'School' : 'League';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-lg mx-auto pt-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Setup Complete!</h1>
            <p className="text-lg text-slate-600 mb-8">
              {isRookieCoach ? `Your team page for ${formData.team_name} is ready.` : `${formData.school_name} is ready to go!`}
            </p>

            <Card className="mb-8 text-left">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{isRookieCoach ? 'Team Page Created' : `${pageType} Page Created`}</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Authorized Users Added</span>
                  {formData.authorized_users.length > 0 ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                </div>
                {isRookieCoach && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Season Dates Set</span>
                    {formData.season_start_date && formData.season_end_date ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-medium">Team Pages</span>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs text-slate-500">
                  {isRookieCoach ? "You can now add your players and schedule games." : "Team pages will be created by your authorized users"}
                </p>
              </CardContent>
            </Card>

            <Button
              onClick={completeOnboarding}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-lg">

              {isSubmitting ? 'Finalizing...' : 'Go to Dashboard'}
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Fallback for unexpected step or role combination
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card>
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-bold text-red-600">Error</h2>
          <p className="text-slate-700">An unexpected error occurred or the step is invalid.</p>
          <p className="text-sm text-slate-500 mt-2">Please refresh or go back to start.</p>
          <Button onClick={() => setStep(1)} className="mt-4">Restart Onboarding</Button>
        </CardContent>
      </Card>
    </div>
  );
}
