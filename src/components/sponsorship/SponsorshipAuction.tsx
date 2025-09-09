import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SponsorshipBid, EventSponsorship } from '@/api/entities';
import { Trophy, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { isFeatureEnabled } from '@/components/utils/featureFlags';

// HIDDEN FEATURE: Sponsorship auction system
export default function SponsorshipAuction({ event, onBidPlaced }) {
  const [bids, setBids] = useState([]);
  const [newBidAmount, setNewBidAmount] = useState('');
  const [highestBid, setHighestBid] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadBids = useCallback(async () => {
    if (!event?.id) return;
    
    try {
      const eventBids = await SponsorshipBid.filter({ event_id: event.id }, '-created_date');
      setBids(eventBids);
      
      if (eventBids.length > 0) {
        const highest = Math.max(...eventBids.map(bid => bid.bid_amount));
        setHighestBid(highest);
      }
    } catch (error) {
      console.error('Failed to load bids:', error);
    }
  }, [event?.id]);

  useEffect(() => {
    if (isFeatureEnabled('SPONSORSHIP_AUCTIONS')) {
      loadBids();
    }
  }, [loadBids]);

  if (!isFeatureEnabled('SPONSORSHIP_AUCTIONS')) {
    return null; // Hidden when feature flag is disabled
  }

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    const bidAmount = parseFloat(newBidAmount);
    
    if (bidAmount <= highestBid) {
      alert(`Bid must be higher than current highest bid of $${highestBid}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await SponsorshipBid.create({
        event_id: event.id,
        business_user_email: 'current_business@email.com', // TODO: Get from auth
        bid_amount: bidAmount
      });

      await loadBids();
      setNewBidAmount('');
      onBidPlaced?.(bidAmount);
    } catch (error) {
      console.error('Failed to place bid:', error);
      alert('Failed to place bid. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinimumBid = () => {
    return Math.max(highestBid + 5, 25); // Minimum $5 increment, $25 starting bid
  };

  const auctionEndTime = new Date(event.auction_end_time || event.date);
  const isAuctionActive = auctionEndTime > new Date();

  return (
    <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Sponsorship Auction
          </CardTitle>
          <Badge variant={isAuctionActive ? "default" : "secondary"}>
            {isAuctionActive ? 'Live' : 'Ended'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">Current Highest Bid</p>
            <p className="text-2xl font-bold text-green-600">
              ${highestBid > 0 ? highestBid : 'No bids yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Bids</p>
            <p className="text-xl font-semibold">{bids.length}</p>
          </div>
        </div>

        {isAuctionActive ? (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <Clock className="w-4 h-4" />
            <span>
              Ends {formatDistanceToNow(auctionEndTime, { addSuffix: true })}
            </span>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Auction ended {formatDistanceToNow(auctionEndTime, { addSuffix: true })}
          </div>
        )}

        {isAuctionActive && (
          <form onSubmit={handlePlaceBid} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Your Bid Amount</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    min={getMinimumBid()}
                    step="5"
                    value={newBidAmount}
                    onChange={(e) => setNewBidAmount(e.target.value)}
                    placeholder={`Min: $${getMinimumBid()}`}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={isSubmitting || !newBidAmount}>
                  {isSubmitting ? 'Placing...' : 'Place Bid'}
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Recent Bids</h4>
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids yet. Be the first!</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bids.slice(0, 5).map((bid, index) => (
                <div key={bid.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">${bid.bid_amount}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(bid.created_date), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg text-sm">
          <p className="font-medium text-blue-900">Sponsorship Benefits</p>
          <ul className="text-blue-700 mt-1 space-y-1">
            <li>• Logo displayed at event</li>
            <li>• Social media mentions</li>
            <li>• Digital program inclusion</li>
            <li>• Post-event photo package</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}