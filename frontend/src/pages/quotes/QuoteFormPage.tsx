import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Textarea,
  Alert,
  AlertDescription,
} from "@flowposltd/ui";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/ui/form-field";
import { createQuote, getQuote, updateQuote } from "@/lib/api/quotes";
import type { QuoteInput, QuoteItemInput } from "@/types";
import { formatMoney } from "@/utils/quote-helpers";

function emptyItem(): QuoteItemInput {
  return { name: "", description: "", quantity: 1, unit_price: 0 };
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function QuoteFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== "new");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["quotes", id],
    queryFn: () => getQuote(Number(id)),
    enabled: isEdit,
  });

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");
  const [items, setItems] = useState<QuoteItemInput[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());

  useEffect(() => {
    if (!existing) return;
    setCustomerName(existing.customer_name);
    setCustomerEmail(existing.customer_email);
    setCustomerPhone(existing.customer_phone);
    setAddressLine1(existing.address_line1);
    setAddressLine2(existing.address_line2);
    setCity(existing.city);
    setState(existing.state);
    setPostcode(existing.postcode);
    setCountry(existing.country);
    setItems(
      existing.items.length
        ? existing.items.map((item) => ({
            name: item.name,
            description: item.description ?? "",
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))
        : [emptyItem()]
    );
    setDiscount(existing.total_discount);
    setTax(existing.total_tax);
    setShipping(existing.shipping_charges);
    setNotes(existing.notes);
    setExpiresAt(existing.expires_at.slice(0, 10));
  }, [existing]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items]
  );
  const total = Math.max(0, subtotal - discount + tax + shipping);

  const saveMutation = useMutation({
    mutationFn: (input: QuoteInput) => (isEdit ? updateQuote(Number(id), input) : createQuote(input)),
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(isEdit ? "Quote updated" : "Quote created");
      navigate(`/quotes/${quote.id}`);
    },
  });

  function updateItem(index: number, patch: Partial<QuoteItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: QuoteInput = {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      postcode,
      country,
      items: items
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
        })),
      total_discount: discount,
      total_tax: tax,
      shipping_charges: shipping,
      notes,
      expires_at: new Date(`${expiresAt}T23:59:59`).toISOString(),
    };
    saveMutation.mutate(input);
  }

  if (isEdit && isLoading) {
    return <div className="p-6 text-sm text-content-secondary">Loading…</div>;
  }

  if (isEdit && existing && existing.status !== "draft") {
    return (
      <div className="p-6 flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Quote {existing.quote_number} has already been sent and can no longer be edited.
          </AlertDescription>
        </Alert>
        <Button variant="secondary" className="self-start" asChild>
          <Link to={`/quotes/${existing.id}`}>Back to quote</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1>{isEdit ? `Edit ${existing?.quote_number ?? "quote"}` : "New quote"}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <FormField label="Name" required>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </FormField>
          <FormField label="Expiry date" required hint="The quote can no longer be accepted after this date.">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </FormField>
          <FormField label="Phone">
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </FormField>
          <FormField label="Address line 1" className="col-span-2">
            <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </FormField>
          <FormField label="Address line 2" className="col-span-2">
            <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </FormField>
          <FormField label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </FormField>
          <FormField label="State / county">
            <Input value={state} onChange={(e) => setState(e.target.value)} />
          </FormField>
          <FormField label="Postcode">
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </FormField>
          <FormField label="Country">
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Items</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            <Plus className="size-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_90px_120px_120px_auto] gap-2 items-center">
              <Input
                placeholder="Item name"
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
              />
              <Input
                type="number"
                min={0}
                step="1"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Unit price"
                value={item.unit_price}
                onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
              />
              <div className="flex h-9 items-center px-3 text-sm text-content-secondary">
                {formatMoney((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="max-w-md self-end w-full">
        <CardContent className="flex flex-col gap-3">
          <FormField label="Discount">
            <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </FormField>
          <FormField label="Tax">
            <Input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
          </FormField>
          <FormField label="Shipping">
            <Input type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(Number(e.target.value))} />
          </FormField>
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </CardContent>
      </Card>

      <FormField label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" asChild>
          <Link to="/">Cancel</Link>
        </Button>
        <Button type="submit" loading={saveMutation.isPending}>
          {isEdit ? "Save changes" : "Create quote"}
        </Button>
      </div>
    </form>
  );
}
