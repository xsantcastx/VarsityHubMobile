import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Event, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Users, Share2, Clipboard, Copy, Check, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function EventDetail() {
    const [event, setEvent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [user, setUser] = useState(null);
    
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const eventId = searchParams.get('id');

    useEffect(() => {
        const loadEvent = async () => {
            if (!eventId) return;
            
            setIsLoading(true);
            try {
                const [eventData, currentUser] = await Promise.all([
                    Event.get(eventId),
                    User.me().catch(() => null)
                ]);
                
                setEvent(eventData);
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load event:", error);
            }
            setIsLoading(false);
        };
        loadEvent();
    }, [eventId]);

    const copyInviteLink = async () => {
        if (!event) return;
        
        const publicUrl = `${window.location.origin}/event/${event.slug}`;
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) return <div className="text-center p-10">Loading Event...</div>;
    if (!event) return <div className="text-center p-10">Event not found.</div>;

    const isOrganizer = user && event.organizer_email === user.email;
    const attendeeCount = event.attendees?.length || 0;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6">
            <div className="mb-6">
                <Link to={createPageUrl('Discover')} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Discover
                </Link>
            </div>

            <Card className="shadow-lg overflow-hidden">
                {event.image_url && (
                    <img src={event.image_url} alt={event.title} className="w-full h-48 object-cover"/>
                )}
                <CardContent className="p-6 space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2">{event.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span>{format(new Date(event.date), 'eee, MMM d, yyyy @ h:mm a')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary" />
                                <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                <span>
                                    {attendeeCount} attending
                                    {event.capacity && ` / ${event.capacity}`}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <p className="text-foreground/80 whitespace-pre-wrap">{event.description}</p>
                    
                    {isOrganizer && (
                        <div className="border-t border-border pt-6">
                            <h3 className="font-bold mb-3 text-primary">Event Management</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Public Event Link:</span>
                                    <Button variant="outline" size="sm" onClick={copyInviteLink}>
                                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                        {copied ? 'Copied!' : 'Copy Invite Link'}
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-md">
                                    <code>{window.location.origin}/event/{event.slug}</code>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Share this link with anyone to let them view and RSVP to your event
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-border">
                        <Button 
                            onClick={() => window.open(`/event/${event.slug}`, '_blank')}
                            className="flex-1"
                        >
                            View Public Event Page
                        </Button>
                        <Button variant="outline" onClick={copyInviteLink}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}