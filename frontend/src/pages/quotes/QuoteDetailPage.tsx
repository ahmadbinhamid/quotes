import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  buttonVariants,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowposltd/ui";
import { ArrowLeft, Copy, Pencil, Trash2, Send, CheckCircle2, Link2, RefreshCw } from "lucide-react";
import { ConvertToOrderPanel } from "@/components/quotes/ConvertToOrderPanel";
import { QuoteDetailSkeleton } from "@/components/quotes/QuoteDetailSkeleton";
import { QuoteStatusBadge } from "@/components/quotes/QuoteStatusBadge";
import {
  deleteQuote,
  getQuote,
  sendQuote,
  convertQuoteToOrder,
  regeneratePaymentLink,
  type ConvertQuoteInput,
} from "@/lib/api/quotes";
import { toast } from "@/lib/toast";
import { formatMoney, formatDate, formatDateTime } from "@/utils/quote-helpers";

function shareUrl(token: string): string {
  return `${window.location.origin}/q/${token}`;
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const quoteId = Number(id);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quotes", id],
    queryFn: () => getQuote(quoteId),
    refetchOnWindowFocus: "always",
  });

  const sendMutation = useMutation({
    mutationFn: () => sendQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Link created — share the link with your customer.");
    },
  });

  const convertMutation = useMutation({
    mutationFn: (input: ConvertQuoteInput) => convertQuoteToOrder(quoteId, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(updated.order_number ? `Order ${updated.order_number} created` : "Order created");
      setConvertDialogOpen(false);
    },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: () => regeneratePaymentLink(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Payment link generated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuote(quoteId),
    onSuccess: () => {
      // Drop this quote's own detail query before invalidating the list —
      // ["quotes"] is a prefix of ["quotes", id], so a plain invalidate
      // would also refetch this now-deleted quote (still "active" until the
      // navigate below unmounts the page) and 404.
      queryClient.removeQueries({ queryKey: ["quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote deleted");
      navigate("/");
    },
  });

  const [copied, setCopied] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  async function copyShareLink() {
    if (!quote) return;
    await navigator.clipboard.writeText(shareUrl(quote.share_token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyPaymentLink() {
    if (!quote?.payment_link_url) return;
    await navigator.clipboard.writeText(quote.payment_link_url);
    setPaymentLinkCopied(true);
    setTimeout(() => setPaymentLinkCopied(false), 1500);
  }

  function confirmDelete() {
    setConfirmingDelete(false);
    deleteMutation.mutate();
  }

  if (isLoading || !quote) {
    return <QuoteDetailSkeleton />;
  }

  const canEdit = quote.status === "draft";
  const canSend = quote.status === "draft";
  const canShare = quote.status !== "draft";
  const canConvert = quote.status === "accepted";

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1>{quote.quote_number}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p className="caption mt-0.5">Created {formatDateTime(quote.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link to={`/quotes/${quote.id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil className="size-4" />
              Edit
            </Link>
          )}
          {canEdit && (
            <Button
              variant="destructive-outline"
              onClick={() => setConfirmingDelete(true)}
              loading={deleteMutation.isPending}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          {canSend && (
            <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
              <Send className="size-4" />
              Create shareable link
            </Button>
          )}
          {canConvert && (
            <Button onClick={() => setConvertDialogOpen(true)}>
              <CheckCircle2 className="size-4" />
              Convert to order
            </Button>
          )}
        </div>
      </div>

      {canShare && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Customer link</p>
              <p className="caption truncate">{shareUrl(quote.share_token)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyShareLink}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy link"}
            </Button>
          </CardContent>
        </Card>
      )}

      {quote.status === "converted" && (
        <Card className="border-tag-success">
          <CardContent className="py-4 flex flex-col gap-3 text-sm">
            <p>
              Converted to order {quote.order_number || quote.order_id} on {formatDateTime(quote.converted_at)}.
            </p>
            {quote.payment_link_url ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-content-secondary">Payment link — send this to the customer</p>
                  <p className="caption truncate">{quote.payment_link_url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={copyPaymentLink}>
                    <Copy className="size-4" />
                    {paymentLinkCopied ? "Copied" : "Copy link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => paymentLinkMutation.mutate()}
                    loading={paymentLinkMutation.isPending}
                    title="Regenerate link"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => paymentLinkMutation.mutate()}
                loading={paymentLinkMutation.isPending}
              >
                <Link2 className="size-4" />
                Generate payment link
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {quote.status === "declined" && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm">
            Customer declined this quote on {formatDateTime(quote.declined_at)}.
          </CardContent>
        </Card>
      )}
      {quote.status === "expired" && (
        <Card>
          <CardContent className="py-4 text-sm text-content-secondary">
            This quote expired on {formatDate(quote.expires_at)} without a response.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-1">
            <p className="text-foreground font-medium">{quote.customer_name}</p>
            {quote.customer_email && <p>{quote.customer_email}</p>}
            {quote.customer_phone && <p>{quote.customer_phone}</p>}
            {(quote.address_line1 || quote.city) && (
              <p className="mt-1">
                {[quote.address_line1, quote.address_line2, quote.city, quote.state, quote.postcode, quote.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="text-sm flex flex-col gap-1">
            <p>Expires {formatDate(quote.expires_at)}</p>
            {quote.sent_at && <p>Sent {formatDateTime(quote.sent_at)}</p>}
            {quote.viewed_at && <p>Viewed {formatDateTime(quote.viewed_at)}</p>}
            {quote.accepted_at && <p>Accepted {formatDateTime(quote.accepted_at)}</p>}
          </CardContent>
        </Card>
      </div>

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
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item, index) => (
                <TableRow key={item.id ?? index}>
                  <TableCell>
                    <p className="text-foreground">{item.name}</p>
                    {item.description && <p className="caption">{item.description}</p>}
                    {item.addons && item.addons.length > 0 && (
                      <p className="caption">
                        + {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}
                      </p>
                    )}
                    {!!item.tax_amount && item.tax_amount > 0 && (
                      <p className="caption">Includes VAT: {formatMoney(item.tax_amount * item.quantity)}</p>
                    )}
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
                <span>VAT (included above)</span>
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
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{quote.notes}</CardContent>
        </Card>
      )}

      {/* window.confirm() is silently blocked inside the tenant dashboard's
          iframe (its sandbox attribute omits allow-modals) — an in-app
          dialog is the only reliable way to confirm a destructive action
          here. */}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this quote?</DialogTitle>
            <DialogDescription>
              {quote.quote_number} will be permanently deleted. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={deleteMutation.isPending}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConvertToOrderPanel
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConfirm={(input) => convertMutation.mutate(input)}
        submitting={convertMutation.isPending}
      />
    </div>
  );
}
