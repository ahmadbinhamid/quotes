import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@flowposltd/ui";
import { FormField } from "@/components/ui/form-field";
import type { QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { itemTotal } from "@/components/quote-form/quote-item-math";
import type { QuoteItemInput } from "@/types";
import { formatDate, formatMoney } from "@/utils/quote-helpers";

// FlowPOS validates address.country against its address_country table
// (exists:address_country,shortcode) — "GB" is the only seeded shortcode in
// this environment, matching the tenant dashboard's own delivery-address
// select (FulfillmentType.tsx), which hardcodes the same single option.
const COUNTRIES = [{ value: "GB", label: "United Kingdom" }];

interface DeliveryAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

interface ReviewStepProps {
  notes: string;
  onNotesChange: (value: string) => void;
  address: DeliveryAddress;
  onAddressChange: (patch: Partial<DeliveryAddress>) => void;
  customer: QuoteCustomer;
  expiresAt: string;
  items: QuoteItemInput[];
  subtotal: number;
  totalTax: number;
  discount: number;
  shipping: number;
  total: number;
}

export function ReviewStep({
  notes,
  onNotesChange,
  address,
  onAddressChange,
  customer,
  expiresAt,
  items,
  subtotal,
  totalTax,
  discount,
  shipping,
  total,
}: ReviewStepProps) {
  const namedItems = items.filter((item) => item.name?.trim().length > 0);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Delivery address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <FormField label="Address line 1" className="col-span-2">
            <Input
              maxLength={255}
              value={address.addressLine1}
              onChange={(e) => onAddressChange({ addressLine1: e.target.value })}
            />
          </FormField>
          <FormField label="Address line 2" className="col-span-2">
            <Input
              maxLength={255}
              value={address.addressLine2}
              onChange={(e) => onAddressChange({ addressLine2: e.target.value })}
            />
          </FormField>
          <FormField label="City">
            <Input maxLength={120} value={address.city} onChange={(e) => onAddressChange({ city: e.target.value })} />
          </FormField>
          <FormField label="State / county">
            <Input maxLength={120} value={address.state} onChange={(e) => onAddressChange({ state: e.target.value })} />
          </FormField>
          <FormField label="Postcode">
            <Input
              maxLength={32}
              value={address.postcode}
              onChange={(e) => onAddressChange({ postcode: e.target.value })}
            />
          </FormField>
          <FormField label="Country">
            <Select value={address.country} onValueChange={(value) => onAddressChange({ country: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <FormField label="Notes">
        <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} />
      </FormField>

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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {namedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-content-secondary">
                    No items added yet.
                  </TableCell>
                </TableRow>
              ) : (
                namedItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatMoney(itemTotal(item))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Separator />

          <div className="flex flex-col gap-1.5 text-sm ml-auto max-w-xs w-full">
            <div className="flex justify-between text-content-secondary">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
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
            {totalTax > 0 && (
              <div className="flex justify-between text-content-secondary">
                <span>VAT (included above)</span>
                <span>{formatMoney(totalTax)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
