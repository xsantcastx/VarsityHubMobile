import {
  calculateSalesTax as calculateSharedSalesTax,
  getStateFromZip,
  getTaxInfo,
  getTaxRate,
} from '@varsityhub/shared/runtime/salesTaxEstimate';

import { debugLog } from './debugLog.js';

export { getStateFromZip, getTaxInfo, getTaxRate };

/**
 * Calculate sales tax for a given amount and zip code.
 *
 * The pure ZIP/rate math lives in shared/runtime/salesTaxEstimate so client
 * estimates and server checkout cannot drift. The server wrapper keeps
 * checkout logging local to the API process.
 */
export function calculateSalesTax(amountCents: number, zipCode: string): number {
  const state = getStateFromZip(zipCode);
  if (!state) {
    if (amountCents > 0 && zipCode) {
      console.warn(`[tax] Could not determine state from zip: ${zipCode}`);
    }
    return 0;
  }

  const taxRate = getTaxRate(zipCode);
  const taxCents = calculateSharedSalesTax(amountCents, zipCode);

  debugLog(
    `[tax] ${zipCode} -> ${state} -> ${(taxRate * 100).toFixed(2)}% -> $${(taxCents / 100).toFixed(2)}`
  );

  return taxCents;
}
