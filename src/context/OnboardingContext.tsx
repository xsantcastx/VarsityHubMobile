import React, { createContext, useContext, useState, PropsWithChildren } from 'react';

export type Affiliation = 'school' | 'independent';
export type Plan = 'rookie' | 'veteran' | 'legend';
export type Role = 'Team Manager' | 'Coach' | 'Admin';
export type Intent = 'find_local_games' | 'add_players' | 'follow';
export type Interest = 'Football' | 'Basketball' | 'Baseball' | 'Soccer' | 'Volleyball' | 'Track & Field' | 'Swimming' | 'Hockey' | 'Other';

export type OnboardingState = {
  display_name?: string;
  affiliation?: Affiliation;
  dob?: string;
  zip_code?: string | null;
  plan?: Plan;
  team_id?: string;
  authorized?: Array<{ email?: string; user_id?: string; role?: Role; assign_team?: string }>;
  avatar_url?: string;
  bio?: string;
  sports_interests?: Interest[];
  primary_intents?: Intent[];
};

type Ctx = { state: OnboardingState; setState: React.Dispatch<React.SetStateAction<OnboardingState>> };

const OBContext = createContext<Ctx | null>(null);

export function OBProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OnboardingState>({});
  return <OBContext.Provider value={{ state, setState }}>{children}</OBContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OBContext);
  if (!ctx) throw new Error('useOnboarding must be used within OBProvider');
  return ctx;
}

