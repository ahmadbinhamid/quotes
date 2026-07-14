import { Card, CardContent, CardHeader, CardTitle, Separator } from "@flowposltd/ui";
import type { QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { itemTax, itemTotal } from "@/components/quote-form/quote-item-math";
import type { QuoteItemInput } from "@/types";
import { formatDate, formatMoney } from "@/utils/quote-helpers";

interface ReviewStepProps {
  customer: QuoteCustomer;
  expiresAt: string;
  items: QuoteItemInput[];
  subtotal: number;
  totalTax: number;
  discount: number;
  shipping: number;
  total: number;
}

export function ReviewStep({ customer, expiresAt, items, subtotal, totalTax, discount, shipping, total }: ReviewStepProps) {
  const namedItems = items.filter((item) => item.name?.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium text-foreground">{customer.name || "No customer selected"}</p>
            <p className="text-content-secondary">{customer.email || customer.phone || "—"}</p>
          </div>
          <p className="text-content-secondary">Expires {formatDate(expiresAt)}</p>
        </div>

        <Separator />

        {namedItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-content-secondary">No items added yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {namedItems.map((item, index) => (
              <ReviewItemRow key={index} item={item} />
            ))}
          </div>
        )}

        <Separator />

        <div className="flex flex-col gap-1.5 text-sm ml-auto max-w-xs w-full">
          <div className="flex justify-between text-content-secondary">
            <span>Product price</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-content-secondary">
            <span>Tax (VAT)</span>
            <span>{totalTax > 0 ? formatMoney(totalTax) : "No tax applied"}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-content-secondary">
              <span>Discount</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          )}
          {shipping > 0 && (
            <div className="flex justify-between text-content-secondary">
              <span>Shipping</span>
              <span>{formatMoney(shipping)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewItemRow({ item }: { item: QuoteItemInput }) {
  const tax = itemTax(item);
  const hasTax = tax > 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between text-sm">
        <p className="font-medium text-foreground">{item.name}</p>
        <p className="text-content-secondary">
          {item.quantity} × {formatMoney(item.unit_price)}
        </p>
      </div>
      {item.addons && item.addons.length > 0 && (
        <p className="text-xs text-content-secondary">
          + {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}
        </p>
      )}
      <div className="flex items-center justify-between pt-1 text-xs text-content-secondary">
        <span>
          {hasTax
            ? item.tax_inclusive
              ? `VAT included: ${formatMoney(tax)}`
              : `VAT added: ${formatMoney(tax)}`
            : "No tax applied"}
        </span>
        <span className="font-medium text-foreground">{formatMoney(itemTotal(item))}</span>
      </div>
    </div>
  );
}
