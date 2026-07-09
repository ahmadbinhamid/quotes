import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, Badge } from "@flowposltd/ui";
import { Plus } from "lucide-react";
import { listQuotes } from "@/lib/api/quotes";
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_BADGE_VARIANT, formatMoney, formatDate } from "@/utils/quote-helpers";

export default function QuotesListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => listQuotes({ limit: 100 }),
  });

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1>Quotes</h1>
          <p className="lead mt-0.5">
            Create quotes, share them with customers, and convert accepted ones to orders.
          </p>
        </div>
        <Button asChild>
          <Link to="/quotes/new">
            <Plus className="size-4" />
            New quote
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-content-secondary">Loading…</div>
        ) : !data || data.quotes.length === 0 ? (
          <div className="p-10 text-center text-sm text-content-secondary">
            No quotes yet — create your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-content-secondary">
                  <th className="px-4 py-2.5 font-medium">Quote</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2.5">
                      <Link to={`/quotes/${quote.id}`} className="font-medium text-foreground hover:underline">
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{quote.customer_name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={QUOTE_STATUS_BADGE_VARIANT[quote.status]}>
                        {QUOTE_STATUS_LABEL[quote.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">{formatMoney(quote.total)}</td>
                    <td className="px-4 py-2.5">{formatDate(quote.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
