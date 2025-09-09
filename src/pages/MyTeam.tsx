import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, AlertTriangle, Mail } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createPageUrl } from '@/utils';

export default function MyTeam() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        // Try to find the team this user belongs to
        if (currentUser.team_name) {
          const teams = await Team.filter({ name: currentUser.team_name });
          if (teams.length > 0) {
            setTeam(teams[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load team data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">My Team</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {!team ? (
          <Card>
            <CardContent className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Not Assigned to a Team</h3>
              <p className="text-muted-foreground mb-4">
                You are not currently assigned to a team. Please contact your coach or organizer to be added to a team roster.
              </p>
              <div className="space-y-2">
                <Button onClick={() => navigate(createPageUrl('Discover'))}>
                  Find Teams Near Me
                </Button>
                <p className="text-xs text-muted-foreground">
                  Or ask your coach to add you to their authorized users list
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Team Header */}
            <Card>
              <CardHeader className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={team.logo_url} />
                  <AvatarFallback className="text-2xl font-bold">
                    {team.name[0]}
                  </AvatarFallback>
                </Avatar>
                <CardTitle>{team.name}</CardTitle>
                <div className="flex justify-center gap-2">
                  <Badge variant="outline">{team.sport}</Badge>
                  <Badge variant="outline">{team.organization}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <p className="text-center text-muted-foreground">{team.description}</p>
                )}
                
                {/* Team Stats */}
                {team.stats && (
                  <div className="flex justify-center gap-8 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="font-bold text-lg">{team.stats.wins || 0}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">{team.stats.losses || 0}</p>
                      <p className="text-xs text-muted-foreground">Losses</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">{team.roster?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Players</p>
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                {team.contact_person_email && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Team Contact</p>
                    <p className="text-sm text-blue-600">{team.contact_person_email}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Your Position */}
            {user?.position && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Your Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="font-bold text-primary">#{user.jersey_number || '?'}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{user.position}</p>
                      <p className="text-sm text-muted-foreground">Position</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(createPageUrl(`TeamProfile?id=${team.id}`))}
                >
                  <Users className="w-4 h-4 mr-2" />
                  View Team Profile
                </Button>
                {team.contact_person_email && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(`mailto:${team.contact_person_email}`)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Team Manager
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}