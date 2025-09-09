import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

const guideSteps = [
  {
    title: "Welcome to VarsityHub",
    content: "Your one-stop platform for connecting with your sports community.",
    image: "📱"
  },
  {
    title: "Feed Tab",
    content: "See upcoming games in your area and follow live scores.",
    image: "🏠"
  },
  {
    title: "Highlights Tab", 
    content: "View the most upvoted moments from across the nation.",
    image: "⭐"
  },
  {
    title: "Create Posts",
    content: "Share photos, videos, and game reviews. Swipe up for camera mode.",
    image: "➕"
  },
  {
    title: "Discover Tab",
    content: "Find teams, players, events, and connect with your community.",
    image: "🧭"
  },
  {
    title: "Profile & Settings",
    content: "Manage your account, privacy settings, and view your activity.",
    image: "👤"
  },
  {
    title: "Messaging",
    content: "Safe, age-appropriate messaging with other users in your community.",
    image: "💬"
  },
  {
    title: "You're Ready!",
    content: "Start exploring and connecting with your sports community.",
    image: "🎉"
  }
];

export default function AppGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const nextStep = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentGuide = guideSteps[currentStep];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">App Guide</h1>
        </div>
      </header>
      
      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Getting Started
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {currentStep + 1} of {guideSteps.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">{currentGuide.image}</div>
              <h2 className="text-2xl font-bold mb-4">{currentGuide.title}</h2>
              <p className="text-muted-foreground text-lg">{currentGuide.content}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={prevStep} 
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              <div className="flex gap-2">
                {guideSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              
              {currentStep === guideSteps.length - 1 ? (
                <Button onClick={() => navigate(-1)}>
                  Done
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={nextStep}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}