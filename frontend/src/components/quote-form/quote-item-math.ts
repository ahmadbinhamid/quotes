import type { QuoteItemInput } from "@/types";
import type { PickedProduct } from "./ProductPicker";

export function emptyItem(): QuoteItemInput {
  return { name: "", description: "", quantity: 1, unit_price: 0 };
}

export function itemFromProduct(product: PickedProduct): QuoteItemInput {
  return {
    variant_id: product.variantId,
    name: product.name,
    description: "",
    quantity: 1,
    unit_price: product.unitPrice,
    tax_amount: product.taxPerUnit,
    tax_inclusive: product.taxInclusive,
    addons: product.addons?.map((a) => ({
      extension_id: a.extensionId,
      name: a.name,
      price: a.price,
      quantity: a.quantity,
    })),
  };
}

// Addon cost is added once per line (not multiplied by the item's own
// quantity) — matches how FlowPOS attaches a flat addons list to a line.
// Tax is NOT added here — unit_price already reflects any VAT-exclusive
// uplift computed at add-time, tax_amount is purely a display breakdown.
export function itemTotal(item: QuoteItemInput): number {
  const addonsCost = (item.addons ?? []).reduce((sum, a) => sum + a.price * a.quantity, 0);
  return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) + addonsCost;
}

export function itemTax(item: QuoteItemInput): number {
  return (Number(item.quantity) || 0) * (Number(item.tax_amount) || 0);
}
