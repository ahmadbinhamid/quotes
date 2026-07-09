import axios from "axios";
import type { Quote } from "@/types";

/**
 * Separate, unauthenticated client for the customer-facing share-link
 * endpoints (/api/public/quotes/:token/...) — deliberately not the same
 * apiClient used for staff /api/v1 calls, since these never carry a bearer
 * token and are reached from the standalone /q/:token page, not the
 * dashboard-embedded app shell.
 */
const publicClient = axios.create({
  baseURL: "/api/public/quotes",
  timeout: 15000,
});

publicClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ?? err.response?.data?.message ?? err.message;
    return Promise.reject(new Error(message));
  }
);

export async function getPublicQuote(token: string): Promise<Quote> {
  const { data } = await publicClient.get<{ quote: Quote }>(`/${token}`);
  return data.quote;
}

export async function acceptPublicQuote(token: string): Promise<Quote> {
  const { data } = await publicClient.post<{ quote: Quote }>(`/${token}/accept`);
  return data.quote;
}

export async function declinePublicQuote(token: string): Promise<Quote> {
  const { data } = await publicClient.post<{ quote: Quote }>(`/${token}/decline`);
  return data.quote;
}
