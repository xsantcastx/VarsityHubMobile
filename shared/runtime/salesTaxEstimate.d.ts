export const STATE_TAX_RATES: Readonly<Record<string, number>>;

export function getStateFromZip(zipCode: string): string | null;

export function getTaxRate(zipCode: string): number;

export function calculateSalesTax(amountCents: number, zipCode: string): number;

export function getTaxInfo(zipCode: string): {
  state: string | null;
  rate: number;
  ratePercent: string;
};
