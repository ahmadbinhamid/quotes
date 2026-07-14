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
import { Plus, Trash2, ArrowLeft, Tag } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker, type PickedProduct } from "@/components/quote-form/ProductPicker";
import { CustomerSelector, type QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { createQuote, getQuote, updateQuote } from "@/lib/api/quotes";
import type { QuoteInput, QuoteItemInput } from "@/types";
import { formatMoney } from "@/utils/quote-helpers";

function emptyItem(): QuoteItemInput {
  return { name: "", description: "", quantity: 1, unit_price: 0 };
}

function itemFromProduct(product: PickedProduct): QuoteItemInput {
  return {
    variant_id: product.variantId,
    name: product.name,
    description: "",
    quantity: 1,
    unit_price: product.unitPrice,
    tax_amount: product.taxPerUnit,
    addons: product.addons?.map((a) => ({
      extension_id: a.extensionId,
      name: a.name,
      price: a.price,
      quantity: a.quantity,
    })),
  };
}

// Addon cost is added once per line (not multiplied by the item's own
// quantity) — matches how FlowPOS attaches a flat addons list to a line.
// Tax is NOT added here — unit_price already reflects any VAT-exclusive
// uplift computed at add-time, tax_amount is purely a display breakdown.
function itemTotal(item: QuoteItemInput): number {
  const addonsCost = (item.addons ?? []).reduce((sum, a) => sum + a.price * a.quantity, 0);
  return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) + addonsCost;
}

function itemTax(item: QuoteItemInput): number {
  return (Number(item.quantity) || 0) * (Number(item.tax_amount) || 0);
}

// FlowPOS validates address.country against its address_country table
// (exists:address_country,shortcode) — "GB" is the only seeded shortcode in
// this environment, matching the tenant dashboard's own delivery-address
// select (FulfillmentType.tsx), which hardcodes the same single option.
const COUNTRIES = [{ value: "GB", label: "United Kingdom" }];

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

  const [customer, setCustomer] = useState<QuoteCustomer>({ name: "", email: "", phone: "" });
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("GB");
  const [items, setItems] = useState<QuoteItemInput[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());

  useEffect(() => {
    if (!existing) return;
    setCustomer({
      id: existing.customer_id ?? undefined,
      name: existing.customer_name,
      email: existing.customer_email,
      phone: existing.customer_phone,
    });
    setAddressLine1(existing.address_line1);
    setAddressLine2(existing.address_line2);
    setCity(existing.city);
    setState(existing.state);
    setPostcode(existing.postcode);
    setCountry(existing.country);
    setItems(
      existing.items.length
        ? existing.items.map((item) => ({
            variant_id: item.variant_id,
            name: item.name,
            description: item.description ?? "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_amount: item.tax_amount,
            addons: item.addons,
          }))
        : [emptyItem()]
    );
    setDiscount(existing.total_discount);
    setShipping(existing.shipping_charges);
    setNotes(existing.notes);
    setExpiresAt(existing.expires_at.slice(0, 10));
  }, [existing]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + itemTotal(item), 0), [items]);
  // Tax is never added here — it's a breakdown already embedded in each
  // item's unit_price (see itemTotal/itemTax), never additive on top.
  const totalTax = useMemo(() => items.reduce((sum, item) => sum + itemTax(item), 0), [items]);
  const total = Math.max(0, subtotal - discount + shipping);

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
    if (!customer.name?.trim()) {
      toast.error("Pick or enter a customer before saving.");
      return;
    }
    const input: QuoteInput = {
      customer_id: customer.id ?? null,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      postcode,
      country,
      items: items
        .filter((item) => item.name?.trim().length > 0)
        .map((item) => ({
          variant_id: item.variant_id,
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          tax_amount: item.tax_amount,
          addons: item.addons,
        })),
      total_discount: discount,
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
        <CardContent className="flex flex-col gap-4">
          <FormField label="Expiry date" required hint="The quote can no longer be accepted after this date.">
            <Input
              type="date"
              className="max-w-xs"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </FormField>
          <CustomerSelector value={customer} onChange={setCustomer} />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Address line 1" className="col-span-2">
              <Input maxLength={255} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </FormField>
            <FormField label="Address line 2" className="col-span-2">
              <Input maxLength={255} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            </FormField>
            <FormField label="City">
              <Input maxLength={120} value={city} onChange={(e) => setCity(e.target.value)} />
            </FormField>
            <FormField label="State / county">
              <Input maxLength={120} value={state} onChange={(e) => setState(e.target.value)} />
            </FormField>
            <FormField label="Postcode">
              <Input maxLength={32} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </FormField>
            <FormField label="Country">
              <Select value={country} onValueChange={setCountry}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add products</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPicker onAdd={(product) => setItems((prev) => [...prev, itemFromProduct(product)])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Items</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            <Plus className="size-4" />
            Add custom line
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_90px_120px_120px_auto] gap-2 items-center">
                <div className="relative">
                  {item.variant_id && (
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-content-secondary" />
                  )}
                  <Input
                    className={item.variant_id ? "pl-8" : undefined}
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                </div>
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
                  {formatMoney(itemTotal(item))}
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
              {item.addons && item.addons.length > 0 && (
                <p className="pl-3 text-xs text-content-secondary">
                  + {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}
                </p>
              )}
              {itemTax(item) > 0 && (
                <p className="pl-3 text-xs text-content-secondary">Includes VAT: {formatMoney(itemTax(item))}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="max-w-md self-end w-full">
        <CardContent className="flex flex-col gap-3">
          <FormField label="Discount">
            <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </FormField>
          <FormField label="Shipping">
            <Input type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(Number(e.target.value))} />
          </FormField>
          {totalTax > 0 && (
            <div className="flex items-center justify-between text-sm text-content-secondary">
              <span>VAT (included above)</span>
              <span>{formatMoney(totalTax)}</span>
            </div>
          )}
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
