import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, User as UserIcon } from 'lucide-react';

export default function TeamContacts() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [contactAssignments, setContactAssignments] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        const userTeams = await Team.filter({ owner_email: currentUser.email });
        setTeams(userTeams);

        // Load authorized users from user data
        if (currentUser.authorized_users) {
          setAuthorizedUsers(currentUser.authorized_users);
        }

        // Initialize contact assignments
        const assignments = {};
        userTeams.forEach(team => {
          assignments[team.id] = team.contact_person_email || '';
        });
        setContactAssignments(assignments);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, []);

  const handleContactAssignment = (teamId, contactEmail) => {
    setContactAssignments(prev => ({
      ...prev,
      [teamId]: contactEmail
    }));
  };

  const saveAssignments = async () => {
    try {
      // Update each team with its assigned contact person
      const updatePromises = teams.map(team => 
        Team.update(team.id, { contact_person_email: contactAssignments[team.id] })
      );
      
      await Promise.all(updatePromises);
      alert("Contact assignments saved successfully!");
      navigate(-1);
    } catch (error) {
      console.error("Failed to save assignments:", error);
      alert("Failed to save assignments. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Team Contact Assignments</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-6 h-6" />
              Assign Contact Persons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {teams.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No teams found.</p>
            ) : (
              teams.map(team => (
                <div key={team.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-sm text-muted-foreground">{team.organization}</p>
                  </div>
                  
                  <div className="w-64">
                    <Select 
                      value={contactAssignments[team.id] || ''} 
                      onValueChange={(value) => handleContactAssignment(team.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select contact person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No contact assigned</SelectItem>
                        <SelectItem value={user?.email || ''}>{user?.email || ''} (You)</SelectItem>
                        {authorizedUsers
                          .filter(authUser => authUser.team_id === team.id)
                          .map(authUser => (
                            <SelectItem key={authUser.email} value={authUser.email}>
                              {authUser.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
            
            <Button onClick={saveAssignments} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Contact Assignments
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}