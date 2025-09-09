
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserInteraction, Event } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function RSVPHistory() {
  const [rsvps, setRsvps] = useState([]);
  const [events, setEvents] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        
        // Get all RSVP interactions by this user
        const userRSVPs = await UserInteraction.filter({
          user_email: currentUser.email,
          interaction_type: 'rsvp'
        }, '-created_date');
        
        setRsvps(userRSVPs);

        if (userRSVPs.length > 0) {
          // Load event details for each RSVP in a single batch request
          const eventIds = [...new Set(userRSVPs.map(rsvp => rsvp.target_id))];
          const eventResults = await Event.filter({ id: { $in: eventIds } });
          
          const eventsMap = eventResults.reduce((acc, event) => {
            acc[event.id] = event;
            return acc;
          }, {});
          setEvents(eventsMap);
        }
      } catch (error) {
        console.error("Failed to load RSVP history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'going': return 'bg-green-100 text-green-700';
      case 'maybe': return 'bg-yellow-100 text-yellow-700';
      case 'not_going': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">RSVP History</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading RSVP history...</div>
        ) : rsvps.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No RSVPs yet</h3>
              <p className="text-muted-foreground">Start RSVPing to events to see your history here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rsvps.map((rsvp) => {
              const event = events[rsvp.target_id];
              return (
                <Card key={rsvp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{event?.title || 'Event not found'}</h3>
                        {event && (
                          <>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(event.date), 'PPP')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          RSVP'd on {format(new Date(rsvp.created_date), 'PPP')}
                        </p>
                      </div>
                      <Badge className={getStatusColor(rsvp.metadata?.status || 'going')}>
                        {rsvp.metadata?.status || 'Going'}
                      </Badge>
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
