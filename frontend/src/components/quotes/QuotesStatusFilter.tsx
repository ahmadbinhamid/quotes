import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@flowposltd/ui";
import type { QuoteStatus } from "@/types";
import { QUOTE_STATUS_LABEL } from "@/utils/quote-helpers";

// "active" isn't a real backend status — it means "everything except
// expired", which is the default view. Selecting a specific status
// (including "expired") asks the backend to filter to just that status.
export type QuotesStatusFilterValue = "active" | QuoteStatus;

const FILTER_OPTIONS: { value: QuotesStatusFilterValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: QUOTE_STATUS_LABEL.draft },
  { value: "sent", label: QUOTE_STATUS_LABEL.sent },
  { value: "viewed", label: QUOTE_STATUS_LABEL.viewed },
  { value: "accepted", label: QUOTE_STATUS_LABEL.accepted },
  { value: "declined", label: QUOTE_STATUS_LABEL.declined },
  { value: "converted", label: QUOTE_STATUS_LABEL.converted },
  { value: "expired", label: QUOTE_STATUS_LABEL.expired },
];

interface QuotesStatusFilterProps {
  value: QuotesStatusFilterValue;
  onChange: (value: QuotesStatusFilterValue) => void;
}

export function QuotesStatusFilter({ value, onChange }: QuotesStatusFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as QuotesStatusFilterValue)}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
