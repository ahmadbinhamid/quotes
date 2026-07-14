export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export interface QuoteItemAddon {
  extension_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface QuoteItem {
  id?: number;
  variant_id?: number | null;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  // Per-unit VAT breakdown, computed client-side at add-time from the
  // picked product's own vat_rate/is_taxable/is_vat_inclusive — never
  // added into unit_price/total, purely informational. Always 0/absent for
  // a custom (non-catalog) line.
  tax_amount?: number;
  addons?: QuoteItemAddon[];
  total?: number;
  sort_order?: number;
}

export interface Quote {
  id: number;
  quote_number: string;
  share_token: string;
  status: QuoteStatus;
  customer_id?: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  items: QuoteItem[];
  sub_total: number;
  total_discount: number;
  total_tax: number;
  shipping_charges: number;
  total: number;
  notes: string;
  expires_at: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  declined_at?: string;
  converted_at?: string;
  order_id?: string;
  order_number?: string;
  payment_link_url?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteItemInput {
  variant_id?: number | null;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  // Client-side-only display hint — whether tax_amount is baked into
  // unit_price (VAT-inclusive pricing) or added on top of it (VAT-exclusive).
  // Only known for items just picked in this session (see ProductPicker);
  // absent for items reloaded from an existing quote, since the backend
  // doesn't persist this flag. Never read by the backend.
  tax_inclusive?: boolean;
  addons?: QuoteItemAddon[];
}

export interface QuoteInput {
  customer_id?: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  items: QuoteItemInput[];
  total_discount: number;
  // No total_tax here — it's derived server-side from each item's own
  // tax_amount, never client-supplied (see backend service/quote.go).
  shipping_charges: number;
  notes: string;
  expires_at: string;
}
