import type { QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { ReviewCustomerPanel } from "@/components/quote-form/review/ReviewCustomerPanel";
import { ReviewItemsList } from "@/components/quote-form/review/ReviewItemsList";
import { ReviewNoteCard } from "@/components/quote-form/review/ReviewNoteCard";
import { ReviewPaymentCard } from "@/components/quote-form/review/ReviewPaymentCard";
import type { QuoteItemInput } from "@/types";

interface ReviewStepProps {
  customer: QuoteCustomer;
  expiresAt: string;
  items: QuoteItemInput[];
  onUpdateItem: (index: number, patch: Partial<QuoteItemInput>) => void;
  onRemoveItem: (index: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  subtotal: number;
  totalTax: number;
  discount: number;
  onDiscountChange: (value: number) => void;
  shipping: number;
  onShippingChange: (value: number) => void;
  total: number;
}

export function ReviewStep({
  customer,
  expiresAt,
  items,
  onUpdateItem,
  onRemoveItem,
  notes,
  onNotesChange,
  subtotal,
  totalTax,
  discount,
  onDiscountChange,
  shipping,
  onShippingChange,
  total,
}: ReviewStepProps) {
  const namedItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name?.trim().length > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] items-start gap-4">
      <div className="flex flex-col gap-4 min-w-0">
        <ReviewItemsList items={namedItems} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
        <ReviewNoteCard value={notes} onChange={onNotesChange} />
      </div>

      <div className="flex flex-col gap-4">
        <ReviewCustomerPanel customer={customer} expiresAt={expiresAt} />
        <ReviewPaymentCard
          subtotal={subtotal}
          totalTax={totalTax}
          discount={discount}
          onDiscountChange={onDiscountChange}
          shipping={shipping}
          onShippingChange={onShippingChange}
          total={total}
        />
      </div>
    </div>
  );
}
