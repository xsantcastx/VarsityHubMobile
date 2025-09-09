import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Game, Post, User } from "@/api/entities";
import { motion } from "framer-motion";
import { format, isPast, differenceInHours, isToday } from 'date-fns';
import PostGridItem from "../components/posts/PostGridItem";
import StoryCarousel from "../components/games/StoryCarousel";
import { ArrowLeft, MessageSquare, Star, Video, Camera, Bell, Sparkles, PlusCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GameDetail() {
  const [game, setGame] = useState(null);
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const gameId = searchParams.get('id');

  useEffect(() => {
    if (gameId) {
      loadData();
    }
  }, [gameId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let gameData = null;

      try {
        const results = await Game.filter({ game_id: gameId });
        if (results.length > 0) gameData = results[0];
      } catch (error) {console.error("Error filtering by game_id:", error);}

      if (!gameData && gameId && gameId.match(/^[0-9a-fA-F]{24}$/)) {
        try {gameData = await Game.get(gameId);}
        catch (error) {console.error("Error fetching by internal ID:", error);}
      }

      if (!gameData) {
        try {
          const results = await Game.filter({ $or: [{ title: { $regex: gameId, $options: 'i' } }, { id: gameId }] });
          if (results.length > 0) gameData = results[0];
        } catch (error) {console.error("Error in broader search:", error);}
      }

      if (gameData) {
        const associatedId = gameData.game_id || gameData.id;
        try {
          const allPosts = await Post.filter({ game_id: associatedId }, '-created_date');

          let storyPosts = allPosts.filter((p) => p.is_story);
          const regularPosts = allPosts.filter((p) => !p.is_story);

          // New logic: If game was yesterday or earlier, sort top 7 stories by likes
          const gameDate = new Date(gameData.date || gameData.date_time);
          if (isPast(gameDate) && !isToday(gameDate)) {
            storyPosts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
          }

          setStories(storyPosts);
          setPosts(regularPosts);

        } catch (error) {
          console.error("Error fetching posts:", error);
          setStories([]);
          setPosts([]);
        }
        setGame(gameData);
      } else {
        console.error(`Game not found with ID: ${gameId}`);
        setGame(null);
        setPosts([]);
        setStories([]);
      }
    } catch (error) {
      console.error("Error loading game details:", error);
      setGame(null);
      setPosts([]);
      setStories([]);
    }
    setIsLoading(false);
  };

  const handleFollowGame = () => {
    setIsFollowing(!isFollowing);
    // TODO: Implement push notification subscription
  };

  if (isLoading) return <div className="p-8 text-center">Loading game details...</div>;
  if (!game) return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Game not found</h2>
      <p className="text-muted-foreground">The game you're looking for doesn't exist or may have been removed.</p>
      <Link to={createPageUrl('Feed')} className="text-primary hover:underline mt-4 inline-block">
        ← Back to Feed
      </Link>
    </div>);

  const reviews = posts.filter((p) => p.type === 'review');
  const photos = posts.filter((p) => p.type === 'photo');
  const videos = posts.filter((p) => p.type === 'video_highlight');
  const averageRating = reviews.length > 0 ? reviews.reduce((sum, p) => sum + p.rating, 0) / reviews.length : 0;

  return (
    <div>
        <div className="p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-border">
            <Link to={createPageUrl('Feed')} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                Back to Feed
            </Link>
        </div>
      <div
        className="h-48 bg-cover bg-center"
        style={{ backgroundImage: `url(${game.cover_image_url || 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1964&auto=format&fit=crop'})` }}>

        <div className="h-full w-full bg-black/50 flex flex-col justify-end p-6">
            <h1 className="text-3xl font-bold text-white shadow-lg">
              {game.title || `${game.away_team?.name || 'Away'} vs ${game.home_team?.name || 'Home'}`}
            </h1>
            <p className="text-slate-200 text-lg font-medium shadow-md font-sans mt-1">
              {format(new Date(game.date || game.date_time), 'EEEE, MMM d, yyyy')}
            </p>
        </div>
      </div>
      
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
        
        {/* Stories Section */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-500" />
                <h2 className="text-2xl font-bold">Live Stories</h2>
            </div>
            <Link to={createPageUrl(`CreatePost?gameId=${game.id}&story=true&mode=camera`)}>
              <Button variant="outline">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add to Story
              </Button>
            </Link>
          </div>
          <StoryCarousel stories={stories} />
        </div>

        <div className="border-t border-border pt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Community Posts</h2>
              <div className="text-muted-foreground px-10 flex items-center flex-wrap gap-x-6 gap-y-2">
                  {averageRating > 0 &&
              <div className="flex items-center gap-1">
                          <Star className="w-5 h-5 text-yellow-400 fill-current" />
                          <span className="font-bold text-lg text-foreground">{averageRating.toFixed(1)}</span>
                      </div>
              }
                  <div className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /><span>{reviews.length} Reviews</span></div>
                  <div className="flex items-center gap-1.5"><Camera className="w-4 h-4" /><span>{photos.length} Photos</span></div>
                  <div className="flex items-center gap-1.5"><Video className="w-4 h-4" /><span>{videos.length} Highlights</span></div>
              </div>
            </div>
            
            {posts.length > 0 ?
          <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-fr gap-2 md:gap-4">
                {posts[0] &&
            <motion.div
              className="col-span-2 row-span-2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}>

                        <PostGridItem post={posts[0]} />
                    </motion.div>
            }
                
                {posts.slice(1).map((post, index) =>
            <motion.div
              key={post.id}
              className="w-full h-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}>

                        <PostGridItem post={post} />
                    </motion.div>
            )}
            </div> :

          <div className="text-center py-10 text-muted-foreground bg-secondary/30 rounded-lg">
                  <p>No permanent posts for this game yet.</p>
                  <p className="text-sm">Add a photo, video, or review!</p>
              </div>
          }
        </div>
      </div>
    </div>);

}