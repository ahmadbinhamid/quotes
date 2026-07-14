import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card } from "@flowposltd/ui";
import { Plus } from "lucide-react";
import { listQuotes } from "@/lib/api/quotes";
import { QuotesEmptyState } from "@/components/quotes/QuotesEmptyState";
import { QuotesStatusFilter, type QuotesStatusFilterValue } from "@/components/quotes/QuotesStatusFilter";
import { QuotesTable } from "@/components/quotes/QuotesTable";

export default function QuotesListPage() {
  const [filter, setFilter] = useState<QuotesStatusFilterValue>("active");

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", filter],
    queryFn: () => listQuotes({ limit: 100, status: filter === "active" ? undefined : filter }),
  });

  // "active" has no backend status of its own — it's fetched unfiltered and
  // has expired quotes stripped out client-side, so expired ones only ever
  // show up when the Expired filter is explicitly selected.
  const quotes = useMemo(() => {
    if (!data) return [];
    return filter === "active" ? data.quotes.filter((quote) => quote.status !== "expired") : data.quotes;
  }, [data, filter]);

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

      <QuotesStatusFilter value={filter} onChange={setFilter} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-content-secondary">Loading…</div>
        ) : quotes.length === 0 ? (
          <QuotesEmptyState hasFilter={filter !== "active"} />
        ) : (
          <QuotesTable quotes={quotes} />
        )}
      </Card>
    </div>
  );
}
