import { Card, CardContent, CardHeader, CardTitle, Input } from "@flowposltd/ui";
import { FormField } from "@/components/ui/form-field";

interface ExpiryDateStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function ExpiryDateStep({ value, onChange }: ExpiryDateStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiry date</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField label="Expiry date" required hint="The quote can no longer be accepted after this date.">
          <Input
            type="date"
            className="max-w-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
