import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Separator } from "@flowposltd/ui";
import { Plus, Tag, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
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
  onAddCustomLine,
  discount,
  onDiscountChange,
  shipping,
  onShippingChange,
  subtotal,
  total,
}: QuoteItemsSummaryProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle>Order summary</CardTitle>
        <span className="text-xs text-content-secondary">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 py-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-secondary">
            No items yet — add a product to get started.
          </p>
        ) : (
          items.map((item, index) => (
            <QuoteItemRow
              key={index}
              item={item}
              onUpdate={(patch) => onUpdateItem(index, patch)}
              onRemove={() => onRemoveItem(index)}
            />
          ))
        )}
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onAddCustomLine}>
          <Plus className="size-4" />
          Add custom line
        </Button>
      </CardContent>
      <Separator />
      <CardFooter className="shrink-0 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 w-full">
          <FormField label="Discount">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Shipping">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={shipping}
              onChange={(e) => onShippingChange(Number(e.target.value))}
            />
          </FormField>
        </div>
        <div className="w-full flex items-center justify-between text-sm text-content-secondary">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div className="w-full flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

interface QuoteItemRowProps {
  item: QuoteItemInput;
  onUpdate: (patch: Partial<QuoteItemInput>) => void;
  onRemove: () => void;
}

function QuoteItemRow({ item, onUpdate, onRemove }: QuoteItemRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-[1fr_70px_auto] gap-2 items-center">
        <div className="relative">
          {item.variant_id && (
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-content-secondary" />
          )}
          <Input
            className={item.variant_id ? "pl-8" : undefined}
            placeholder="Item name"
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <Input
          type="number"
          min={0}
          step="1"
          placeholder="Qty"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_70px_auto] gap-2 items-center">
        <span className="text-xs text-content-secondary">Unit price</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={item.unit_price}
          onChange={(e) => onUpdate({ unit_price: Number(e.target.value) })}
        />
        <span className="text-xs font-medium text-foreground text-right pr-9">{formatMoney(itemTotal(item))}</span>
      </div>
      {item.addons && item.addons.length > 0 && (
        <p className="text-xs text-content-secondary">
          + {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}
        </p>
      )}
      {itemTax(item) > 0 && <p className="text-xs text-content-secondary">Includes VAT: {formatMoney(itemTax(item))}</p>}
    </div>
  );
}
