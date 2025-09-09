

import React, { useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavBar from "./components/nav/BottomNavBar";
import { User } from '@/api/entities';
import { createPageUrl } from './utils';

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const currentUser = await User.me();
        if (!currentUser.onboarding_completed && location.pathname !== createPageUrl('Onboarding')) {
          navigate(createPageUrl('Onboarding'));
        }
      } catch (error) {
        // User not logged in, do nothing
      }
    };
    checkOnboarding();
  }, [location.pathname, navigate]);


  return (
    <>
      <style>{`
        :root {
          --background: 0 0% 100%;
          --foreground: 240 10% 3.9%;
          --card: 0 0% 100%;
          --card-foreground: 240 10% 3.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 240 10% 3.9%;
          --primary: 221 83% 53%; /* A strong, clean blue */
          --primary-foreground: 0 0% 98%;
          --secondary: 240 4.8% 95.9%;
          --secondary-foreground: 240 5.9% 10%;
          --muted: 240 4.8% 95.9%;
          --muted-foreground: 240 3.8% 46.1%;
          --accent: 240 4.8% 95.9%;
          --accent-foreground: 240 5.9% 10%;
          --destructive: 0 84.2% 60.2%;
          --destructive-foreground: 0 0% 98%;
          --border: 240 5.9% 90%;
          --input: 240 5.9% 90%;
          --ring: 221 83% 53%;
        }

        .dark {
          --background: 240 10% 3.9%;
          --foreground: 0 0% 98%;
          --card: 240 4.8% 10.5%;
          --card-foreground: 0 0% 98%;
          --popover: 240 10% 3.9%;
          --popover-foreground: 0 0% 98%;
          --primary: 84 81% 48%; /* Lime Green */
          --primary-foreground: 240 10% 3.9%;
          --secondary: 240 3.7% 15.9%;
          --secondary-foreground: 0 0% 98%;
          --muted: 240 3.7% 15.9%;
          --muted-foreground: 240 5% 64.9%;
          --accent: 84 81% 48%;
          --accent-foreground: 240 10% 3.9%;
          --destructive: 0 62.8% 30.6%;
          --destructive-foreground: 0 0% 98%;
          --border: 240 3.7% 15.9%;
          --input: 240 3.7% 15.9%;
          --ring: 84 81% 48%;
        }
        
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
        }
        
        .font-display {
          font-family: 'Source Code Pro', monospace;
        }
      `}</style>
      <div className="min-h-screen w-full bg-background text-foreground">
        <main className="pb-24">
          {children}
        </main>
        {currentPageName !== 'Onboarding' && <BottomNavBar />}
      </div>
    </>
  );
}

