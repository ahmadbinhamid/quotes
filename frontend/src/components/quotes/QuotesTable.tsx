import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@flowposltd/ui";
import { Link } from "react-router-dom";
import type { Quote } from "@/types";
import { formatDate, formatMoney } from "@/utils/quote-helpers";
import { QuoteStatusBadge } from "./QuoteStatusBadge";

interface QuotesTableProps {
  quotes: Quote[];
}

export function QuotesTable({ quotes }: QuotesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quote</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Expires at</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.map((quote) => (
          <QuotesTableRow key={quote.id} quote={quote} />
        ))}
      </TableBody>
    </Table>
  );
}

function QuotesTableRow({ quote }: { quote: Quote }) {
  return (
    <TableRow>
      <TableCell>
        <Link to={`/quotes/${quote.id}`} className="font-medium text-foreground hover:underline">
          {quote.quote_number}
        </Link>
      </TableCell>
      <TableCell>{quote.customer_name}</TableCell>
      <TableCell>
        <QuoteStatusBadge status={quote.status} />
      </TableCell>
      <TableCell>{formatMoney(quote.total)}</TableCell>
      <TableCell>{formatDate(quote.expires_at)}</TableCell>
    </TableRow>
  );
}
