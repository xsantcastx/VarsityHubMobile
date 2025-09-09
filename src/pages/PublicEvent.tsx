
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Event, EventPost, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Share2, Heart, Camera, Video, MessageSquare, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function PublicEvent() {
    const { slug } = useParams();
    const [event, setEvent] = useState(null);
    const [posts, setPosts] = useState([]);
    const [user, setUser] = useState(null);
    const [isAttending, setIsAttending] = useState(false);
    const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const loadEventData = async () => {
            setIsLoading(true);
            try {
                // Find event by slug
                const events = await Event.filter({ slug });
                if (events.length === 0) {
                    setIsLoading(false);
                    return;
                }
                
                const eventData = events[0];
                setEvent(eventData);

                // Load posts for this event
                const eventPosts = await EventPost.filter({ event_id: eventData.id }, '-created_date');
                setPosts(eventPosts);

                // Check if user is logged in and attending
                try {
                    const currentUser = await User.me();
                    setUser(currentUser);
                    setIsAttending(eventData.attendees?.includes(currentUser.email) || false);
                } catch (error) {
                    // User not logged in
                }
            } catch (error) {
                console.error("Error loading event:", error);
            }
            setIsLoading(false);
        };
        
        if (slug) {
            loadEventData();
        }
    }, [slug]);

    const handleRSVP = async () => {
        if (!user) {
            await User.login();
            return;
        }
        
        setIsSubmittingRsvp(true);

        try {
            const updatedAttendees = isAttending 
                ? event.attendees.filter(email => email !== user.email)
                : [...(event.attendees || []), user.email];

            await Event.update(event.id, { attendees: updatedAttendees });
            setEvent({ ...event, attendees: updatedAttendees });
            setIsAttending(!isAttending);
        } catch (error) {
            console.error("Error updating RSVP:", error);
        } finally {
            setIsSubmittingRsvp(false);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user || !newComment.trim()) return;

        try {
            await EventPost.create({
                event_id: event.id,
                author_email: user.email,
                type: 'comment',
                content: newComment
            });
            
            setNewComment('');
            // Reload posts
            const eventPosts = await EventPost.filter({ event_id: event.id }, '-created_date');
            setPosts(eventPosts);
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    const copyInviteLink = async () => {
        const url = window.location.href;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) return <div className="text-center p-10">Loading event...</div>;
    if (!event) return <div className="text-center p-10">Event not found.</div>;

    const eventDate = new Date(event.date);
    const attendeeCount = event.attendees?.length || 0;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {/* Event Header */}
            <Card className="overflow-hidden">
                {event.image_url && (
                    <div 
                        className="h-64 bg-cover bg-center"
                        style={{ backgroundImage: `url(${event.image_url})` }}
                    />
                )}
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
                            <Badge className="mb-4 capitalize">
                                {event.event_type.replace('_', ' ')}
                            </Badge>
                        </div>
                        <Button variant="outline" onClick={copyInviteLink}>
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied ? 'Copied Link' : 'Share'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-5 h-5 text-primary" />
                            <span>{format(eventDate, 'eee, MMM d, yyyy @ h:mm a')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-5 h-5 text-primary" />
                            <span>{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-5 h-5 text-primary" />
                            <span>
                                {attendeeCount} attending
                                {event.capacity && ` / ${event.capacity}`}
                            </span>
                        </div>
                    </div>

                    <p className="text-foreground/80 mb-6">{event.description}</p>

                    <div className="flex gap-3">
                        <Button 
                            onClick={handleRSVP}
                            disabled={isSubmittingRsvp}
                            className={`transition-all ${isAttending ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {isSubmittingRsvp ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : isAttending ? (
                            <Check className="w-4 h-4 mr-2" />
                          ) : null}
                          {isAttending ? 'Going!' : 'RSVP'}
                        </Button>
                        <Button variant="outline" onClick={copyInviteLink}>
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                            {copied ? 'Copied Link' : 'Share Event'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Comments Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Comments & Media ({posts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add Comment Form */}
                    {user && (
                        <form onSubmit={handleComment} className="space-y-3">
                            <Textarea
                                placeholder="Share your thoughts about this event..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={3}
                            />
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm">
                                        <Camera className="w-4 h-4 mr-2" />
                                        Add Photo
                                    </Button>
                                    <Button type="button" variant="outline" size="sm">
                                        <Video className="w-4 h-4 mr-2" />
                                        Add Video
                                    </Button>
                                </div>
                                <Button type="submit" disabled={!newComment.trim()}>
                                    Post Comment
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Posts */}
                    <div className="space-y-4">
                        <AnimatePresence>
                            {posts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className="bg-secondary/20 border-border/50">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                    {post.author_email[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="font-medium">{post.author_email}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(post.created_date), 'MMM d, h:mm a')}
                                                        </span>
                                                        {post.type !== 'comment' && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {post.type}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm">{post.content}</p>
                                                    {post.media_url && (
                                                        <img 
                                                            src={post.media_url} 
                                                            alt="Event media" 
                                                            className="mt-3 rounded-lg max-w-full h-auto"
                                                        />
                                                    )}
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <Button variant="ghost" size="sm">
                                                            <Heart className="w-4 h-4 mr-1" />
                                                            {post.likes?.length || 0}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        
                        {posts.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No comments yet. Be the first to share!</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
