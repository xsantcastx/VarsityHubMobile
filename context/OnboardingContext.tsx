import React, { createContext, PropsWithChildren, useContext, useState } from 'react';

export type Affiliation = 'none' | 'university' | 'high_school' | 'club' | 'youth';
export type Plan = 'rookie' | 'veteran' | 'legend';
export type UserRole = 'fan' | 'rookie' | 'coach';
export type TeamRole = 'Team Manager' | 'Coach' | 'Admin';
export type Intent = 'find_local_games' | 'add_players' | 'follow';
export type Interest = 'Football' | 'Basketball' | 'Baseball' | 'Soccer' | 'Volleyball' | 'Track & Field' | 'Swimming' | 'Hockey' | 'Other';

export type OnboardingState = {
  role?: UserRole;
  username?: string;
  display_name?: string;
  affiliation?: Affiliation;
  dob?: string;
  zip?: string;
  zip_code?: string | null;
  plan?: Plan;
  payment_pending?: boolean;
  team_id?: string;
  team_name?: string;
  organization_id?: string;
  organization_name?: string;
  sport?: string;
  authorized?: Array<{ email?: string; user_id?: string; role?: TeamRole; assign_team?: string }>;
  authorized_users?: Array<{ email?: string; user_id?: string; role?: TeamRole; assign_team?: string }>;
  avatar_url?: string;
  bio?: string;
  sports_interests?: Interest[];
  primary_intents?: Intent[];
  personalization_goals?: Intent[];
  season_start?: string;
  season_end?: string;
  location_enabled?: boolean;
  notifications_enabled?: boolean;
  messaging_policy_accepted?: boolean;
};

type Ctx = { 
  state: OnboardingState; 
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  clearOnboarding: () => void;
  progress: number;
  setProgress: (progress: number) => void;
};

const OBContext = createContext<Ctx | null>(null);

export function OBProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState>({});
  const [progress, setProgress] = useState(0);
  
  const clearOnboarding = () => {
    setState({});
    setProgress(0);
  };
  
  return <OBContext.Provider value={{ state, setState, clearOnboarding, progress, setProgress }}>{children}</OBContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OBContext);
  if (!ctx) throw new Error('useOnboarding must be used within OBProvider');
  return ctx;
}
