import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LiveScoreCard({ gameData, isFollowing, onFollow, isPinned = false }) {
  const [score, setScore] = useState(gameData);
  const [isLive, setIsLive] = useState(gameData.status === 'live');

  // Simulate live score updates (replace with actual ScoreStream API calls)
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      // TODO: Replace with actual ScoreStream API call
      // const updatedScore = await fetchLiveScore(gameData.game_id);
      // setScore(updatedScore);
      
      // Simulate score changes for demo
      if (Math.random() < 0.1) { // 10% chance of score update
        setScore(prev => ({
          ...prev,
          home_score: prev.home_score + (Math.random() < 0.5 ? 1 : 0),
          away_score: prev.away_score + (Math.random() < 0.5 ? 1 : 0),
          time_remaining: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
        }));
      }
    }, 20000); // Update every 20 seconds

    return () => clearInterval(interval);
  }, [isLive, gameData.game_id]);

  const getStatusBadge = () => {
    if (score.status === 'live') {
      return <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>;
    }
    if (score.status === 'final') {
      return <Badge variant="outline">FINAL</Badge>;
    }
    if (score.status === 'upcoming') {
      return <Badge variant="outline" className="border-blue-500 text-blue-600">
        {format(new Date(score.date_time), 'h:mm a')}
      </Badge>;
    }
    return null;
  };

  return (
    <div className="relative">
      {isPinned && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full z-10">
          FEATURED
        </div>
      )}
      
      <Link to={createPageUrl(`GameDetail?id=${score.game_id}`)}>
        <Card className={`hover:shadow-lg transition-all duration-300 ${
          isPinned ? 'ring-2 ring-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-white'
        } border border-slate-200/60 hover:border-slate-300/60`}>
          <CardContent className="p-4">
            {/* Header with teams and score */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4 flex-1">
                {/* Away Team */}
                <div className="flex items-center gap-2">
                  {score.away_team.logo_url && (
                    <img 
                      src={score.away_team.logo_url} 
                      alt={score.away_team.name}
                      className="w-8 h-8 rounded"
                    />
                  )}
                  <div>
                    <p className="font-bold text-sm">{score.away_team.name}</p>
                    {score.away_team.record && (
                      <p className="text-xs text-slate-500">{score.away_team.record}</p>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center px-4">
                  <div className="flex items-center gap-1 text-2xl font-bold">
                    <span>{score.away_score}</span>
                    <span className="text-slate-400">-</span>
                    <span>{score.home_score}</span>
                  </div>
                </div>

                {/* Home Team */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold text-sm">{score.home_team.name}</p>
                    {score.home_team.record && (
                      <p className="text-xs text-slate-500">{score.home_team.record}</p>
                    )}
                  </div>
                  {score.home_team.logo_url && (
                    <img 
                      src={score.home_team.logo_url} 
                      alt={score.home_team.name}
                      className="w-8 h-8 rounded"
                    />
                  )}
                </div>
              </div>

              {/* Status and Follow Button */}
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge()}
                <Button 
                  variant={isFollowing ? "default" : "outline"} 
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onFollow(score.game_id);
                  }}
                >
                  <Bell className="w-3 h-3 mr-1" />
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </div>
            </div>

            {/* Game Info */}
            <div className="flex items-center gap-4 text-xs text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  {score.status === 'live' && score.time_remaining ? 
                    `${score.period} • ${score.time_remaining}` :
                    format(new Date(score.date_time), 'MMM d, h:mm a')
                  }
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{score.location}</span>
              </div>
              <Badge variant="secondary" className="text-xs capitalize">
                {score.sport}
              </Badge>
            </div>

            {/* Data Source Indicator */}
            {score.has_live_data ? (
              <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live data
              </div>
            ) : (
              <div className="text-xs text-slate-500 mt-2">
                Game not reporting live
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}