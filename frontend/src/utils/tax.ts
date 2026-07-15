// Mirrors FlowPOS's own TaxCalculator so a quote's displayed tax matches what
// the real order computes (catalog lines' tax is always server-derived).
export interface ItemTax {
  // Unchanged from basePrice when VAT-inclusive; uplifted when VAT-exclusive.
  unitPrice: number;
  // Informational only — never added again on top of unitPrice by callers.
  taxPerUnit: number;
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeItemTax(
  basePrice: number,
  vatRate: number | null | undefined,
  isTaxable: boolean | undefined,
  isVatInclusive: boolean | undefined
): ItemTax {
  if (!isTaxable || !vatRate || vatRate <= 0) {
    return { unitPrice: basePrice, taxPerUnit: 0 };
  }
  if (isVatInclusive) {
    const net = basePrice / (1 + vatRate / 100);
    return { unitPrice: basePrice, taxPerUnit: roundMoney(basePrice - net) };
  }
  const tax = roundMoney(basePrice * (vatRate / 100));
  return { unitPrice: roundMoney(basePrice + tax), taxPerUnit: tax };
}
