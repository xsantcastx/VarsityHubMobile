
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, PlusCircle, Shield, BellDot, Check, X, Calendar, MapPin, Clock, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNavigate, Link } from "react-router-dom";
import { Event, User } from "@/api/entities";
import { format, isFuture, differenceInHours, differenceInMinutes } from 'date-fns';
import { createPageUrl } from '@/utils';
import FollowingFeedSection from './FollowingFeedSection';

function TeamDashboard() {
    const navigate = useNavigate();
    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle>Team Management</CardTitle>
                        <CardDescription>Create new teams and manage existing ones.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center py-8 border-2 border-dashed border-border/30 rounded-lg">
                    <p className="font-medium text-muted-foreground">You are not managing any teams yet.</p>
                    <p className="text-sm text-muted-foreground/70">Create a team to get started.</p>
                    <Button variant="default" className="mt-4" onClick={() => navigate(createPageUrl('CreateTeam'))}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Create New Team
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ApprovalQueue() {
    const [pendingEvents, setPendingEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPendingEvents();
    }, []);

    const loadPendingEvents = async () => {
        setIsLoading(true);
        try {
            const events = await Event.filter({ status: 'pending' });
            setPendingEvents(events);
        } catch (error) {
            console.error("Failed to load pending events:", error);
        }
        setIsLoading(false);
    };

    const handleApproval = async (eventId, newStatus) => {
        try {
            await Event.update(eventId, { status: newStatus });
            loadPendingEvents(); // Refresh the list
        } catch (error) {
            console.error(`Failed to ${newStatus} event:`, error);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading approvals...</div>;
    }

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                        <BellDot className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle>Approval Queue</CardTitle>
                        <CardDescription>Review events submitted by the community.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {pendingEvents.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border/30 rounded-lg">
                        <p className="font-medium text-muted-foreground">The approval queue is empty.</p>
                        <p className="text-sm text-muted-foreground/70">Submitted events will appear here.</p>
                    </div>
                ) : (
                    pendingEvents.map(event => (
                        <Card key={event.id} className="p-4">
                            <div className="flex flex-col md:flex-row gap-4 justify-between">
                                <div className="flex-1">
                                    <p className="font-bold">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {format(new Date(event.date), 'MMM d, yyyy @ h:mm a')} • {event.location}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button size="icon" variant="outline" className="text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleApproval(event.id, 'approved')}>
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleApproval(event.id, 'rejected')}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function CreateEventForm() {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [location, setLocation] = useState('');
    const [capacity, setCapacity] = useState('');
    const [eventType, setEventType] = useState('other');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateSlug = (title, date) => {
        const titleSlug = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        
        const eventDate = new Date(date);
        const dateSlug = format(eventDate, 'MMM-dd-yyyy').toLowerCase();
        
        return `${titleSlug}-${dateSlug}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const currentUser = await User.me();
            const slug = generateSlug(title, date);
            
            // Enhanced approval logic: Coaches auto-approve, others go to queue
            const eventStatus = currentUser.user_role === 'coach_organizer' ? 'approved' : 'pending';
            
            const newEvent = await Event.create({
                title,
                description,
                date,
                location,
                capacity: capacity ? parseInt(capacity, 10) : null,
                event_type: eventType,
                organizer_email: currentUser.email,
                slug,
                attendees: eventStatus === 'approved' ? [currentUser.email] : [],
                status: eventStatus
            });
            
            if (eventStatus === 'pending') {
                alert('Your event has been submitted for approval. You\'ll be notified once it\'s reviewed.');
                navigate(createPageUrl('Discover'));
            } else {
                navigate(createPageUrl(`EventDetail?id=${newEvent.id}`));
            }
        } catch (error) {
            console.error("Failed to create event:", error);
            alert(`Failed to create event: ${error.message || 'Unknown error'}`); // Provide user feedback
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
         <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <CardTitle>Create an Event</CardTitle>
                <CardDescription>Organize a watch party, tailgate, or fundraiser.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="event-title">Event Title</Label>
                        <Input 
                            id="event-title" 
                            placeholder="e.g., Championship Watch Party" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-desc">Description</Label>
                        <Input 
                            id="event-desc" 
                            placeholder="Tell everyone about your event..." 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="event-date">Date & Time</Label>
                            <Input 
                                id="event-date" 
                                type="datetime-local" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event-location">Location</Label>
                            <Input 
                                id="event-location" 
                                placeholder="e.g., Campus Pub" 
                                value={location} 
                                onChange={e => setLocation(e.target.value)} 
                                required 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-capacity">Capacity (Optional)</Label>
                        <Input 
                            id="event-capacity" 
                            type="number" 
                            placeholder="Max attendees" 
                            value={capacity} 
                            onChange={e => setCapacity(e.target.value)} 
                        />
                    </div>
                    <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary/80 to-primary text-primary-foreground"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Creating Event...
                            </>
                        ) : (
                            'Create Event'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

function UpcomingEventsSection() {
    const [upcomingEvents, setUpcomingEvents] = useState([]);

    useEffect(() => {
        const loadEvents = async () => {
            const allEvents = await Event.filter({ status: 'approved' }, 'date');
            const futureEvents = allEvents.filter(event => isFuture(new Date(event.date))).slice(0, 5);
            setUpcomingEvents(futureEvents);
        };
        loadEvents();
    }, []);

    const getTimeUntilEvent = (eventDate) => {
        const now = new Date();
        const hoursUntil = differenceInHours(new Date(eventDate), now);
        if (hoursUntil <= 24 && hoursUntil >= 0) {
            const minutesUntil = differenceInMinutes(new Date(eventDate), now);
            if (hoursUntil < 1) return `${minutesUntil}m`;
            return `${hoursUntil}h ${minutesUntil % 60}m`;
        }
        return null;
    };

    return (
        <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-bold text-slate-900">Next Events</h2>
                </div>
            </div>
            <div className="space-y-3">
                {upcomingEvents.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border/30 rounded-lg">
                        <p className="font-medium text-muted-foreground">No upcoming events found.</p>
                        <p className="text-sm text-muted-foreground/70">Check back later or create one!</p>
                    </div>
                ) : (
                    upcomingEvents.map((event, index) => {
                        const timeUntil = getTimeUntilEvent(event.date);
                        return (
                            <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                                <Link to={createPageUrl(`EventDetail?id=${event.id}`)}>
                                    <Card className="hover:shadow-md transition-all duration-300 bg-white border border-slate-200/60 hover:border-slate-300/60">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-slate-900">{event.title}</h3>
                                                        {timeUntil && <Badge className="bg-red-500 text-white animate-pulse text-xs"><Clock className="w-3 h-3 mr-1" />{timeUntil}</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-slate-600">
                                                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{format(new Date(event.date), 'MMM d, h:mm a')}</span>
                                                        <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge variant="secondary" className="text-xs capitalize mb-1">{event.event_type.replace('_', ' ')}</Badge>
                                                    {event.capacity && <p className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />{event.attendees?.length || 0} / {event.capacity}</p>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </section>
    );
}

export default function CoachOrganizerDiscover() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold">Discover</h1>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-muted-foreground" />
          <Input
            placeholder="Search for teams, players, or events..."
            className="pl-12 h-12"
          />
        </div>
      </header>
      
      <Tabs defaultValue="team-hub">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="team-hub">
            <Shield className="w-4 h-4 mr-2" /> Team Hub
          </TabsTrigger>
          <TabsTrigger value="create-event">
            <PlusCircle className="w-4 h-4 mr-2" /> Create Event
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <BellDot className="w-4 h-4 mr-2" /> Approvals
          </TabsTrigger>
        </TabsList>
        <TabsContent value="team-hub" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <TeamDashboard />
            </motion.div>
        </TabsContent>
        <TabsContent value="create-event" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <CreateEventForm />
            </motion.div>
        </TabsContent>
        <TabsContent value="approvals" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <ApprovalQueue />
            </motion.div>
        </TabsContent>
      </Tabs>
      
      <UpcomingEventsSection />
      <FollowingFeedSection />
    </div>
  );
}
