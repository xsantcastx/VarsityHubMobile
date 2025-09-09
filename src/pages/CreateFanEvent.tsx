
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Event, User, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Send } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function CreateFanEvent() {
    const navigate = useNavigate();
    const location = useLocation();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [locationInput, setLocationInput] = useState(''); // Renamed to avoid conflict with `useLocation`
    const [eventType, setEventType] = useState('other');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [teamId, setTeamId] = useState(null);
    const [teams, setTeams] = useState([]);
    
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const id = searchParams.get('team_id');
        if (id) {
            setTeamId(id);
        }

        const fetchTeams = async () => {
            try {
                const allTeams = await Team.list();
                setTeams(allTeams);
            } catch (err) {
                console.error("Failed to fetch teams:", err);
                setError("Failed to load teams. Please try again later.");
            }
        };
        fetchTeams();

    }, [location.search]);

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
        setError('');
        if (!title || !description || !date || !locationInput || !eventType || !teamId) {
            setError('Please fill out all required fields, including referencing a team.');
            return;
        }

        setIsSubmitting(true);
        try {
            const currentUser = await User.me();
            const slug = generateSlug(title, date);

            await Event.create({
                title,
                description,
                date,
                location: locationInput,
                event_type: eventType,
                organizer_email: currentUser.email,
                slug,
                attendees: [currentUser.email],
                status: 'pending', // Events created by fans are pending approval
                team_id: teamId // Add team_id if available
            });

            setSuccess(true);
        } catch (err) {
            console.error("Failed to submit event:", err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-lg mx-auto p-4 md:p-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Event Submitted!</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">
                                Your event has been sent to a Coach/Organizer for approval. You'll be notified when it's live.
                            </p>
                            <Button onClick={() => navigate(createPageUrl('Discover'))}>
                                Back to Discover
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }
    
    return (
        <div className="max-w-lg mx-auto p-4 md:p-6">
            <div className="mb-6">
                <Link to={createPageUrl('Discover')} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Discover
                </Link>
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                    <CardHeader>
                        <CardTitle>Pitch an Event</CardTitle>
                        <CardDescription>
                            Organize a fundraiser, birthday party, or end-of-season banquet. Your event will be submitted for approval.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="team-reference">Which team is this for? <span className="text-red-500">*</span></Label>
                                <Select onValueChange={setTeamId} value={teamId || ''}> {/* Ensure controlled component, default to empty string if teamId is null */}
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a team" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teams.map(team => (
                                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="event-title">Event Title</Label>
                                <Input id="event-title" placeholder="e.g., Eagles End-of-Season Banquet" value={title} onChange={e => setTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="event-type">Event Type</Label>
                                <Select onValueChange={setEventType} defaultValue={eventType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an event type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fundraiser">Fundraiser</SelectItem>
                                        <SelectItem value="birthday_party">Birthday Party</SelectItem>
                                        <SelectItem value="banquet">Team Banquet</SelectItem>
                                        <SelectItem value="watch_party">Watch Party</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="event-desc">Description</Label>
                                <Textarea id="event-desc" placeholder="Tell everyone about your event..." value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="event-date">Proposed Date & Time</Label>
                                    <Input id="event-date" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="event-location">Location</Label>
                                    <Input id="event-location" placeholder="e.g., 123 Main St" value={locationInput} onChange={e => setLocationInput(e.target.value)} />
                                </div>
                            </div>
                            
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                                <Send className="w-4 h-4 ml-2" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
