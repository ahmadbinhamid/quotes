import { Badge } from "@flowposltd/ui";
import type { QuoteStatus } from "@/types";
import { QUOTE_STATUS_BADGE_VARIANT, QUOTE_STATUS_LABEL } from "@/utils/quote-helpers";

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return <Badge variant={QUOTE_STATUS_BADGE_VARIANT[status]}>{QUOTE_STATUS_LABEL[status]}</Badge>;
}
