import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Team, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

export default function EditTeam() {
    const navigate = useNavigate();
    const location = useLocation();
    const [team, setTeam] = useState(null);
    const [authorizedUsers, setAuthorizedUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        contact_person_email: ''
    });

    const teamId = new URLSearchParams(location.search).get('id');

    useEffect(() => {
        if (!teamId) {
            navigate('/discover');
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                const teams = await Team.filter({ id: teamId });
                
                if (teams.length === 0 || teams[0].owner_email !== currentUser.email) {
                    navigate('/discover');
                    return;
                }

                const teamData = teams[0];
                setTeam(teamData);
                setFormData({
                    name: teamData.name,
                    description: teamData.description || '',
                    contact_person_email: teamData.contact_person_email || ''
                });

                if (currentUser.authorized_users?.length > 0) {
                     setAuthorizedUsers(currentUser.authorized_users);
                }

            } catch (error) {
                console.error("Failed to load team data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [teamId, navigate]);
    
    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, contact_person_email: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await Team.update(teamId, formData);
            alert("Team updated successfully!");
            navigate( -1 ); // Go back to the previous page
        } catch (error) {
            console.error("Failed to update team:", error);
            alert("Error updating team. Please try again.");
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Loading team details...</div>;
    }

    return (
        <div className="min-h-screen bg-secondary/30">
            <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
                <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Edit Team: {team?.name}</h1>
                </div>
            </header>
            <main className="max-w-4xl mx-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Team Details</CardTitle>
                        <CardDescription>Update your team's information and assign a contact person.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Team Name</Label>
                                <Input id="name" value={formData.name} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" value={formData.description} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact_person_email">Contact Person</Label>
                                <Select onValueChange={handleSelectChange} value={formData.contact_person_email}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a contact person" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>None</SelectItem>
                                        {authorizedUsers.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Choose from your list of authorized users.</p>
                            </div>
                            <Button type="submit" className="w-full">
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}