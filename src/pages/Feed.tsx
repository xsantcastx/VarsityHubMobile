
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Game, User, Advertisement } from "@/api/entities";
import { motion } from "framer-motion";
import GameCard from "../components/games/GameCard";
import BannerAd from "../components/ads/BannerAd"; 
import { Shield, Search, MessageCircle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function Feed() {
  const [games, setGames] = useState([]);
  const [localAds, setLocalAds] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [currentUser, gamesData] = await Promise.all([
          User.me(),
          Game.list('-date')
        ]);
        setUser(currentUser);
        setGames(gamesData);
        
        // Fetch paid ads based on user's zip code - geo-targeting logic
        if (currentUser.zip_code) {
          const adsData = await Advertisement.filter({ 
            target_zip_code: currentUser.zip_code,
            payment_status: 'paid'
          });
          setLocalAds(adsData);
        }

      } catch (error) {
        console.error("Error loading home feed:", error);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen -mb-16">
        <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
          <header className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary"/>
              <h1 className="text-3xl font-bold text-foreground">VarsityHub</h1>
            </div>
            <Link to={createPageUrl('Messages')}>
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-6 h-6 text-muted-foreground" />
              </Button>
            </Link>
          </header>
          <div className="text-center py-20">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen -mb-16">
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <header className="pt-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary"/>
              <h1 className="text-3xl font-bold text-foreground">VarsityHub</h1>
            </div>
            <Link to={createPageUrl('Messages')}>
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-6 h-6 text-muted-foreground" />
              </Button>
            </Link>
        </header>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-muted-foreground" />
            <Input placeholder="Search by Zip Code..." className="pl-11 h-12 bg-secondary border-border text-foreground focus-visible:ring-primary" />
          </div>
          <p className="text-muted-foreground text-sm px-1">Showing upcoming and recent games in your area.</p>
        </div>
        
        {games.length === 0 && !isLoading ? (
          <div className="text-center py-20">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No events nearby yet</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Check back soon! New events are added regularly.
            </p>
            <Link to={createPageUrl('Discover')}>
              <Button className="bg-blue-600 text-white hover:bg-blue-700">
                Explore Discover
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {games.map((game, index) => (
              <React.Fragment key={game.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index * 0.1) + 0.2, duration: 0.5 }}
                >
                  <GameCard game={game} />
                </motion.div>
                
                {/* Banner Ad - ALWAYS shows after the first game */}
                {index === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                  >
                    <BannerAd ad={localAds.length > 0 ? localAds[0] : null} />
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
