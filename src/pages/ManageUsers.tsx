
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, UserPlus, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ManageUsers() {
  const [user, setUser] = useState(null);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teams, setTeams] = useState([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        // In a real app, this would fetch authorized users
        setAuthorizedUsers(currentUser.authorized_users || []);

        const userTeams = await Team.filter({ owner_email: currentUser.email });
        setTeams(userTeams);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, []);

  const getUserLimit = () => {
    switch (user?.selected_plan) {
      case 'veteran': return 12;
      case 'legend': return 999;
      default: return 0;
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail.trim() || !selectedTeamId) {
      alert("Please enter an email and select a team.");
      return;
    }
    
    try {
      const updatedUsers = [...authorizedUsers, { email: newUserEmail, team_id: selectedTeamId, status: 'pending' }];
      await User.updateMyUserData({ authorized_users: updatedUsers });
      setAuthorizedUsers(updatedUsers);
      setNewUserEmail('');
      setSelectedTeamId('');
      setShowInviteDialog(false);
      alert(`Invitation sent to ${newUserEmail}`);
    } catch (error) {
      console.error("Failed to invite user:", error);
      alert("Failed to send invitation");
    }
  };

  const handleRemoveUser = async (emailToRemove, teamIdToRemove) => {
    if (!confirm("Remove this user's access?")) return;
    
    try {
      const updatedUsers = authorizedUsers.filter(u => !(u.email === emailToRemove && u.team_id === teamIdToRemove));
      await User.updateMyUserData({ authorized_users: updatedUsers });
      setAuthorizedUsers(updatedUsers);
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  };

  const canInviteMore = () => {
    return authorizedUsers.length < getUserLimit();
  };

  const getTeamName = (teamId) => {
    return teams.find(t => t.id === teamId)?.name || 'Unknown Team';
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Authorized Users</h1>
          </div>
          {canInviteMore() && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Authorized User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    placeholder="Enter email address"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                  <Select onValueChange={setSelectedTeamId} value={selectedTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteUser} className="w-full">
                    <Mail className="w-4 h-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Authorized Users: {authorizedUsers.length} / {getUserLimit() === 999 ? '∞' : getUserLimit()}
          </p>
        </div>
        
        {authorizedUsers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No authorized users</h3>
              <p className="text-muted-foreground mb-4">
                Add team assistants or co-coaches to help manage your teams
              </p>
              {canInviteMore() && (
                <Button onClick={() => setShowInviteDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First User
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {authorizedUsers.map((authUser, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{authUser.email}</p>
                      <p className="text-sm text-muted-foreground">Team: {getTeamName(authUser.team_id)}</p>
                      <Badge variant={authUser.status === 'active' ? 'default' : 'secondary'}>
                        {authUser.status || 'pending'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveUser(authUser.email, authUser.team_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
