import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button, Stepper, type StepperStep } from "@flowposltd/ui";
import { ArrowLeft } from "lucide-react";
import { CustomerStep } from "@/components/quote-form/steps/CustomerStep";
import { ExpiryDateStep } from "@/components/quote-form/steps/ExpiryDateStep";
import { ProductsStep } from "@/components/quote-form/steps/ProductsStep";
import { ReviewStep } from "@/components/quote-form/steps/ReviewStep";
import { emptyItem, itemFromProduct, itemTax, itemTotal } from "@/components/quote-form/quote-item-math";
import type { QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { createQuote, getQuote, updateQuote } from "@/lib/api/quotes";
import { toast } from "@/lib/toast";
import type { QuoteInput, QuoteItemInput } from "@/types";

const STEPS: StepperStep[] = [
  { label: "Set expiry date" },
  { label: "Choose customer" },
  { label: "Add products" },
  { label: "Review & delivery" },
];

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

  const [stepIndex, setStepIndex] = useState(0);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [customer, setCustomer] = useState<QuoteCustomer>({ name: "", email: "", phone: "" });
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("GB");
  const [items, setItems] = useState<QuoteItemInput[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!existing) return;
    setExpiresAt(existing.expires_at.slice(0, 10));
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
      existing.items.map((item) => ({
        variant_id: item.variant_id,
        name: item.name,
        description: item.description ?? "",
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_amount: item.tax_amount,
        addons: item.addons,
      }))
    );
    setDiscount(existing.total_discount);
    setShipping(existing.shipping_charges);
    setNotes(existing.notes);
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
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const canContinue = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return Boolean(expiresAt);
      case 1:
        // Not just name+email typed in — a real FlowPOS customer record,
        // either picked from search or actually created via "Save as new
        // FlowPOS customer" below. Otherwise the quote (and any order later
        // converted from it) references a customer that doesn't exist yet.
        return Boolean(customer.id);
      case 2:
        return items.some((item) => item.name?.trim().length > 0);
      default:
        return true;
    }
  }, [stepIndex, expiresAt, customer, items]);

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    if (!canContinue) return;
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  // Deliberately not a native <form onSubmit> — this is button-driven only.
  // A native form lets the browser submit on Enter from *any* focused
  // submittable control (a text input, a Radix Select's hidden native
  // <select>, etc.), which kept saving the quote before the user meant to,
  // no matter how narrowly we tried to filter it via a keydown handler.
  // Calling the mutation directly from the button's onClick sidesteps that
  // whole class of bug.
  function submitQuote() {
    if (!customer.id) {
      toast.error("Pick an existing customer or save the new one as a FlowPOS customer before saving.");
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

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-hidden">
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1>{isEdit ? `Edit ${existing?.quote_number ?? "quote"}` : "New quote"}</h1>
      </div>

      <div className="shrink-0">
        <Stepper steps={STEPS} currentStep={stepIndex} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {stepIndex === 0 && <ExpiryDateStep value={expiresAt} onChange={setExpiresAt} />}
        {stepIndex === 1 && <CustomerStep value={customer} onChange={setCustomer} />}
        {stepIndex === 2 && (
          <ProductsStep
            items={items}
            onAdd={(product) => setItems((prev) => [...prev, itemFromProduct(product)])}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onAddCustomLine={() => setItems((prev) => [...prev, emptyItem()])}
            discount={discount}
            onDiscountChange={setDiscount}
            shipping={shipping}
            onShippingChange={setShipping}
            subtotal={subtotal}
            total={total}
          />
        )}
        {stepIndex === 3 && (
          <ReviewStep
            customer={customer}
            expiresAt={expiresAt}
            items={items}
            subtotal={subtotal}
            totalTax={totalTax}
            discount={discount}
            shipping={shipping}
            total={total}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0 pt-2">
        <div>
          {stepIndex > 0 && (
            <Button type="button" variant="ghost" onClick={goBack}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" asChild>
            <Link to="/">Cancel</Link>
          </Button>
          {isLastStep ? (
            <Button type="button" onClick={submitQuote} loading={saveMutation.isPending}>
              {isEdit ? "Save changes" : "Create quote"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} disabled={!canContinue}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
