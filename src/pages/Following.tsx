import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserInteraction, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserMinus, Heart, Shield } from 'lucide-react';

export default function Following() {
  const [user, setUser] = useState(null);
  const [followedTeams, setFollowedTeams] = useState([]);
  const [teamsDetails, setTeamsDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        // Get all 'follow' interactions for 'team' target_type by this user
        const follows = await UserInteraction.filter({
          user_email: currentUser.email,
          interaction_type: 'follow',
          target_type: 'team'
        });
        
        setFollowedTeams(follows);

        if (follows.length > 0) {
          const teamIds = follows.map(f => f.target_id);
          const teams = await Team.filter({ id: { $in: teamIds } });
          const teamsMap = teams.reduce((acc, team) => {
            acc[team.id] = team;
            return acc;
          }, {});
          setTeamsDetails(teamsMap);
        }
      } catch (error) {
        console.error("Failed to load following data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleUnfollow = async (followId, targetId) => {
    if (!confirm("Unfollow this team?")) return;
    
    try {
      await UserInteraction.delete(followId);
      setFollowedTeams(prev => prev.filter(item => item.id !== followId));
    } catch (error) {
      console.error("Failed to unfollow:", error);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Followed Teams</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : followedTeams.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Not following any teams yet</h3>
              <p className="text-muted-foreground">Start following teams to see their updates</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {followedTeams.map((item) => {
              const team = teamsDetails[item.target_id];
              if (!team) return null;
              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <Badge variant="outline" className="capitalize">
                          <Shield className="w-3 h-3 mr-1" />
                          {team.sport}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Following since {new Date(item.created_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnfollow(item.id, item.target_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}