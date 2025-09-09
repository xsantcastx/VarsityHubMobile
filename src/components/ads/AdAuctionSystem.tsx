import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Advertisement } from '@/api/entities';
import { TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { isFeatureEnabled } from '@/components/utils/featureFlags';

// HIDDEN FEATURE: Advanced ad auction system
export default function AdAuctionSystem({ zipCode, targetDate, onAuctionWon }) {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAvailableSlots = useCallback(async () => {
    if (!zipCode || !targetDate) return;
    
    try {
      // Find ads scheduled for the same date/location that have auction enabled
      const auctionAds = await Advertisement.filter({
        target_zip_code: zipCode,
        booked_dates: { $in: [targetDate] },
        is_auction_enabled: true,
        payment_status: 'pending'
      });

      setAvailableSlots(auctionAds);
    } catch (error) {
      console.error('Failed to load auction slots:', error);
    }
  }, [zipCode, targetDate]);

  useEffect(() => {
    if (isFeatureEnabled('ADVANCED_AD_AUCTIONS')) {
      loadAvailableSlots();
    }
  }, [loadAvailableSlots]);

  if (!isFeatureEnabled('ADVANCED_AD_AUCTIONS')) {
    return null; // Hidden when feature flag is disabled
  }

  const handlePlaceBid = async (slotId, amount) => {
    setIsSubmitting(true);
    try {
      const slot = availableSlots.find(s => s.id === slotId);
      const newBidAmount = Math.max(amount, slot.highest_bid_amount + 1);

      await Advertisement.update(slotId, {
        highest_bid_amount: newBidAmount,
        bid_count: slot.bid_count + 1
      });

      // TODO: Implement actual bidding system with user tracking
      // This would need a separate Bids entity to track individual bids

      await loadAvailableSlots();
      setBidAmount('');
      alert('Bid placed successfully!');
    } catch (error) {
      console.error('Failed to place bid:', error);
      alert('Failed to place bid. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSlotTypeColor = (slotType) => {
    switch (slotType) {
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'auction': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (availableSlots.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No premium ad slots available for auction on this date.</p>
          <p className="text-sm text-gray-500 mt-2">
            Standard ad slots are available for ${targetDate && targetDate.includes('weekend') ? '17.50' : '10'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Premium Ad Auctions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Bid on premium ad placements that get higher visibility and engagement.
          </p>
          
          <div className="space-y-3">
            {availableSlots.map((slot) => {
              const auctionEnd = new Date(slot.auction_end_time);
              const isActive = auctionEnd > new Date();
              
              return (
                <div key={slot.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">Premium Slot #{slot.id.slice(-6)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {targetDate ? format(new Date(targetDate), 'PPP') : 'Date TBD'} • {slot.target_zip_code}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getSlotTypeColor(slot.slot_type)}>
                        {slot.slot_type}
                      </Badge>
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Live' : 'Ended'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Bid</p>
                      <p className="font-bold text-lg text-green-600">
                        ${slot.highest_bid_amount || 'No bids'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bids</p>
                      <p className="font-bold text-lg">{slot.bid_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time Left</p>
                      <p className="font-bold text-lg text-orange-600">
                        {isActive ? formatDistanceToNow(auctionEnd) : 'Ended'}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="number"
                          placeholder={`Min: $${(slot.highest_bid_amount || 0) + 1}`}
                          value={selectedSlot === slot.id ? bidAmount : ''}
                          onChange={(e) => {
                            setSelectedSlot(slot.id);
                            setBidAmount(e.target.value);
                          }}
                          className="pl-10"
                        />
                      </div>
                      <Button
                        onClick={() => handlePlaceBid(slot.id, parseFloat(bidAmount))}
                        disabled={isSubmitting || !bidAmount || selectedSlot !== slot.id}
                      >
                        {isSubmitting ? 'Bidding...' : 'Place Bid'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}