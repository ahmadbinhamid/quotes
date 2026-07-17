export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "converted"
  | "superseded";

export interface QuoteItemAddon {
  extension_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface QuoteItem {
  id?: number;
  product_id?: number | null;
  product_slug?: string;
  variant_id?: number | null;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  // Per-unit VAT breakdown, informational only. Always 0/absent for a
  // custom (non-catalog) line.
  tax_amount?: number;
  tax_inclusive?: boolean;
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
  // Revision lineage — at most one of these is ever set on a given quote.
  revises_quote_id?: number | null;
  superseded_by_quote_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItemInput {
  product_id?: number | null;
  // Preferred over product_id for the conversion-readiness re-check —
  // FlowPOS's product-lookup route doesn't reliably resolve every product by
  // its bare numeric id.
  product_slug?: string;
  variant_id?: number | null;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  // Whether tax_amount is folded into unit_price (true) or added on top of a
  // lower base price (false) — persisted so the backend can reconstruct the
  // pre-tax price FlowPOS itself quotes (see conversion-readiness check).
  tax_inclusive?: boolean;
  // Client-side thumbnail only — never read by the backend, not persisted.
  image?: string;
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
