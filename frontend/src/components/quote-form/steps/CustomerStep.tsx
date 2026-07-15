import { CustomerSelector, type QuoteCustomer } from "@/components/quote-form/CustomerSelector";

interface CustomerStepProps {
  value: QuoteCustomer;
  onChange: (value: QuoteCustomer) => void;
}

export function CustomerStep({ value, onChange }: CustomerStepProps) {
  return <CustomerSelector value={value} onChange={onChange} />;
}
