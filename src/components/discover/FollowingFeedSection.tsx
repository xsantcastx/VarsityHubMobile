import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowUp, Trophy, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Post } from "@/api/entities";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FollowingFeedSection() {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPosts = async () => {
            try {
                // Fetches the 20 most recent posts, simulating a "following" feed for now.
                const fetchedPosts = await Post.list('-created_date', 20);
                setPosts(fetchedPosts);
            } catch (error) {
                console.error('Error loading posts:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPosts();
    }, []);

    if (isLoading) {
        return <div className="text-center p-8">Loading feed...</div>;
    }

    return (
        <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-900">Following</h2>
                <Badge variant="outline" className="text-xs">
                    {posts.length} recent posts
                </Badge>
            </div>

            {posts.length === 0 ? (
                <Card className="bg-white border-slate-200">
                    <CardContent className="p-8 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No posts from people you follow</p>
                        <p className="text-slate-400 text-sm">Follow teams and players to see their posts here</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {posts.map((post, index) => (
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
                                                            {post.title && <p className="font-bold text-sm mb-1 line-clamp-1">{post.title}</p>}
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
                                                    {post.title && <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{post.title}</h3>}
                                                    <p className="text-slate-700 text-sm line-clamp-3">{post.content}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-4">
                                                    <Badge variant="outline" className="text-xs capitalize">{post.type.replace('_', ' ')}</Badge>
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
    );
}