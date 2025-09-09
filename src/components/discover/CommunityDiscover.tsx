import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, Calendar, Users, Star, Trophy, MapPin, ArrowUp, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Event, Post, User, UserInteraction } from "@/api/entities";
import { format, isToday, isPast, isFuture, differenceInHours, differenceInMinutes } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CommunityDiscover() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [followingPosts, setFollowingPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      const allEvents = await Event.filter({ status: 'approved' }, 'date');
      const futureEvents = allEvents.filter(event => isFuture(new Date(event.date))).slice(0, 10);
      setUpcomingEvents(futureEvents);

      const posts = await Post.list('-created_date', 20);
      setFollowingPosts(posts);
      
    } catch (error) {
      console.error('Error loading discover data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeUntilEvent = (eventDate) => {
    const now = new Date();
    const hoursUntil = differenceInHours(new Date(eventDate), now);
    const minutesUntil = differenceInMinutes(new Date(eventDate), now);

    if (hoursUntil <= 24 && hoursUntil >= 0) {
      if (hoursUntil < 1) {
        return `${minutesUntil}m`;
      } else {
        const remainingMinutes = minutesUntil % 60;
        return `${hoursUntil}h ${remainingMinutes}m`;
      }
    }
    return null;
  };

  const filteredEvents = upcomingEvents.filter(event => {
    if (!searchQuery) return true;
    return event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           event.location.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPosts = followingPosts.filter(post => {
    if (!searchQuery) return true;
    return post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
           post.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="text-center py-10">Loading discover...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <header className="pt-2">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Discover</h1>
          
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              placeholder="Search events, teams, or players..."
              className="pl-12 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Next Events</h2>
              <Badge variant="outline" className="text-xs">
                {filteredEvents.length} upcoming
              </Badge>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No upcoming events</p>
                <p className="text-slate-400 text-sm">Follow teams or check back later!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event, index) => {
                const timeUntil = getTimeUntilEvent(event.date);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={createPageUrl(`EventDetail?id=${event.id}`)}>
                      <Card className="hover:shadow-md transition-all duration-300 bg-white border border-slate-200/60 hover:border-slate-300/60">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-slate-900">{event.title}</h3>
                                {timeUntil && (
                                  <Badge className="bg-red-500 text-white animate-pulse text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {timeUntil}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {format(new Date(event.date), 'MMM d, h:mm a')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="text-xs capitalize mb-1">
                                {event.event_type.replace('_', ' ')}
                              </Badge>
                              {event.capacity && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {event.attendees?.length || 0} / {event.capacity}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-slate-900">Following</h2>
            <Badge variant="outline" className="text-xs">
              {filteredPosts.length} posts
            </Badge>
          </div>

          {filteredPosts.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No posts from people you follow</p>
                <p className="text-slate-400 text-sm">Follow teams and players to see their posts here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={createPageUrl(`GameDetail?id=${post.game_id}`)}>
                    <Card className="hover:shadow-lg transition-all duration-300 bg-white border border-slate-200/60 hover:border-slate-300/60 aspect-square overflow-hidden group">
                      <CardContent className="p-0 h-full relative">
                        {post.media_url ? (
                          <div className="h-full w-full relative">
                            <img 
                              src={post.media_url} 
                              alt={post.title || post.content}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="flex items-center justify-between">
                                <div className="text-white">
                                  {post.title && (
                                    <p className="font-bold text-sm mb-1 line-clamp-1">{post.title}</p>
                                  )}
                                  <p className="text-xs opacity-90 line-clamp-2">{post.content}</p>
                                </div>
                                {post.upvotes?.length > 0 && (
                                  <div className="flex items-center gap-1 text-white bg-black/30 px-2 py-1 rounded-full">
                                    <ArrowUp className="w-3 h-3" />
                                    <span className="text-xs">{post.upvotes.length}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {post.type === 'video_highlight' && (
                              <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded">
                                <Trophy className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full p-4 flex flex-col justify-between bg-gradient-to-br from-slate-50 to-slate-100">
                            <div>
                              {post.title && (
                                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{post.title}</h3>
                              )}
                              <p className="text-slate-700 text-sm line-clamp-3">{post.content}</p>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <Badge variant="outline" className="text-xs capitalize">
                                {post.type.replace('_', ' ')}
                              </Badge>
                              {post.upvotes?.length > 0 && (
                                <div className="flex items-center gap-1 text-slate-600">
                                  <ArrowUp className="w-3 h-3" />
                                  <span className="text-xs">{post.upvotes.length}</span>
                                </div>
                              )}
                            </div>
                            {post.rating && (
                              <div className="flex items-center gap-1 mt-2">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < post.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}