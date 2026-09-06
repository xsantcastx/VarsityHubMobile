/**
 * State-level sales tax estimate by ZIP (first 3 digits).
 * This is a simplified estimate, not jurisdiction-level tax advice.
 */

export const STATE_TAX_RATES = Object.freeze({
  AL: 0.04,
  AK: 0.0,
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0.0,
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.05,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.06875,
  MS: 0.07,
  MO: 0.04225,
  MT: 0.0,
  NE: 0.055,
  NV: 0.0685,
  NH: 0.0,
  NJ: 0.06625,
  NM: 0.05125,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0.0,
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.045,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.0485,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
  DC: 0.06,
});

const ZIP_TO_STATE = Object.freeze({
  '350-369': 'AL',
  '995-999': 'AK',
  '850-865': 'AZ',
  '716-729': 'AR',
  '900-961': 'CA',
  '800-816': 'CO',
  '060-069': 'CT',
  '197-199': 'DE',
  '320-347': 'FL',
  '300-319': 'GA',
  '967-968': 'HI',
  '832-838': 'ID',
  '600-629': 'IL',
  '460-479': 'IN',
  '500-528': 'IA',
  '660-679': 'KS',
  '400-427': 'KY',
  '700-714': 'LA',
  '039-049': 'ME',
  '206-219': 'MD',
  '010-027': 'MA',
  '480-499': 'MI',
  '550-567': 'MN',
  '386-397': 'MS',
  '630-658': 'MO',
  '590-599': 'MT',
  '680-693': 'NE',
  '889-898': 'NV',
  '030-038': 'NH',
  '070-089': 'NJ',
  '870-884': 'NM',
  '100-149': 'NY',
  '270-289': 'NC',
  '580-588': 'ND',
  '430-458': 'OH',
  '730-749': 'OK',
  '970-979': 'OR',
  '150-196': 'PA',
  '028-029': 'RI',
  '290-299': 'SC',
  '570-577': 'SD',
  '370-385': 'TN',
  '750-799': 'TX',
  '840-847': 'UT',
  '050-059': 'VT',
  '220-246': 'VA',
  '980-994': 'WA',
  '247-268': 'WV',
  '530-549': 'WI',
  '820-831': 'WY',
  '200-205': 'DC',
});

export function getStateFromZip(zipCode) {
  if (!zipCode || typeof zipCode !== 'string') return null;
  const zip3 = zipCode.substring(0, 3);
  const zipNum = parseInt(zip3, 10);
  if (Number.isNaN(zipNum)) return null;

  for (const [range, state] of Object.entries(ZIP_TO_STATE)) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(s => parseInt(s, 10));
      if (zipNum >= start && zipNum <= end) return state;
    } else if (zipNum === parseInt(range, 10)) {
      return state;
    }
  }

  return null;
}

export function getTaxRate(zipCode) {
  const state = getStateFromZip(zipCode);
  if (!state) return 0;
  return STATE_TAX_RATES[state] || 0;
}

export function calculateSalesTax(amountCents, zipCode) {
  if (!amountCents || amountCents <= 0) return 0;
  if (!zipCode) return 0;
  return Math.round(amountCents * getTaxRate(zipCode));
}

export function getTaxInfo(zipCode) {
  const state = getStateFromZip(zipCode);
  const rate = state ? STATE_TAX_RATES[state] || 0 : 0;
  return {
    state,
    rate,
    ratePercent: `${(rate * 100).toFixed(2)}%`,
  };
}
