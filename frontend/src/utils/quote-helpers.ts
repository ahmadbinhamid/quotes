import type { QuoteStatus } from "@/types";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export const QUOTE_STATUS_BADGE_VARIANT: Record<
  QuoteStatus,
  "status-neutral" | "status-info" | "status-success" | "status-danger" | "status-warning"
> = {
  draft: "status-neutral",
  sent: "status-info",
  viewed: "status-info",
  accepted: "status-success",
  declined: "status-danger",
  expired: "status-warning",
  converted: "status-success",
};

export function formatMoney(value: number | undefined | null): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format(value ?? 0);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
