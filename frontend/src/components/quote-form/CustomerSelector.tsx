import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, MultiSelect, PhoneInput } from "@flowposltd/ui";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import { createCustomer, listCustomers, type CatalogCustomer } from "@/lib/api/catalog";
import { useDebouncedValue } from "@/utils";

export interface QuoteCustomer {
  id?: number;
  name: string;
  email: string;
  phone: string;
}

interface CustomerSelectorProps {
  value: QuoteCustomer;
  onChange: (customer: QuoteCustomer) => void;
}

const EMPTY_CUSTOMER: QuoteCustomer = { name: "", email: "", phone: "" };

// Checked in JS since there's no native <form> here for type="email" to
// validate against (see QuoteFormPage).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
  const [mode, setMode] = useState<"search" | "manual">(value.name ? "manual" : "search");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  // Split for the two-field name UI only — rejoined into one `name` on
  // create/submit, since that's all FlowPOS's customer record stores.
  const [firstName, setFirstName] = useState(() => value.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(() => value.name.split(" ").slice(1).join(" "));
  const [manualEmail, setManualEmail] = useState(value.email);
  const [manualPhone, setManualPhone] = useState(value.phone);

  const { data: customers, isFetching } = useQuery({
    queryKey: ["catalog", "customers", debouncedSearch],
    queryFn: () => listCustomers(debouncedSearch || undefined),
    enabled: mode === "search" && !value.id,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      return createCustomer({ name, email: manualEmail, phone: manualPhone || null });
    },
    onSuccess: (customer) => {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      onChange({
        id: customer.id,
        name: customer.name ?? name,
        email: customer.email ?? manualEmail,
        phone: customer.phone ?? manualPhone,
      });
    },
  });

  function pick(customer: CatalogCustomer) {
    // FlowPOS doesn't guarantee name/email at runtime despite our types —
    // fall back to email, then phone, then a generic label.
    const name = customer.name?.trim() || customer.email?.trim() || customer.phone?.trim() || `Customer #${customer.id}`;
    onChange({ id: customer.id, name, email: customer.email ?? "", phone: customer.phone ?? "" });
    setSearch("");
  }

  function handleSelectionChange(vals: (string | number)[]) {
    if (vals.length === 0) return;
    const id = vals[vals.length - 1];
    const customer = customers?.find((c) => c.id === id);
    if (customer) pick(customer);
  }

  // A real FlowPOS customer is picked (or just created) — show a summary,
  // not the search/manual-entry UI.
  if (value.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{value.name}</p>
              {value.email && <p className="text-xs text-content-secondary truncate">{value.email}</p>}
              {value.phone && <p className="text-xs text-content-secondary truncate">{value.phone}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(EMPTY_CUSTOMER)}>
              <X className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "manual") {
    const emailTyped = manualEmail.trim().length > 0;
    const emailValid = isValidEmail(manualEmail);
    const canCreate = Boolean(firstName.trim() && lastName.trim() && emailValid);

    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMode("search")}
          className="inline-flex items-center gap-1.5 self-start text-sm text-content-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to customer search
        </button>

        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="First name" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Last name" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email address"
                type="email"
                placeholder="mail@company.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                error={emailTyped && !emailValid ? "Enter a valid email address" : undefined}
              />
              <PhoneInput label="Phone number" value={manualPhone} onChange={setManualPhone} defaultCountry="GB" />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setMode("search")}>
            Cancel
          </Button>
          <Button type="button" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!canCreate}>
            <UserPlus className="size-4" />
            Create customer
          </Button>
        </div>
      </div>
    );
  }

  const options = (customers ?? []).map((c) => ({
    value: c.id,
    label: c.name || c.email || c.phone || "Unnamed customer",
  }));

  return (
    <Card className="max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Choose customer</CardTitle>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          <UserPlus className="size-4" />
          New customer
        </button>
      </CardHeader>
      <CardContent>
        <MultiSelect
          options={options}
          selectedValues={[]}
          onSelectionChange={handleSelectionChange}
          onSearch={setSearch}
          isSearching={isFetching}
          placeholder="Search by name, email or phone…"
          searchPlaceholder="Type to search customers…"
          emptyMessage="No customers found"
          showChips={false}
          size="md"
        />
      </CardContent>
    </Card>
  );
}
