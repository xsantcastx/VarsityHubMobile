import React, { useState } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

const roleOptions = [
  {
    id: 'fan_parent',
    title: 'Fan/Parent',
    description: 'Follow teams, attend games, support athletes',
    icon: Heart,
    color: 'from-blue-500 to-blue-600',
    benefits: ['Follow favorite teams', 'Discover local games', 'Connect with community', 'Support young athletes']
  },
  {
    id: 'coach_organizer',
    title: 'Coach/Organizer',
    description: 'Lead teams, organize events, build communities',
    icon: Trophy,
    color: 'from-green-500 to-green-600',
    benefits: ['Team management tools', 'Event organization', 'Player development', 'Community building']
  },
  {
    id: 'athlete',
    title: 'Athlete',
    description: 'Showcase skills, connect with scouts, grow your brand',
    icon: Zap,
    color: 'from-purple-500 to-purple-600',
    benefits: ['Profile showcase', 'Performance tracking', 'Scout connections', 'Highlight reels']
  },
  {
    id: 'freelancer',
    title: 'Freelancer',
    description: 'Offer services like photography, training, equipment',
    icon: Camera,
    color: 'from-orange-500 to-orange-600',
    benefits: ['Service marketplace', 'Direct bookings', 'Portfolio showcase', 'Payment processing']
  }
];

const sportsOptions = [
  'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 'Tennis',
  'Track & Field', 'Swimming', 'Hockey', 'Lacrosse', 'Wrestling', 'Golf',
  'Softball', 'Cross Country', 'Gymnastics', 'Cheerleading'
];

const freelancerServices = [
  'Photography', 'Videography', 'Personal Training', 'Sports Coaching',
  'Referee/Officiating', 'Equipment Rental', 'Sports Medicine', 'Nutrition'
];

export default function RoleOnboarding() {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setStep(2);
  };

  const handleSportToggle = (sport) => {
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const handleServiceToggle = (service) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await User.updateMyUserData({
        user_type: selectedRole,
        sports_interests: selectedSports,
        freelancer_services: selectedRole === 'freelancer' ? selectedServices : [],
        onboarding_completed: true
      });
      
      navigate(createPageUrl('Feed'));
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto pt-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to VarsityHub!</h1>
            <p className="text-xl text-slate-600">Choose your role to personalize your experience</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roleOptions.map((role, index) => {
              const IconComponent = role.icon;
              return (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handleRoleSelect(role.id)}
                  className="cursor-pointer"
                >
                  <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-200">
                    <CardHeader>
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${role.color} flex items-center justify-center mb-4 shadow-lg`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <CardTitle className="text-xl">{role.title}</CardTitle>
                      <p className="text-slate-600">{role.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {role.benefits.map(benefit => (
                          <div key={benefit} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-slate-600">{benefit}</span>
                          </div>
                        ))}
                      </div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Almost there!</h2>
          <p className="text-slate-600">Tell us about your sports interests</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Your Sports</CardTitle>
            <p className="text-slate-600">Choose all sports you're interested in or involved with</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sportsOptions.map(sport => (
                <motion.div
                  key={sport}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Badge
                    variant={selectedSports.includes(sport) ? "default" : "outline"}
                    className={`cursor-pointer p-3 w-full justify-center transition-all ${
                      selectedSports.includes(sport) 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'hover:bg-slate-100'
                    }`}
                    onClick={() => handleSportToggle(sport)}
                  >
                    {sport}
                  </Badge>
                </motion.div>
              ))}
            </div>

            {selectedRole === 'freelancer' && (
              <div className="pt-6 border-t border-slate-200">
                <h3 className="font-semibold mb-4">Your Services</h3>
                <div className="grid grid-cols-2 gap-3">
                  {freelancerServices.map(service => (
                    <motion.div
                      key={service}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Badge
                        variant={selectedServices.includes(service) ? "default" : "outline"}
                        className={`cursor-pointer p-3 w-full justify-center transition-all ${
                          selectedServices.includes(service) 
                            ? 'bg-orange-600 hover:bg-orange-700' 
                            : 'hover:bg-slate-100'
                        }`}
                        onClick={() => handleServiceToggle(service)}
                      >
                        {service}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={completeOnboarding}
                disabled={selectedSports.length === 0 || isSubmitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Setting up...
                  </div>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}