import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Heart, Users, Target } from 'lucide-react';

export default function CoreValues() {
  const navigate = useNavigate();

  const values = [
    {
      icon: Shield,
      title: "Safety First",
      description: "We prioritize the safety and well-being of all users, especially minors, through comprehensive moderation and age-appropriate features."
    },
    {
      icon: Heart,
      title: "Sportsmanship",
      description: "We promote respect, fair play, and positive interactions in all aspects of sports and competition."
    },
    {
      icon: Users,
      title: "Community",
      description: "We believe in bringing together athletes, coaches, families, and fans to create supportive sports communities."
    },
    {
      icon: Target,
      title: "Excellence",
      description: "We strive to provide the best platform for sports teams and organizations to connect, grow, and succeed."
    }
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Core Values</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              VarsityHub exists to create safe, positive environments where sports communities can thrive. 
              We connect athletes, coaches, families, and fans while maintaining the highest standards of 
              safety and sportsmanship.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {values.map((value, index) => {
            const IconComponent = value.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <IconComponent className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                      <p className="text-muted-foreground">{value.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}