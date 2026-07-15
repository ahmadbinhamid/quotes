import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@flowposltd/ui";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import type { QuoteItemInput } from "@/types";
import { formatMoney } from "@/utils/quote-helpers";
import { itemTax, itemTotal } from "./quote-item-math";

interface QuoteItemsSummaryProps {
  items: QuoteItemInput[];
  onUpdateItem: (index: number, patch: Partial<QuoteItemInput>) => void;
  onRemoveItem: (index: number) => void;
  onAddCustomLine: () => void;
  discount: number;
  onDiscountChange: (value: number) => void;
  shipping: number;
  onShippingChange: (value: number) => void;
  subtotal: number;
  total: number;
}

export function QuoteItemsSummary({
  items,
  onUpdateItem,
  onRemoveItem,
  discount,
  onDiscountChange,
  shipping,
  onShippingChange,
  subtotal,
  total,
}: QuoteItemsSummaryProps) {
  return (
    <Card className="flex flex-col overflow-hidden p-0 lg:h-full">
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border py-3">
        <CardTitle className="text-base">Order Summary</CardTitle>
        <span className="text-xs text-content-tertiary">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </CardHeader>

      {/* Totals — pinned right under the header so they're always visible,
          with discount/shipping editable inline. */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-content-secondary">Subtotal</span>
          <span className="font-medium tabular-nums text-foreground">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-content-secondary">Discount</span>
          <div className="flex items-center gap-1">
            <span className="text-content-tertiary">−</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              size="sm"
              className="h-7 w-20 px-2 text-right tabular-nums"
              value={discount}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-content-secondary">Shipping</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            size="sm"
            className="h-7 w-20 px-2 text-right tabular-nums"
            value={shipping}
            onChange={(e) => onShippingChange(Number(e.target.value))}
          />
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums text-primary">{formatMoney(total)}</span>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-1 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Items</p>
      </div>

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-0">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-secondary">No items yet — add a product to get started.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item, index) => (
              <QuoteItemRow
                key={index}
                item={item}
                onUpdate={(patch) => onUpdateItem(index, patch)}
                onRemove={() => onRemoveItem(index)}
              />
            ))}
          </div>
        )}
        {/* <Button type="button" variant="secondary" size="sm" className="mt-3 self-start" onClick={onAddCustomLine}>
          <Plus className="size-4" />
          Add custom line
        </Button> */}
      </CardContent>
    </Card>
  );
}

interface QuoteItemRowProps {
  item: QuoteItemInput;
  onUpdate: (patch: Partial<QuoteItemInput>) => void;
  onRemove: () => void;
}

function QuoteItemRow({ item, onUpdate, onRemove }: QuoteItemRowProps) {
  const isCatalogLine = Boolean(item.variant_id);

  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary">
          {item.image ? (
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="size-3.5 text-primary" />
          )}
        </div>
        {isCatalogLine ? (
          <p className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-foreground">{item.name}</p>
        ) : (
          <Input
            className="h-8 flex-1 px-2 text-sm"
            placeholder="Item name"
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        )}
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {!isCatalogLine && (
        <div className="flex items-center gap-1.5 pl-10.5 text-xs text-content-secondary">
          <span>Unit price</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            size="sm"
            className="h-6 w-20 px-1.5 text-xs"
            value={item.unit_price}
            onChange={(e) => onUpdate({ unit_price: Number(e.target.value) })}
          />
        </div>
      )}
      {item.addons && item.addons.length > 0 && (
        <p className="pl-10.5 text-xs text-content-secondary">
          + {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}
        </p>
      )}
      {itemTax(item) > 0 && (
        <p className="pl-10.5 text-xs text-content-secondary">Includes VAT: {formatMoney(itemTax(item))}</p>
      )}

      <div className="flex items-center justify-between pl-10.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="tertiary"
            size="icon"
            className="size-6"
            onClick={() => onUpdate({ quantity: Math.max(1, Number(item.quantity) - 1) })}
          >
            <Minus className="size-3" />
          </Button>
          <span className="flex h-6 w-9 items-center justify-center rounded border border-border text-xs">{item.quantity}</span>
          <Button
            type="button"
            variant="tertiary"
            size="icon"
            className="size-6"
            onClick={() => onUpdate({ quantity: Number(item.quantity) + 1 })}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <span className="text-sm font-semibold text-foreground">{formatMoney(itemTotal(item))}</span>
      </div>
    </div>
  );
}
