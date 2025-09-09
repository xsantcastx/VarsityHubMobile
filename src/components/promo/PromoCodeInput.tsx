import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, CheckCircle, AlertCircle } from 'lucide-react';
import { isFeatureEnabled } from '@/components/utils/featureFlags';

// HIDDEN FEATURE: Promo code system
export default function PromoCodeInput({ onPromoApplied, totalAmount }) {
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isFeatureEnabled('PROMO_CODES')) {
    return null; // Hidden when feature flag is disabled
  }

  // Mock promo codes for development
  const mockPromoCodes = {
    'FIRST10': { discount: 10, type: 'percentage', description: '10% off first subscription' },
    'ROOKIE20': { discount: 20, type: 'percentage', description: '20% off Rookie plan' },
    'SAVE5': { discount: 5, type: 'fixed', description: '$5 off any plan' },
    'VETERAN15': { discount: 15, type: 'percentage', description: '15% off Veteran plan' },
    'WELCOME': { discount: 25, type: 'percentage', description: '25% off first month' }
  };

  const validatePromoCode = async (code) => {
    setIsValidating(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const promo = mockPromoCodes[code.toUpperCase()];
      if (!promo) {
        setError('Invalid promo code');
        return;
      }

      const discount = promo.type === 'percentage' 
        ? (totalAmount * promo.discount / 100)
        : promo.discount;

      const discountedTotal = Math.max(0, totalAmount - discount);

      setAppliedPromo({
        code: code.toUpperCase(),
        ...promo,
        discountAmount: discount,
        newTotal: discountedTotal
      });

      onPromoApplied?.({
        code: code.toUpperCase(),
        discount: promo,
        originalTotal: totalAmount,
        discountAmount: discount,
        newTotal: discountedTotal
      });
    } catch (error) {
      setError('Failed to validate promo code');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (promoCode.trim()) {
      validatePromoCode(promoCode.trim());
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setError('');
    onPromoApplied?.(null);
  };

  if (appliedPromo) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  Promo Code: {appliedPromo.code}
                </p>
                <p className="text-sm text-green-700">
                  {appliedPromo.description}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={removePromo}>
              Remove
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="flex justify-between text-sm">
              <span>Original total:</span>
              <span>${totalAmount}</span>
            </div>
            <div className="flex justify-between text-sm text-green-700">
              <span>Discount:</span>
              <span>-${appliedPromo.discountAmount}</span>
            </div>
            <div className="flex justify-between font-bold text-green-800 border-t border-green-200 pt-1 mt-1">
              <span>New total:</span>
              <span>${appliedPromo.newTotal}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">Have a promo code?</span>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1"
            />
            <Button 
              type="submit" 
              variant="outline"
              disabled={isValidating || !promoCode.trim()}
            >
              {isValidating ? 'Checking...' : 'Apply'}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="mt-3 text-xs text-gray-500">
          <p>Popular codes: FIRST10, ROOKIE20, SAVE5</p>
        </div>
      </CardContent>
    </Card>
  );
}