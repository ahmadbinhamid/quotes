import { Card, CardContent, CardHeader, CardTitle, DatePicker } from "@flowposltd/ui";
import { FormField } from "@/components/ui/form-field";

interface ExpiryDateStepProps {
  value: string;
  onChange: (value: string) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpiryDateStep({ value, onChange }: ExpiryDateStepProps) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Choose an expiry date for this quote</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField label="Expiry date" required hint="The quote can no longer be accepted after this date.">
          <DatePicker value={value} onChange={onChange} min={today()} className="w-full" />
        </FormField>
      </CardContent>
    </Card>
  );
}
