/**
 * Tax Calculator
 * 
 * Calculates sales tax based on zip code
 * Uses state-level tax rates for simplicity (can be enhanced with county/city rates)
 */

// State tax rates (as of 2025) - simplified version
// Real implementation should use an API like TaxJar or Avalara
const STATE_TAX_RATES: Record<string, number> = {
  // States with sales tax
  'AL': 0.04,    // Alabama: 4%
  'AK': 0.00,    // Alaska: 0% (local taxes may apply)
  'AZ': 0.056,   // Arizona: 5.6%
  'AR': 0.065,   // Arkansas: 6.5%
  'CA': 0.0725,  // California: 7.25%
  'CO': 0.029,   // Colorado: 2.9%
  'CT': 0.0635,  // Connecticut: 6.35%
  'DE': 0.00,    // Delaware: 0%
  'FL': 0.06,    // Florida: 6%
  'GA': 0.04,    // Georgia: 4%
  'HI': 0.04,    // Hawaii: 4%
  'ID': 0.06,    // Idaho: 6%
  'IL': 0.0625,  // Illinois: 6.25%
  'IN': 0.07,    // Indiana: 7%
  'IA': 0.06,    // Iowa: 6%
  'KS': 0.065,   // Kansas: 6.5%
  'KY': 0.06,    // Kentucky: 6%
  'LA': 0.0445,  // Louisiana: 4.45%
  'ME': 0.055,   // Maine: 5.5%
  'MD': 0.06,    // Maryland: 6%
  'MA': 0.0625,  // Massachusetts: 6.25%
  'MI': 0.06,    // Michigan: 6%
  'MN': 0.06875, // Minnesota: 6.875%
  'MS': 0.07,    // Mississippi: 7%
  'MO': 0.04225, // Missouri: 4.225%
  'MT': 0.00,    // Montana: 0%
  'NE': 0.055,   // Nebraska: 5.5%
  'NV': 0.0685,  // Nevada: 6.85%
  'NH': 0.00,    // New Hampshire: 0%
  'NJ': 0.06625, // New Jersey: 6.625%
  'NM': 0.05125, // New Mexico: 5.125%
  'NY': 0.04,    // New York: 4%
  'NC': 0.0475,  // North Carolina: 4.75%
  'ND': 0.05,    // North Dakota: 5%
  'OH': 0.0575,  // Ohio: 5.75%
  'OK': 0.045,   // Oklahoma: 4.5%
  'OR': 0.00,    // Oregon: 0%
  'PA': 0.06,    // Pennsylvania: 6%
  'RI': 0.07,    // Rhode Island: 7%
  'SC': 0.06,    // South Carolina: 6%
  'SD': 0.045,   // South Dakota: 4.5%
  'TN': 0.07,    // Tennessee: 7%
  'TX': 0.0625,  // Texas: 6.25%
  'UT': 0.0485,  // Utah: 4.85%
  'VT': 0.06,    // Vermont: 6%
  'VA': 0.053,   // Virginia: 5.3%
  'WA': 0.065,   // Washington: 6.5%
  'WV': 0.06,    // West Virginia: 6%
  'WI': 0.05,    // Wisconsin: 5%
  'WY': 0.04,    // Wyoming: 4%
  'DC': 0.06,    // District of Columbia: 6%
};

// Zip code to state mapping (first 3 digits)
// https://en.wikipedia.org/wiki/List_of_ZIP_Code_prefixes
const ZIP_TO_STATE: Record<string, string> = {
  '350-369': 'AL', // Alabama
  '995-999': 'AK', // Alaska
  '850-865': 'AZ', // Arizona
  '716-729': 'AR', // Arkansas
  '900-961': 'CA', // California
  '800-816': 'CO', // Colorado
  '060-069': 'CT', // Connecticut
  '197-199': 'DE', // Delaware
  '320-347': 'FL', // Florida
  '300-319': 'GA', // Georgia
  '967-968': 'HI', // Hawaii
  '832-838': 'ID', // Idaho
  '600-629': 'IL', // Illinois
  '460-479': 'IN', // Indiana
  '500-528': 'IA', // Iowa
  '660-679': 'KS', // Kansas
  '400-427': 'KY', // Kentucky
  '700-714': 'LA', // Louisiana
  '039-049': 'ME', // Maine
  '206-219': 'MD', // Maryland
  '010-027': 'MA', // Massachusetts
  '480-499': 'MI', // Michigan
  '550-567': 'MN', // Minnesota
  '386-397': 'MS', // Mississippi
  '630-658': 'MO', // Missouri
  '590-599': 'MT', // Montana
  '680-693': 'NE', // Nebraska
  '889-898': 'NV', // Nevada
  '030-038': 'NH', // New Hampshire
  '070-089': 'NJ', // New Jersey
  '870-884': 'NM', // New Mexico
  '100-149': 'NY', // New York
  '270-289': 'NC', // North Carolina
  '580-588': 'ND', // North Dakota
  '430-458': 'OH', // Ohio
  '730-749': 'OK', // Oklahoma
  '970-979': 'OR', // Oregon
  '150-196': 'PA', // Pennsylvania
  '028-029': 'RI', // Rhode Island
  '290-299': 'SC', // South Carolina
  '570-577': 'SD', // South Dakota
  '370-385': 'TN', // Tennessee
  '750-799': 'TX', // Texas
  '840-847': 'UT', // Utah
  '050-059': 'VT', // Vermont
  '220-246': 'VA', // Virginia
  '980-994': 'WA', // Washington
  '247-268': 'WV', // West Virginia
  '530-549': 'WI', // Wisconsin
  '820-831': 'WY', // Wyoming
  '200-205': 'DC', // District of Columbia
};

/**
 * Get state code from zip code
 */
export function getStateFromZip(zipCode: string): string | null {
  if (!zipCode || typeof zipCode !== 'string') return null;
  
  // Extract first 3 digits
  const zip3 = zipCode.substring(0, 3);
  const zipNum = parseInt(zip3, 10);
  
  if (isNaN(zipNum)) return null;
  
  // Find matching state
  for (const [range, state] of Object.entries(ZIP_TO_STATE)) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(s => parseInt(s, 10));
      if (zipNum >= start && zipNum <= end) {
        return state;
      }
    } else {
      if (zipNum === parseInt(range, 10)) {
        return state;
      }
    }
  }
  
  return null;
}

/**
 * Calculate sales tax for a given amount and zip code
 * @param amountCents - Amount in cents
 * @param zipCode - Zip code
 * @returns Tax amount in cents
 */
export function calculateSalesTax(amountCents: number, zipCode: string): number {
  if (!amountCents || amountCents <= 0) return 0;
  if (!zipCode) return 0;
  
  const state = getStateFromZip(zipCode);
  if (!state) {
    console.warn(`[tax] Could not determine state from zip: ${zipCode}`);
    return 0;
  }
  
  const taxRate = STATE_TAX_RATES[state] || 0;
  const taxCents = Math.round(amountCents * taxRate);
  
  console.log(`[tax] ${zipCode} → ${state} → ${(taxRate * 100).toFixed(2)}% → $${(taxCents / 100).toFixed(2)}`);
  
  return taxCents;
}

/**
 * Get tax rate for a zip code
 */
export function getTaxRate(zipCode: string): number {
  const state = getStateFromZip(zipCode);
  if (!state) return 0;
  return STATE_TAX_RATES[state] || 0;
}

/**
 * Get tax information for display
 */
export function getTaxInfo(zipCode: string): {
  state: string | null;
  rate: number;
  ratePercent: string;
} {
  const state = getStateFromZip(zipCode);
  const rate = state ? (STATE_TAX_RATES[state] || 0) : 0;
  
  return {
    state,
    rate,
    ratePercent: `${(rate * 100).toFixed(2)}%`,
  };
}
