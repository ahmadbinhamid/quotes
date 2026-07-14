import { Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { CustomerSelector, type QuoteCustomer } from "@/components/quote-form/CustomerSelector";

interface CustomerStepProps {
  value: QuoteCustomer;
  onChange: (value: QuoteCustomer) => void;
}

export function CustomerStep({ value, onChange }: CustomerStepProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <CustomerSelector value={value} onChange={onChange} />
      </CardContent>
    </Card>
  );
}
