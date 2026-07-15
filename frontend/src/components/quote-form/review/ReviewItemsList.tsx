import { Button, Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import type { QuoteItemInput } from "@/types";
import { formatMoney } from "@/utils/quote-helpers";
import { itemTax, itemTotal } from "@/components/quote-form/quote-item-math";

interface ReviewItemsListProps {
  // Original index into the quote's full items array — needed so
  // onUpdateItem/onRemoveItem still target the right item after this list
  // filters out unnamed rows for display.
  items: { item: QuoteItemInput; index: number }[];
  onUpdateItem: (index: number, patch: Partial<QuoteItemInput>) => void;
  onRemoveItem: (index: number) => void;
}

export function ReviewItemsList({ items, onUpdateItem, onRemoveItem }: ReviewItemsListProps) {
  return (
    <Card className="flex flex-col overflow-hidden p-0" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b border-border py-3">
        <CardTitle className="text-sm">Quote Items</CardTitle>
        <span className="text-xs text-content-tertiary">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto divide-y divide-border p-0">
        {items.map(({ item, index }) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary">
              {item.image ? (
                <img src={item.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="size-4 text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
              {item.addons && item.addons.length > 0 && (
                <p className="truncate text-xs text-content-tertiary">{item.addons.map((a) => a.name).join(", ")}</p>
              )}
              {itemTax(item) > 0 && (
                <p className="text-xs text-content-tertiary">Includes VAT: {formatMoney(itemTax(item))}</p>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="tertiary"
                size="icon"
                className="size-6"
                onClick={() => onUpdateItem(index, { quantity: Math.max(1, Number(item.quantity) - 1) })}
              >
                <Minus className="size-3" />
              </Button>
              <span className="flex h-6 w-9 items-center justify-center rounded border border-border text-xs">{item.quantity}</span>
              <Button
                type="button"
                variant="tertiary"
                size="icon"
                className="size-6"
                onClick={() => onUpdateItem(index, { quantity: Number(item.quantity) + 1 })}
              >
                <Plus className="size-3" />
              </Button>
            </div>

            <div className="text-right shrink-0 min-w-20">
              <p className="text-xs text-content-tertiary">
                {item.quantity} × {formatMoney(item.unit_price)}
              </p>
              <p className="text-sm font-semibold text-foreground">{formatMoney(itemTotal(item))}</p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-content-tertiary hover:text-destructive"
              onClick={() => onRemoveItem(index)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
