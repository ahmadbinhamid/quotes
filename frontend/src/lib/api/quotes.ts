import { apiClient } from "@/lib/api/client";
import type { Quote, QuoteInput } from "@/types";

export interface ListQuotesParams {
  status?: string;
  exclude_expired?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListQuotesResult {
  quotes: Quote[];
  total: number;
}

export async function listQuotes(params?: ListQuotesParams): Promise<ListQuotesResult> {
  const { data } = await apiClient.get<ListQuotesResult>("/quotes", { params });
  return data;
}

export async function getQuote(id: number): Promise<Quote> {
  const { data } = await apiClient.get<{ quote: Quote }>(`/quotes/${id}`);
  return data.quote;
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>("/quotes", input);
  return data.quote;
}

export async function updateQuote(id: number, input: QuoteInput): Promise<Quote> {
  const { data } = await apiClient.patch<{ quote: Quote }>(`/quotes/${id}`, input);
  return data.quote;
}

export async function deleteQuote(id: number): Promise<void> {
  await apiClient.delete(`/quotes/${id}`);
}

export async function sendQuote(id: number): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/send`);
  return data.quote;
}

// Only valid on an expired quote — restores whatever state it was actually
// in before it lapsed (sent/viewed/accepted), with this new expiry date.
export async function reopenQuote(id: number, expiresAt: string): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/reopen`, { expires_at: expiresAt });
  return data.quote;
}

// Only valid on a sent/viewed/accepted quote — clones it into a new draft
// (so the customer's already-live link, or what they already agreed to,
// can't be edited underneath them) and marks the original superseded,
// returning the new draft to continue editing. excludeItemIds drops specific
// lines from the clone — used when a catalog item's variant/add-on is no
// longer valid in FlowPOS, so the new version doesn't fail the same way.
export async function reviseQuote(id: number, excludeItemIds?: number[]): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/revise`, {
    exclude_item_ids: excludeItemIds,
  });
  return data.quote;
}

export interface ConversionIssue {
  item_id: number;
  item_name: string;
  // "catalog_changed" is a client-side fallback, not something the backend
  // check returns — used when FlowPOS itself rejects the actual conversion
  // for a line the pre-check couldn't verify (e.g. an older quote created
  // before item.product_id was tracked, so there's nothing to re-check
  // against). See QuoteDetailPage's convertMutation.onError.
  issue: "variant_not_found" | "product_not_found" | "addon_invalid" | "price_changed" | "catalog_changed";
  addon_name?: string;
  old_price?: number;
  new_price?: number;
  message?: string;
}

export interface ConversionCheckResult {
  ok: boolean;
  issues: ConversionIssue[];
}

// Re-validates an accepted quote's catalog lines against FlowPOS's current
// data — call before opening the convert dialog so a stale variant/add-on
// surfaces as a clear warning instead of a raw error mid-conversion.
export async function checkConversionReadiness(id: number): Promise<ConversionCheckResult> {
  const { data } = await apiClient.get<ConversionCheckResult>(`/quotes/${id}/conversion-check`);
  return data;
}

export type FulfillmentType = "collection" | "delivery";

export interface ConvertQuoteInput {
  location_id: number;
  fulfillment_type: FulfillmentType;
  delivery_address?: {
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
}

export async function convertQuoteToOrder(id: number, input: ConvertQuoteInput): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/convert`, input);
  return data.quote;
}

export async function regeneratePaymentLink(id: number): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/payment-link`);
  return data.quote;
}
