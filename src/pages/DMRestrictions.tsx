
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Users, AlertTriangle } from 'lucide-react';

export default function DMRestrictions() {
  const navigate = useNavigate();

  const restrictions = [
    {
      icon: Users,
      title: "Age-Based Messaging",
      description: "Users 17 & under can only message other minors. Users 18+ can only message other adults.",
      color: "text-blue-600"
    },
    {
      icon: Shield,
      title: "Coach Exception",
      description: "Coaches and Organizers can communicate with all team members through group chats only.",
      color: "text-green-600"
    },
    {
      icon: AlertTriangle,
      title: "Zero Tolerance Policy",
      description: "Harassment, bullying, or inappropriate behavior results in immediate account suspension.",
      color: "text-red-600"
    }
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">DM Restrictions</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Safety First
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              VarsityHub implements comprehensive safety measures to protect all users, 
              especially minors, while maintaining a positive sports community environment.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {restrictions.map((restriction, index) => {
            const IconComponent = restriction.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <IconComponent className={`w-6 h-6 ${restriction.color}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{restriction.title}</h3>
                      <p className="text-muted-foreground">{restriction.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Questions or Concerns?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              If you have questions about our messaging policies or need to report an issue, 
              please don't hesitate to contact our support team.
            </p>
            <Button onClick={() => window.open('mailto:support@varsityhub.com')}>
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
