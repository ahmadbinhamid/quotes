import { apiClient } from "@/lib/api/client";
import type { Quote, QuoteInput } from "@/types";

export interface ListQuotesParams {
  status?: string;
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

export async function convertQuoteToOrder(id: number): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/convert`);
  return data.quote;
}

export async function regeneratePaymentLink(id: number): Promise<Quote> {
  const { data } = await apiClient.post<{ quote: Quote }>(`/quotes/${id}/payment-link`);
  return data.quote;
}
