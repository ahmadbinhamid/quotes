import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowposltd/ui";
import { CheckCircle2, XCircle } from "lucide-react";
import { acceptPublicQuote, declinePublicQuote, getPublicQuote } from "@/lib/api/public-quotes";
import { toast } from "@/lib/toast";
import {
  QUOTE_STATUS_LABEL,
  QUOTE_STATUS_BADGE_CLASSNAME,
  QUOTE_STATUS_BADGE_VARIANT,
  formatMoney,
  formatDate,
} from "@/utils/quote-helpers";

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [decided, setDecided] = useState(false);

  const {
    data: quote,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => getPublicQuote(token!),
    enabled: Boolean(token),
    // Staff could revise/reopen/expire this quote while the customer has it
    // open — refresh on refocus so the page notices without a manual reload.
    refetchOnWindowFocus: "always",
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptPublicQuote(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-quote", token] });
      setDecided(true);
      toast.success("Quote accepted");
    },
    // The quote's status may have moved on server-side (e.g. superseded)
    // since this page loaded — refetch so the UI reflects that instead of
    // just showing an error toast while still offering a dead Accept button.
    onError: () => queryClient.invalidateQueries({ queryKey: ["public-quote", token] }),
  });

  const declineMutation = useMutation({
    mutationFn: () => declinePublicQuote(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-quote", token] });
      setDecided(true);
      toast.success("Quote declined");
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["public-quote", token] }),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <p className="text-sm text-content-secondary">Loading…</p>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center text-sm text-content-secondary">
            This quote link is no longer valid{error instanceof Error ? `: ${error.message}` : "."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const canRespond = quote.status === "sent" || quote.status === "viewed";

  return (
    <div className="fixed inset-0 overflow-y-auto bg-secondary/30 p-6 flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1>Quote {quote.quote_number}</h1>
            <p className="lead mt-0.5">From your service provider</p>
          </div>
          <Badge variant={QUOTE_STATUS_BADGE_VARIANT[quote.status]} className={QUOTE_STATUS_BADGE_CLASSNAME[quote.status]}>
            {QUOTE_STATUS_LABEL[quote.status]}
          </Badge>
        </div>

        {quote.status === "accepted" && (
          <Card className="border-tag-success">
            <CardContent className="py-4 text-sm">
              You accepted this quote. We&apos;ll follow up to get your order started.
            </CardContent>
          </Card>
        )}
        {quote.status === "declined" && (
          <Card>
            <CardContent className="py-4 text-sm text-content-secondary">You declined this quote.</CardContent>
          </Card>
        )}
        {quote.status === "expired" && (
          <Card>
            <CardContent className="py-4 text-sm text-content-secondary">
              This quote expired on {formatDate(quote.expires_at)}. Contact us for a new one.
            </CardContent>
          </Card>
        )}
        {quote.status === "converted" && (
          <Card className="border-tag-success">
            <CardContent className="py-4 text-sm">This quote has been turned into an order.</CardContent>
          </Card>
        )}
        {quote.status === "superseded" && (
          <Card>
            <CardContent className="py-4 text-sm text-content-secondary">
              This quote has been updated and this link is no longer valid. Please ask your service provider
              for the new link.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item, index) => (
                  <TableRow key={item.id ?? index}>
                    <TableCell>
                      <p className="text-foreground">{item.name}</p>
                      {item.description && <p className="caption">{item.description}</p>}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(item.total ?? item.quantity * item.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
            <div className="flex flex-col gap-1.5 p-4 text-sm ml-auto max-w-xs">
              <div className="flex justify-between text-content-secondary">
                <span>Subtotal</span>
                <span>{formatMoney(quote.sub_total)}</span>
              </div>
              {quote.total_discount > 0 && (
                <div className="flex justify-between text-content-secondary">
                  <span>Discount</span>
                  <span>-{formatMoney(quote.total_discount)}</span>
                </div>
              )}
              {quote.total_tax > 0 && (
                <div className="flex justify-between text-content-secondary">
                  <span>Tax</span>
                  <span>{formatMoney(quote.total_tax)}</span>
                </div>
              )}
              {quote.shipping_charges > 0 && (
                <div className="flex justify-between text-content-secondary">
                  <span>Shipping</span>
                  <span>{formatMoney(quote.shipping_charges)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
                <span>Total</span>
                <span>{formatMoney(quote.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {quote.notes && (
          <Card>
            <CardContent className="text-sm whitespace-pre-wrap py-4">{quote.notes}</CardContent>
          </Card>
        )}

        {canRespond && !decided && (
          <div className="flex justify-end gap-2 flex-wrap">
            <p className="caption self-center mr-auto">Valid until {formatDate(quote.expires_at)}</p>
            <Button variant="secondary" onClick={() => declineMutation.mutate()} loading={declineMutation.isPending}>
              <XCircle className="size-4" />
              Decline
            </Button>
            <Button onClick={() => acceptMutation.mutate()} loading={acceptMutation.isPending}>
              <CheckCircle2 className="size-4" />
              Accept quote
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
