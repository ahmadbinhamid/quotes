import { AlertTriangle, GitBranch } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@flowposltd/ui";
import type { ConversionIssue } from "@/lib/api/quotes";
import { formatMoney } from "@/utils/quote-helpers";

interface ConversionIssuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ConversionIssue[];
  // Total line items on the quote — if every one of them is affected,
  // there's nothing left to carry into a new version.
  totalItemCount: number;
  onCreateNewVersion: () => void;
  onCreateFreshQuote: () => void;
  submitting: boolean;
}

function issueText(issue: ConversionIssue): string {
  switch (issue.issue) {
    case "variant_not_found":
      return "This option is no longer available in your catalog.";
    case "product_not_found":
      return "This product is no longer available in your catalog.";
    case "addon_invalid":
      return `The add-on "${issue.addon_name}" is no longer available for this option.`;
    case "price_changed":
      return `The price has changed from ${formatMoney(issue.old_price)} to ${formatMoney(issue.new_price)}.`;
    case "catalog_changed":
      return issue.message ?? "Something about this item changed in your catalog.";
  }
}

// item_id is -1 for the reactive fallback (FlowPOS rejected the actual
// conversion for a line the pre-check couldn't verify) — there's no way to
// know which specific item that error refers to, so it can't be excluded
// automatically the way a pre-check finding can.
const UNKNOWN_ITEM_ID = -1;

// Every kind of issue here means the line shouldn't just be carried forward
// with stale data — either FlowPOS will reject it outright (variant/addon/
// product) or its price no longer matches what's in the catalog, so it gets
// dropped from the new version rather than silently re-quoting an old price.
const BLOCKING_ISSUES: ConversionIssue["issue"][] = [
  "variant_not_found",
  "product_not_found",
  "addon_invalid",
  "catalog_changed",
  "price_changed",
];

export function ConversionIssuesDialog({
  open,
  onOpenChange,
  issues,
  totalItemCount,
  onCreateNewVersion,
  onCreateFreshQuote,
  submitting,
}: ConversionIssuesDialogProps) {
  const hasBlockingIssue = issues.some((issue) => BLOCKING_ISSUES.includes(issue.issue));
  const canPinpointItems = issues.every((issue) => issue.item_id !== UNKNOWN_ITEM_ID);
  const blockingItemIds = new Set(
    issues.filter((issue) => BLOCKING_ISSUES.includes(issue.issue) && issue.item_id !== UNKNOWN_ITEM_ID)
      .map((issue) => issue.item_id)
  );
  // Only meaningful when every affected item is pinpointed — the reactive
  // fallback (unknown item) never triggers this, since we can't tell how
  // much of the quote it actually covers.
  const everyItemAffected = canPinpointItems && blockingItemIds.size > 0 && blockingItemIds.size >= totalItemCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>This quote can't be converted as-is</DialogTitle>
          <DialogDescription>
            {everyItemAffected
              ? "Every item in this quote is affected — there's nothing left to carry into a new version."
              : "One or more products changed in your catalog since this quote was accepted."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {issues.map((issue, index) => (
            <div key={index} className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{issue.item_name}</p>
                <p className="text-content-secondary">{issueText(issue)}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          {everyItemAffected ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onCreateFreshQuote}>Create a new quote</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onCreateNewVersion} loading={submitting}>
                <GitBranch className="size-4" />
                {hasBlockingIssue && canPinpointItems ? "Remove affected items & create new version" : "Create New Version"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
