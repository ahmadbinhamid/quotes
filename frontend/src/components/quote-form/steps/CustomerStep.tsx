import { Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { CustomerSelector, type QuoteCustomer } from "@/components/quote-form/CustomerSelector";

interface CustomerStepProps {
  value: QuoteCustomer;
  onChange: (value: QuoteCustomer) => void;
}

export function CustomerStep({ value, onChange }: CustomerStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerSelector value={value} onChange={onChange} />
      </CardContent>
    </Card>
  );
}
