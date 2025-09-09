
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Team, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Users } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        const userTeams = await Team.filter({ owner_email: currentUser.email });
        setTeams(userTeams);
      } catch (error) {
        console.error("Failed to load teams:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const getTeamLimit = () => {
    switch (user?.selected_plan) {
      case 'rookie': return 1;
      case 'veteran': return 6;
      case 'legend': return 999;
      default: return 1;
    }
  };

  const canCreateTeam = () => {
    return teams.length < getTeamLimit();
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Manage Teams</h1>
          </div>
          {canCreateTeam() && (
            <Button onClick={() => navigate(createPageUrl('CreateTeam'))}>
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          )}
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Teams: {teams.length} / {getTeamLimit() === 999 ? '∞' : getTeamLimit()}
          </p>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">Loading teams...</div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
              <p className="text-muted-foreground mb-4">Create your first team to get started</p>
              <Button onClick={() => navigate(createPageUrl('CreateTeam'))}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {teams.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">@{team.handle}</p>
                      <p className="text-sm text-muted-foreground">{team.organization}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{team.sport}</Badge>
                        {team.is_verified && <Badge className="bg-green-100 text-green-700">Verified</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`TeamProfile?id=${team.id}`))}>
                        View Page
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`EditTeam?id=${team.id}`))}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
