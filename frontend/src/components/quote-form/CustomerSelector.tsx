import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, CardContent, Input } from "@flowposltd/ui";
import { Check, Search, UserPlus, X } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
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

export function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
  const [mode, setMode] = useState<"search" | "manual">(value.name ? "manual" : "search");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data: customers, isFetching } = useQuery({
    queryKey: ["catalog", "customers", debouncedSearch],
    queryFn: () => listCustomers(debouncedSearch || undefined),
    enabled: mode === "search",
  });

  const createMutation = useMutation({
    mutationFn: () => createCustomer({ name: value.name, email: value.email, phone: value.phone || null }),
    onSuccess: (customer) =>
      onChange({
        id: customer.id,
        name: customer.name ?? value.name,
        email: customer.email ?? value.email,
        phone: customer.phone ?? "",
      }),
  });

  function pick(customer: CatalogCustomer) {
    // Our types declare name/email as non-nullable, but the real FlowPOS
    // customer record doesn't guarantee that at runtime — coerce here so
    // null never enters our controlled state (a null .trim() call downstream
    // crashes the form). A nameless-but-real customer (email/phone only)
    // falls back to email, then phone, then a generic label — an empty
    // name here would otherwise be indistinguishable from "no customer
    // picked at all" to the required-name check on submit.
    const name = customer.name?.trim() || customer.email?.trim() || customer.phone?.trim() || `Customer #${customer.id}`;
    onChange({
      id: customer.id,
      name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
    });
    setSearch("");
  }

  // A real FlowPOS customer is picked (or just created) — show a summary,
  // not the search/manual-entry UI.
  if (value.id) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{value.name}</p>
            <p className="text-xs text-content-secondary truncate">{value.email || value.phone || "—"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_CUSTOMER)}>
            <X className="size-4" />
            Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required>
            <Input
              maxLength={255}
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              maxLength={255}
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input maxLength={64} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
          </FormField>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setMode("search")}>
            <Search className="size-4" />
            Search existing customers instead
          </Button>
          {value.name?.trim() && value.email?.trim() && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Check className="size-4" />
              Save as new FlowPOS customer
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-content-secondary" />
        <Input
          className="pl-8"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {isFetching && <p className="p-3 text-sm text-content-secondary">Searching…</p>}
        {!isFetching && (customers?.length ?? 0) === 0 && (
          <p className="p-3 text-sm text-content-secondary">No customers found.</p>
        )}
        {customers?.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 p-2.5 text-left hover:bg-primary/5"
            onClick={() => pick(customer)}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
              <p className="text-xs text-content-secondary truncate">{customer.email}</p>
            </div>
          </button>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setMode("manual")}>
        <UserPlus className="size-4" />
        Enter customer details manually
      </Button>
    </div>
  );
}
