
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, Award, Gem, Medal } from 'lucide-react';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const planIcons = {
  rookie: Award,
  veteran: Gem,
  legend: Medal
};

export default function Billing() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('annual'); // New state for billing cycle
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        // Set billing cycle from user data if available, otherwise default to 'annual'
        if (currentUser.billing_cycle) {
          setBillingCycle(currentUser.billing_cycle);
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleUpgrade = (newPlan) => {
    // Logic to handle plan upgrade/downgrade
    alert(`Processing upgrade to ${newPlan} on ${billingCycle} cycle. No refunds for annual plans.`);
    // In a real application, this would involve API calls, Stripe integration, etc.
  };

  const getPlanDetails = () => {
    switch (user?.selected_plan) {
      case 'rookie':
        return {
          name: 'Rookie',
          price: 'FREE',
          description: 'First Season Free', // Updated description
          nextBilling: user.season_end_date ? format(new Date(user.season_end_date), 'PPP') : 'Not set'
        };
      case 'veteran':
        return {
          name: 'Veteran',
          price: user?.billing_cycle === 'monthly' ? '$7.50/month' : '$75/year',
          description: 'Up to 6 teams',
          nextBilling: 'Auto-renew enabled'
        };
      case 'legend':
        return {
          name: 'Legend',
          price: '$150/year',
          description: 'Unlimited teams & clubs',
          nextBilling: 'Auto-renew enabled'
        };
      default:
        return null;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading billing information...</div>;
  }

  const planDetails = getPlanDetails();
  const PlanIcon = planIcons[user?.selected_plan];
  const isMonthly = user?.billing_cycle === 'monthly'; // Check user's current billing cycle

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Billing & Plans</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {planDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {PlanIcon && <PlanIcon className="w-6 h-6 text-primary" />}
                Current Plan: {planDetails.name}
              </CardTitle>
              <CardDescription>
                {user?.selected_plan === 'rookie' ? `Your free season ends on ${planDetails.nextBilling}.` : `Your subscription renews ${user?.billing_cycle === 'monthly' ? 'monthly' : 'annually'}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {isMonthly && user?.selected_plan !== 'legend' && ( // Only show upgrade options if monthly and not already Legend
                  <>
                    <Button variant="outline" onClick={() => handleUpgrade('Veteran')}>
                      Upgrade to Veteran
                    </Button>
                     <Button variant="outline" onClick={() => handleUpgrade('Legend')}>
                      Upgrade to Legend
                    </Button>
                  </>
                )}
                 {user?.selected_plan !== 'rookie' && !isMonthly && ( // If annual plan
                   <p className="text-sm text-muted-foreground">Annual plans cannot be changed mid-cycle. No refunds are provided.</p>
                 )}
                 {user?.selected_plan === 'rookie' && ( // If rookie plan
                    <Button variant="outline" onClick={() => handleUpgrade('Veteran')}>
                        Upgrade to Veteran
                    </Button>
                 )}
                 {user?.selected_plan === 'rookie' && ( // If rookie plan
                    <Button variant="outline" onClick={() => handleUpgrade('Legend')}>
                        Upgrade to Legend
                    </Button>
                 )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Choose Your Plan</CardTitle>
            <div className="flex justify-center pt-4">
              <ToggleGroup type="single" value={billingCycle} onValueChange={setBillingCycle} aria-label="Billing Cycle">
                <ToggleGroupItem value="monthly" aria-label="Monthly">Monthly</ToggleGroupItem>
                <ToggleGroupItem value="annual" aria-label="Annual">Annual (Save 17%)</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
               <div className="p-4 border rounded-lg flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5" />
                  <h4 className="font-semibold">Rookie</h4>
                </div>
                <p className="text-sm text-muted-foreground flex-grow">1 team, 5 months free</p>
                <Button className="mt-4 w-full" disabled={user?.selected_plan === 'rookie'}>
                    {user?.selected_plan === 'rookie' ? 'Current Plan' : 'First Season Free'}
                </Button>
              </div>
              
              <div className="p-4 border rounded-lg bg-blue-50/50 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Gem className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Veteran</h4>
                </div>
                <p className="text-sm text-muted-foreground flex-grow">Up to 6 teams</p>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{billingCycle === 'annual' ? '$70' : '$7.50'}</p>
                  <p className="text-xs text-muted-foreground">{billingCycle === 'annual' ? '/year' : '/month'}</p>
                  <Button className="mt-2 w-full" 
                    onClick={() => handleUpgrade('Veteran')}
                    disabled={user?.selected_plan === 'veteran' && user?.billing_cycle === billingCycle}
                  >
                    {user?.selected_plan === 'veteran' && user?.billing_cycle === billingCycle ? 'Current Plan' : 'Select Veteran'}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Medal className="w-5 h-5" />
                  <h4 className="font-semibold">Legend</h4>
                </div>
                <p className="text-sm text-muted-foreground flex-grow">Unlimited teams & clubs</p>
                 <div className="mt-4">
                  <p className="text-2xl font-bold">$150</p>
                  <p className="text-xs text-muted-foreground">/year (annual only)</p>
                  <Button className="mt-2 w-full" 
                    disabled={billingCycle === 'monthly' || (user?.selected_plan === 'legend' && user?.billing_cycle === 'annual')}
                    onClick={() => handleUpgrade('Legend')}
                  >
                    {user?.selected_plan === 'legend' && user?.billing_cycle === 'annual' ? 'Current Plan' : 'Select Legend'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
