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
    quantity: product.quantity,
    unit_price: product.unitPrice,
    tax_amount: product.taxPerUnit,
    tax_inclusive: product.taxInclusive,
    image: product.image,
    addons: product.addons?.map((a) => ({
      extension_id: a.extensionId,
      name: a.name,
      price: a.price,
      quantity: a.quantity,
    })),
  };
}

// Addon cost is added once per line, not multiplied by quantity. Tax isn't
// added — unit_price already reflects any VAT-exclusive uplift.
export function itemTotal(item: QuoteItemInput): number {
  const addonsCost = (item.addons ?? []).reduce((sum, a) => sum + a.price * a.quantity, 0);
  return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) + addonsCost;
}

export function itemTax(item: QuoteItemInput): number {
  return (Number(item.quantity) || 0) * (Number(item.tax_amount) || 0);
}
