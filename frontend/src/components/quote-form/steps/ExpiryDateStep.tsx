import { Card, CardContent, CardHeader, CardTitle } from "@flowposltd/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";

interface ExpiryDateStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function ExpiryDateStep({ value, onChange }: ExpiryDateStepProps) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Choose an expiry date for this quote</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField label="Expiry date" required hint="The quote can no longer be accepted after this date.">
          <DatePicker value={value} onChange={onChange} className="w-full" />
        </FormField>
      </CardContent>
    </Card>
  );
}
