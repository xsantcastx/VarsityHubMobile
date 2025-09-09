import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Team, Event } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, PlusCircle, Check, X, Edit, Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function ManageSeason() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]);
    const [events, setEvents] = useState([]);
    const [pendingFanEvents, setPendingFanEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [teamFilter, setTeamFilter] = useState('all');

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                const userTeams = await Team.filter({ owner_email: currentUser.email });
                setTeams(userTeams);

                if (userTeams.length > 0) {
                    const teamIds = userTeams.map(t => t.id);
                    const allTeamEvents = await Event.filter({ team_id: { '$in': teamIds } });
                    
                    const approvedEvents = allTeamEvents.filter(e => e.status === 'approved');
                    const pendingEvents = allTeamEvents.filter(e => e.status === 'pending');
                    
                    setEvents(approvedEvents);
                    setPendingFanEvents(pendingEvents);
                }
            } catch (error) {
                console.error("Failed to load season data:", error);
            }
        };
        loadData();
    }, []);

    const handleEventAction = async (eventId, newStatus) => {
        try {
            await Event.update(eventId, { status: newStatus });
            // Refresh data
            const teamIds = teams.map(t => t.id);
            const allTeamEvents = await Event.filter({ team_id: { '$in': teamIds } });
            setEvents(allTeamEvents.filter(e => e.status === 'approved'));
            setPendingFanEvents(allTeamEvents.filter(e => e.status === 'pending'));
        } catch (error) {
            console.error(`Failed to ${newStatus} event:`, error);
        }
    };
    
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (teamFilter === 'all') return true;
            return event.team_id === teamFilter;
        });
    }, [events, teamFilter]);

    const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.name || 'Unknown Team';

    return (
        <div className="min-h-screen bg-secondary/30">
            <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
                <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Manage Season</h1>
                </div>
            </header>
            
            <main className="max-w-4xl mx-auto p-4 md:p-6">
                <Tabs defaultValue="schedule">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="schedule">Schedule</TabsTrigger>
                        <TabsTrigger value="requests">
                            <div className="flex items-center gap-2">
                                Fan Event Requests 
                                {pendingFanEvents.length > 0 && 
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                        {pendingFanEvents.length}
                                    </span>
                                }
                            </div>
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="schedule" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Event Calendar</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    className="rounded-md border p-0"
                                />
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Upcoming Events</CardTitle>
                                    <Select value={teamFilter} onValueChange={setTeamFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Filter by team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Teams</SelectItem>
                                            {teams.map(team => (
                                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {filteredEvents.length > 0 ? filteredEvents.map(event => (
                                        <div key={event.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                            <div>
                                                <p className="font-semibold">{event.title} {event.organizer_email !== user.email && <span title="Fan Suggested" className="text-amber-500">⚠️</span>}</p>
                                                <p className="text-sm text-muted-foreground">{getTeamName(event.team_id)}</p>
                                                <p className="text-xs text-muted-foreground">{format(parseISO(event.date), 'MMM d, yyyy @ h:mm a')}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => alert('Edit functionality coming soon!')}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )) : <p className="text-center text-muted-foreground py-4">No upcoming events.</p>}
                                </div>
                                <Button className="w-full mt-6" onClick={() => alert('Create event functionality coming soon!')}>
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Add New Event
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="requests" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fan Event Requests</CardTitle>
                                <CardDescription>Review, edit, and approve events submitted by fans.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {pendingFanEvents.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">No pending fan requests.</p>
                                    </div>
                                ) : pendingFanEvents.map(event => (
                                    <Card key={event.id} className="p-4">
                                        <p className="font-bold">{event.title}</p>
                                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                                        <p className="text-xs text-muted-foreground">For: {getTeamName(event.team_id)}</p>
                                        <p className="text-xs text-muted-foreground">Suggested Date: {format(parseISO(event.date), 'PPP @ p')}</p>
                                        <div className="flex gap-2 mt-4">
                                            <Button size="sm" onClick={() => handleEventAction(event.id, 'approved')}>
                                                <Check className="w-4 h-4 mr-2" /> Approve
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => alert('Edit functionality coming soon!')}>
                                                <Edit className="w-4 h-4 mr-2" /> Edit & Approve
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleEventAction(event.id, 'rejected')}>
                                                <X className="w-4 h-4 mr-2" /> Reject
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}