export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export interface QuoteItem {
  id?: number;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  sort_order?: number;
}

export interface Quote {
  id: number;
  quote_number: string;
  share_token: string;
  status: QuoteStatus;
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
  created_at: string;
  updated_at: string;
}

export interface QuoteItemInput {
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteInput {
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
  total_tax: number;
  shipping_charges: number;
  notes: string;
  expires_at: string;
}
