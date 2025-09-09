import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Team, User, Message } from '@/api/entities';
import { createPageUrl } from '@/utils';

export default function CreateTeam() {
    const [teamData, setTeamData] = useState({
        name: '',
        handle: '',
        organization: '',
        sport: 'other',
        description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { id, value } = e.target;
        let finalValue = value;
        if (id === 'handle') {
            finalValue = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        }
        setTeamData(prev => ({ ...prev, [id]: finalValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const currentUser = await User.me();
            const newTeam = await Team.create({
                ...teamData,
                owner_email: currentUser.email,
                administrators: [currentUser.email]
            });

            // Create the group chat for the new team
            await Message.create({
                conversation_id: newTeam.id,
                sender_email: 'system',
                content: `Welcome to the ${newTeam.name} team chat!`,
                is_group_chat: true,
                participants: [currentUser.email],
                group_name: newTeam.name,
                message_type: 'system'
            });

            navigate(createPageUrl(`TeamProfile?id=${newTeam.id}`));
        } catch (error) {
            console.error("Failed to create team:", error);
            alert("Error: Could not create team.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Discover
                </Button>
            </div>
            <div className="max-w-2xl mx-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Create a New Team</CardTitle>
                        <CardDescription>Set up a new page for your team to manage schedules, rosters, and communication.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Team Name</Label>
                                <Input id="name" placeholder="e.g., Northwood High Eagles" value={teamData.name} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="handle">Team Handle</Label>
                                <div className="flex items-center">
                                    <span className="text-muted-foreground bg-slate-100 p-2 rounded-l-md border border-r-0">@</span>
                                    <Input id="handle" placeholder="e.g., northwood_eagles" className="rounded-l-none" value={teamData.handle} onChange={handleChange} required />
                                </div>
                                <p className="text-xs text-muted-foreground">URL-friendly name. No spaces or special characters.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="organization">Organization</Label>
                                <Input id="organization" placeholder="e.g., Northwood High School" value={teamData.organization} onChange={handleChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" placeholder="A brief summary of your team's mission, history, or goals." value={teamData.description} onChange={handleChange} />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting || !teamData.name || !teamData.handle}>
                                {isSubmitting ? "Creating Team..." : "Create Team"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}