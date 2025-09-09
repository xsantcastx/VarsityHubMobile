
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isPast, differenceInHours, differenceInMinutes } from 'date-fns';
import { Post } from "@/api/entities";
import { MessageSquare, Camera, Clock } from 'lucide-react';

export default function GameCard({ game }) {
  const [postCount, setPostCount] = useState(0);
  const [timeUntilEvent, setTimeUntilEvent] = useState(null);

  useEffect(() => {
    const fetchPostCount = async () => {
      const posts = await Post.filter({ game_id: game.id }, null, 0, 0, true);
      setPostCount(posts.count);
    };
    fetchPostCount();
  }, [game.id]);

  useEffect(() => {
    const updateCountdown = () => {
      const gameDate = new Date(game.date);
      const now = new Date();
      const hoursUntil = differenceInHours(gameDate, now);
      const minutesUntil = differenceInMinutes(gameDate, now);

      if (hoursUntil <= 24 && hoursUntil >= 0) {
        if (hoursUntil < 1) {
          setTimeUntilEvent(`${minutesUntil}m`);
        } else {
          const remainingMinutes = minutesUntil % 60;
          setTimeUntilEvent(`${hoursUntil}h ${remainingMinutes}m`);
        }
      } else {
        setTimeUntilEvent(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [game.date]);

  const gameDate = new Date(game.date);
  const hasEnded = isPast(gameDate);

  return (
    <Link to={createPageUrl(`GameDetail?id=${game.id}`)} className="block">
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-card border-border/50">
        <div
          className="h-32 bg-cover bg-center relative"
          style={{ backgroundImage: `url(${game.cover_image_url || 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1964&auto=format&fit=crop'})` }}
        >
          {timeUntilEvent && (
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-bold flex items-center gap-2 font-mono border border-white/20">
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
              <span>{timeUntilEvent}</span>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <p className="text-sm text-primary font-medium font-sans">{format(gameDate, 'EEE, MMM d, yyyy')}</p>
          <h3 className="text-xl font-bold text-card-foreground mt-1">{game.title}</h3>
          <p className="text-muted-foreground">{game.location}</p>
          
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/50">
            {hasEnded ? (
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>{postCount} Reviews</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  <span>Photos & Videos</span>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-primary">Upcoming Game</p>
            )}
            {/* The final_score display is now removed */}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
