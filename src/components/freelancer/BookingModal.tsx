import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FreelancerBooking } from '@/api/entities';
import { Calendar, MapPin, DollarSign, Users } from 'lucide-react';
import { isFeatureEnabled } from '@/components/utils/featureFlags';

// HIDDEN FEATURE: Freelancer booking system
export default function BookingModal({ isOpen, onClose, freelancer, event }) {
  const [formData, setFormData] = useState({
    service_type: '',
    booking_date: '',
    location: event?.location || '',
    special_requests: '',
    is_crowdfunded: false,
    total_cost: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isFeatureEnabled('FREELANCER_FEATURES')) {
    return null; // Hidden when feature flag is disabled
  }

  const calculateCost = (serviceType, hours = 4) => {
    const baseRate = freelancer.freelancer_rates?.hourly_rate || 75;
    const serviceMultipliers = {
      photography: 1.0,
      videography: 1.2,
      athletic_trainer: 1.5,
      dj: 0.8,
      referee: 0.6,
      score_keeper: 0.5,
      catering_services: 2.0
    };
    
    return Math.round(baseRate * hours * (serviceMultipliers[serviceType] || 1.0));
  };

  const handleServiceTypeChange = (serviceType) => {
    const cost = calculateCost(serviceType);
    setFormData({ 
      ...formData, 
      service_type: serviceType,
      total_cost: cost
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Implement Stripe payment processing
      const booking = await FreelancerBooking.create({
        event_id: event?.id,
        freelancer_email: freelancer.email,
        client_email: 'current_user@email.com', // TODO: Get from auth
        ...formData
      });

      if (formData.is_crowdfunded) {
        // TODO: Create crowdfunding campaign
        console.log('Creating crowdfunding campaign for booking:', booking.id);
      } else {
        // TODO: Process immediate payment
        console.log('Processing payment for booking:', booking.id);
      }

      alert('Booking submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Booking failed:', error);
      alert('Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book {freelancer.full_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Service Type</Label>
            <Select onValueChange={handleServiceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {freelancer.freelancer_specialties?.map(specialty => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event Date & Time</Label>
            <Input
              type="datetime-local"
              value={formData.booking_date}
              onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Location</Label>
            <Input
              placeholder="Event location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Special Requests</Label>
            <Textarea
              placeholder="Any specific requirements or notes..."
              value={formData.special_requests}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold">Total Cost</p>
              <p className="text-2xl font-bold text-green-600">
                ${formData.total_cost}
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>4 hour minimum</p>
              <p>Travel included</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="crowdfunded">Enable crowdfunding</Label>
            <Switch
              id="crowdfunded"
              checked={formData.is_crowdfunded}
              onCheckedChange={(checked) => setFormData({ ...formData, is_crowdfunded: checked })}
            />
          </div>

          {formData.is_crowdfunded && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900">Crowdfunding Enabled</p>
              <p className="text-blue-700">
                Other fans can contribute to help pay for this service. 
                The booking will be confirmed once the full amount is raised.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Processing...' : formData.is_crowdfunded ? 'Start Campaign' : 'Book & Pay'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}