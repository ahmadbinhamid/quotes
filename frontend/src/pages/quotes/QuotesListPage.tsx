import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, Pagination, PER_PAGE_OPTIONS } from "@flowposltd/ui";
import { Plus } from "lucide-react";
import { listQuotes } from "@/lib/api/quotes";
import { QuotesEmptyState } from "@/components/quotes/QuotesEmptyState";
import { QuotesStatusFilter, type QuotesStatusFilterValue } from "@/components/quotes/QuotesStatusFilter";
import { QuotesTable } from "@/components/quotes/QuotesTable";
import { QuotesTableSkeleton } from "@/components/quotes/QuotesTableSkeleton";

export default function QuotesListPage() {
  const [filter, setFilter] = useState<QuotesStatusFilterValue>("active");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PER_PAGE_OPTIONS[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", filter, page, itemsPerPage],
    queryFn: () =>
      listQuotes({
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
        // "active" has no backend status of its own — it means everything
        // except expired, so the backend excludes expired rows directly
        // rather than us over-fetching and filtering client-side (which
        // would make `total`/pagination wrong for this view).
        status: filter === "active" ? undefined : filter,
        exclude_expired: filter === "active",
      }),
  });

  const quotes = data?.quotes ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  function changeFilter(value: QuotesStatusFilterValue) {
    setFilter(value);
    setPage(1);
  }

  function changeItemsPerPage(limit: number) {
    setItemsPerPage(limit);
    setPage(1);
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
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

      <div className="shrink-0">
        <QuotesStatusFilter value={filter} onChange={changeFilter} />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <QuotesTableSkeleton rows={itemsPerPage} />
          </div>
        ) : quotes.length === 0 ? (
          <QuotesEmptyState hasFilter={filter !== "active"} />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <QuotesTable quotes={quotes} />
          </div>
        )}
        {totalPages > 1 && (
          <div className="shrink-0 px-4 border-t border-border">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={itemsPerPage}
              onLimitChange={changeItemsPerPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
