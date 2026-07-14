// Mirrors FlowPOS's own TaxCalculator::splitInclusive/splitExclusive so a
// quote's displayed tax matches what the real order ends up computing for
// the same product (catalog lines' tax is always server-derived from the
// product's own vat_rate config on conversion — see backend
// service/quote.go ConvertToOrder).
export interface ItemTax {
  // Final per-unit charge — unchanged from basePrice when VAT-inclusive
  // (tax is just a breakdown within it), uplifted by the VAT amount when
  // VAT-exclusive (tax is added on top).
  unitPrice: number;
  // Per-unit VAT breakdown, purely informational — never added again on
  // top of unitPrice by callers.
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
