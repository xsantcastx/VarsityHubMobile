
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Team, Post, User } from '@/api/entities';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Plus, Shield, User as UserIcon } from 'lucide-react';
import PostCard from '../components/posts/PostCard';
import { createPageUrl } from '@/utils';

export default function TeamProfile() {
    const [team, setTeam] = useState(null);
    const [posts, setPosts] = useState([]);
    const [authors, setAuthors] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const loadTeamData = async () => {
            const params = new URLSearchParams(location.search);
            const teamId = params.get('id');

            if (!teamId) {
                setIsLoading(false);
                return;
            }
            
            try {
                const [teamData, user] = await Promise.all([
                    Team.filter({ id: teamId }),
                    User.me()
                ]);

                setTeam(teamData[0]);
                setCurrentUser(user);

                if (teamData[0]) {
                    const teamPosts = await Post.filter({ game_id: teamData[0].id }, '-created_date'); // Assuming game_id can be used for team_id for posts
                    setPosts(teamPosts);

                    if (teamPosts.length > 0) {
                        const authorEmails = [...new Set(teamPosts.map(p => p.author_email))];
                        const authorData = await User.filter({ email: { $in: authorEmails } });
                        const authorsMap = authorData.reduce((acc, author) => {
                            acc[author.email] = author;
                            return acc;
                        }, {});
                        setAuthors(authorsMap);
                    }
                }
            } catch (error) {
                console.error("Failed to load team data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadTeamData();
    }, [location.search]);

    if (isLoading) return <div className="p-8 text-center">Loading team profile...</div>;
    if (!team) return <div className="p-8 text-center">Team not found.</div>

    return (
        <div className="max-w-4xl mx-auto">
            <header className="relative h-48 md:h-64">
                <img src={team.cover_image_url || 'https://images.unsplash.com/photo-1541252260730-0412e8e2108e?q=80&w=2070'} alt={`${team.name} cover`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6 flex items-end gap-4">
                    <Avatar className="w-24 h-24 border-4 border-background">
                        <AvatarImage src={team.logo_url} alt={team.name} />
                        <AvatarFallback>{team.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold text-white shadow-lg">{team.name}</h1>
                        <p className="text-white/90">@{team.handle}</p>
                    </div>
                </div>
            </header>

            <div className="p-4 md:p-6 space-y-6">
                <Card>
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2 flex-grow">
                             <p className="text-sm">{team.description}</p>
                             <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                Contact: {team.contact_person_email || 'Not set'}
                            </p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Button className="flex-1">
                                <Plus className="w-4 h-4 mr-2" /> Follow
                            </Button>
                            {currentUser?.user_role === 'fan' &&
                                <Button variant="secondary" className="flex-1" onClick={() => navigate(createPageUrl(`CreateFanEvent?team_id=${team.id}`))}>
                                    Suggest Event
                                </Button>
                            }
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="feed">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="feed">Feed</TabsTrigger>
                        <TabsTrigger value="schedule">Schedule</TabsTrigger>
                        <TabsTrigger value="roster">Roster</TabsTrigger>
                    </TabsList>
                    <TabsContent value="feed" className="space-y-6 pt-4">
                         {posts.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-muted-foreground">No posts yet for this team.</p>
                            </div>
                        ) : (
                            posts.map((post) => (
                                <PostCard key={post.id} post={post} author={authors[post.author_email]} />
                            ))
                        )}
                    </TabsContent>
                    <TabsContent value="schedule" className="pt-4">
                        <p className="text-center text-muted-foreground py-10">Schedule coming soon.</p>
                    </TabsContent>
                    <TabsContent value="roster" className="pt-4">
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {team.roster?.map((player, index) => (
                                <Card key={index}>
                                    <CardContent className="p-4 text-center">
                                        <Avatar className="w-16 h-16 mx-auto mb-2">
                                            <AvatarImage src={player.photo_url} />
                                            <AvatarFallback>{player.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-semibold">{player.name}</p>
                                        <p className="text-sm text-muted-foreground">#{player.number}</p>
                                        <p className="text-xs text-muted-foreground">{player.position}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        {(!team.roster || team.roster.length === 0) && (
                            <p className="text-center text-muted-foreground py-10">Roster not yet available.</p>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
