import { Calendar, Mail, Phone, User } from "lucide-react";
import type { QuoteCustomer } from "@/components/quote-form/CustomerSelector";
import { formatDate } from "@/utils/quote-helpers";
import { SectionCard } from "./SectionCard";

interface ReviewCustomerPanelProps {
  customer: QuoteCustomer;
  expiresAt: string;
}

export function ReviewCustomerPanel({ customer, expiresAt }: ReviewCustomerPanelProps) {
  return (
    <SectionCard title="Customer">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="size-3.5 shrink-0 text-content-tertiary" />
          <span className="font-medium text-foreground">{customer.name || "No customer selected"}</span>
        </div>
        {customer.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0 text-content-tertiary" />
            <span className="text-content-secondary">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0 text-content-tertiary" />
            <span className="text-content-secondary">{customer.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border pt-2">
          <Calendar className="size-3.5 shrink-0 text-content-tertiary" />
          <span className="text-content-secondary">Expires {formatDate(expiresAt)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
