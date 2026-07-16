import type { QuoteStatus } from "@/types";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Order Placed",
};

export const QUOTE_STATUS_BADGE_VARIANT: Record<
  QuoteStatus,
  "secondary" | "outline" | "status-success" | "status-danger" | "status-info" | "status-warning"
> = {
  draft: "secondary", // Neutral, work in progress.
  sent: "status-info", // Informational — the quotation has been sent.
  viewed: "outline", // Subtle — the customer has seen it but hasn't acted yet.
  accepted: "status-success", // Positive outcome, but not yet completed.
  declined: "status-danger", // Negative outcome.
  converted: "status-success", // Final successful business outcome.
  expired: "status-warning",
};
export const QUOTE_STATUS_BADGE_CLASSNAME: Partial<Record<QuoteStatus, string>> = {
  accepted: "border-transparent bg-orange-100 !text-orange-700 dark:bg-orange-900/30 dark:!text-orange-400",
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
