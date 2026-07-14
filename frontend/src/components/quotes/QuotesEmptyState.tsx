interface QuotesEmptyStateProps {
  hasFilter: boolean;
}

export function QuotesEmptyState({ hasFilter }: QuotesEmptyStateProps) {
  return (
    <div className="p-10 text-center text-sm text-content-secondary">
      {hasFilter ? "No quotes match this filter." : "No quotes yet — create your first one."}
    </div>
  );
}
