import { Input } from "@flowposltd/ui";
import { formatMoney } from "@/utils/quote-helpers";
import { SectionCard } from "./SectionCard";

interface ReviewPaymentCardProps {
  subtotal: number;
  totalTax: number;
  discount: number;
  onDiscountChange: (value: number) => void;
  shipping: number;
  onShippingChange: (value: number) => void;
  total: number;
}

export function ReviewPaymentCard({
  subtotal,
  totalTax,
  discount,
  onDiscountChange,
  shipping,
  onShippingChange,
  total,
}: ReviewPaymentCardProps) {
  return (
    <SectionCard title="Payment">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-content-secondary">Subtotal</span>
          <span className="tabular-nums text-foreground">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-content-secondary">Tax (VAT)</span>
          <span className="tabular-nums text-foreground">{totalTax > 0 ? formatMoney(totalTax) : "No tax applied"}</span>
        </div>
        <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-between">
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
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums text-primary">{formatMoney(total)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
