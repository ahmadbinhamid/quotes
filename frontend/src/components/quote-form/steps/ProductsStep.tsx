import { Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { ProductPicker, type PickedProduct } from "@/components/quote-form/ProductPicker";
import { QuoteItemsSummary } from "@/components/quote-form/QuoteItemsSummary";
import type { QuoteItemInput } from "@/types";

interface ProductsStepProps {
  items: QuoteItemInput[];
  onAdd: (product: PickedProduct) => void;
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

export function ProductsStep({
  items,
  onAdd,
  onUpdateItem,
  onRemoveItem,
  onAddCustomLine,
  discount,
  onDiscountChange,
  shipping,
  onShippingChange,
  subtotal,
  total,
}: ProductsStepProps) {
  const hasItems = items.length > 0;

  return (
    <div className={`grid gap-4 lg:h-full ${hasItems ? "grid-cols-1 lg:grid-cols-[3fr_2fr]" : "grid-cols-1"}`}>
      <Card className="flex flex-col min-h-0 lg:h-full">
        <CardHeader className="shrink-0">
          <CardTitle>Add products</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <ProductPicker onAdd={onAdd} />
        </CardContent>
      </Card>

      {hasItems && (
        <QuoteItemsSummary
          items={items}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          onAddCustomLine={onAddCustomLine}
          discount={discount}
          onDiscountChange={onDiscountChange}
          shipping={shipping}
          onShippingChange={onShippingChange}
          subtotal={subtotal}
          total={total}
        />
      )}
    </div>
  );
}
