package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"strconv"
	"time"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
	"github.com/FlowPosLtd/quotes/backend/internal/flowpos"
	"github.com/FlowPosLtd/quotes/backend/internal/models"
	"github.com/FlowPosLtd/quotes/backend/internal/repository"
)

// QuoteItemAddonInput is an add-on picked for a line item — snapshotted for
// display; FlowPOS re-resolves the real price from ExtensionID at conversion.
type QuoteItemAddonInput struct {
	ExtensionID uint64  `json:"extension_id" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Price       float64 `json:"price" binding:"gte=0"`
	Quantity    float64 `json:"quantity" binding:"required,gt=0"`
}

// QuoteItemInput is a line item: either a custom line (no VariantID, no
// addons) or a catalog line picked via the product picker.
type QuoteItemInput struct {
	VariantID   *uint64               `json:"variant_id"`
	Name        string                `json:"name" binding:"required,max=255"`
	Description string                `json:"description" binding:"max=500"`
	Quantity    float64               `json:"quantity" binding:"required,gt=0"`
	UnitPrice   float64               `json:"unit_price" binding:"gte=0"`
	// TaxAmount is a per-unit VAT breakdown, informational only — never added
	// into Total. Always 0 for a custom line.
	TaxAmount float64               `json:"tax_amount" binding:"gte=0"`
	Addons    []QuoteItemAddonInput `json:"addons"`
}

// QuoteInput is the create/update payload.
type QuoteInput struct {
	CustomerID      *uint64          `json:"customer_id"`
	CustomerName    string           `json:"customer_name" binding:"required,max=255"`
	CustomerEmail   string           `json:"customer_email" binding:"max=255"`
	CustomerPhone   string           `json:"customer_phone" binding:"max=64"`
	AddressLine1    string           `json:"address_line1" binding:"max=255"`
	AddressLine2    string           `json:"address_line2" binding:"max=255"`
	City            string           `json:"city" binding:"max=120"`
	State           string           `json:"state" binding:"max=120"`
	Postcode        string           `json:"postcode" binding:"max=32"`
	Country         string           `json:"country" binding:"max=120"`
	Items           []QuoteItemInput `json:"items" binding:"required,min=1"`
	TotalDiscount   float64          `json:"total_discount" binding:"gte=0"`
	ShippingCharges float64 `json:"shipping_charges" binding:"gte=0"`
	Notes           string           `json:"notes"`
	ExpiresAt       time.Time        `json:"expires_at"`
}

type QuoteService struct {
	quotes        repository.QuoteRepository
	installations repository.InstallationRepository
	flowpos       *flowpos.Client
}

func NewQuoteService(quotes repository.QuoteRepository, installations repository.InstallationRepository, flowposClient *flowpos.Client) *QuoteService {
	return &QuoteService{quotes: quotes, installations: installations, flowpos: flowposClient}
}

func generateShareToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func roundMoney(v float64) float64 {
	return math.Round(v*100) / 100
}

// itemAddonsTotal sums addon price × quantity, added once per line (not
// multiplied by the parent item's own quantity).
func itemAddonsTotal(addons []QuoteItemAddonInput) float64 {
	var total float64
	for _, a := range addons {
		total += a.Price * a.Quantity
	}
	return total
}

// priceItems prices each line, returning the built items plus subtotal and
// total tax. Tax is never folded into subtotal/total — purely informational.
func priceItems(in []QuoteItemInput) ([]models.QuoteItem, float64, float64) {
	items := make([]models.QuoteItem, len(in))
	var subtotal, totalTax float64
	for i, it := range in {
		addons := make([]models.QuoteItemAddon, len(it.Addons))
		for j, a := range it.Addons {
			addons[j] = models.QuoteItemAddon{ExtensionID: a.ExtensionID, Name: a.Name, Price: a.Price, Quantity: a.Quantity}
		}
		total := roundMoney(it.Quantity*it.UnitPrice + itemAddonsTotal(it.Addons))
		items[i] = models.QuoteItem{
			VariantID:   it.VariantID,
			Name:        it.Name,
			Description: it.Description,
			Quantity:    it.Quantity,
			UnitPrice:   it.UnitPrice,
			TaxAmount:   it.TaxAmount,
			Addons:      addons,
			Total:       total,
			SortOrder:   i,
		}
		subtotal += total
		totalTax += it.Quantity * it.TaxAmount
	}
	return items, roundMoney(subtotal), roundMoney(totalTax)
}

// Create builds a new draft quote, pricing items and assigning the next
// quote number and share token server-side.
func (s *QuoteService) Create(ctx context.Context, tenantID, userID uint64, in QuoteInput) (*models.Quote, error) {
	if !in.ExpiresAt.After(time.Now()) {
		return nil, fmt.Errorf("expires_at must be in the future: %w", apperrors.ErrInvalidInput)
	}

	items, subtotal, totalTax := priceItems(in.Items)
	total := roundMoney(subtotal - in.TotalDiscount + in.ShippingCharges)

	number, err := s.quotes.NextQuoteNumber(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	token, err := generateShareToken()
	if err != nil {
		return nil, err
	}

	q := &models.Quote{
		TenantID:        tenantID,
		QuoteNumber:     fmt.Sprintf("Q-%04d", number),
		ShareToken:      token,
		Status:          models.QuoteStatusDraft,
		CustomerID:      in.CustomerID,
		CustomerName:    in.CustomerName,
		CustomerEmail:   in.CustomerEmail,
		CustomerPhone:   in.CustomerPhone,
		AddressLine1:    in.AddressLine1,
		AddressLine2:    in.AddressLine2,
		City:            in.City,
		State:           in.State,
		Postcode:        in.Postcode,
		Country:         in.Country,
		Items:           items,
		SubTotal:        subtotal,
		TotalDiscount:   in.TotalDiscount,
		TotalTax:        totalTax,
		ShippingCharges: in.ShippingCharges,
		Total:           total,
		Notes:           in.Notes,
		ExpiresAt:       in.ExpiresAt,
		CreatedByUserID: userID,
	}
	if err := s.quotes.Create(ctx, q); err != nil {
		return nil, err
	}
	return q, nil
}

// Update replaces a draft quote's fields and line items. Only drafts can be
// edited — once sent, a quote is locked (a new quote should be issued
// instead), which keeps the customer's view of a sent quote stable.
func (s *QuoteService) Update(ctx context.Context, tenantID, id uint64, in QuoteInput) (*models.Quote, error) {
	existing, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing.Status != models.QuoteStatusDraft {
		return nil, fmt.Errorf("quote %s: only draft quotes can be edited: %w", existing.QuoteNumber, apperrors.ErrConflict)
	}
	if !in.ExpiresAt.After(time.Now()) {
		return nil, fmt.Errorf("expires_at must be in the future: %w", apperrors.ErrInvalidInput)
	}

	items, subtotal, totalTax := priceItems(in.Items)
	total := roundMoney(subtotal - in.TotalDiscount + in.ShippingCharges)

	fields := map[string]any{
		"customer_id": in.CustomerID,
		"customer_name": in.CustomerName, "customer_email": in.CustomerEmail, "customer_phone": in.CustomerPhone,
		"address_line1": in.AddressLine1, "address_line2": in.AddressLine2, "city": in.City, "state": in.State,
		"postcode": in.Postcode, "country": in.Country,
		"sub_total": subtotal, "total_discount": in.TotalDiscount, "total_tax": totalTax,
		"shipping_charges": in.ShippingCharges, "total": total, "notes": in.Notes, "expires_at": in.ExpiresAt,
	}
	if err := s.quotes.UpdateFields(ctx, tenantID, id, fields); err != nil {
		return nil, err
	}
	if err := s.quotes.ReplaceItems(ctx, id, items); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}

func (s *QuoteService) Get(ctx context.Context, tenantID, id uint64) (*models.Quote, error) {
	q, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	s.expireIfNeeded(ctx, q)
	return q, nil
}

func (s *QuoteService) List(ctx context.Context, tenantID uint64, filter repository.QuoteFilter) ([]models.Quote, int64, error) {
	quotes, total, err := s.quotes.List(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}
	for i := range quotes {
		s.expireIfNeeded(ctx, &quotes[i])
	}
	return quotes, total, nil
}

func (s *QuoteService) Delete(ctx context.Context, tenantID, id uint64) error {
	existing, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if existing.Status != models.QuoteStatusDraft {
		return fmt.Errorf("quote %s: only draft quotes can be deleted: %w", existing.QuoteNumber, apperrors.ErrConflict)
	}
	return s.quotes.Delete(ctx, tenantID, id)
}

// Send locks the quote against further edits and makes its share link live.
func (s *QuoteService) Send(ctx context.Context, tenantID, id uint64) (*models.Quote, error) {
	existing, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing.Status != models.QuoteStatusDraft {
		return nil, fmt.Errorf("quote %s: only draft quotes can be sent: %w", existing.QuoteNumber, apperrors.ErrConflict)
	}
	now := time.Now()
	if err := s.quotes.UpdateFields(ctx, tenantID, id, map[string]any{"status": models.QuoteStatusSent, "sent_at": now}); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}

// expirable statuses can lapse into Expired once past ExpiresAt — includes
// Accepted so an accepted-but-not-yet-converted quote can't be converted
// after its deadline just because nobody happened to view/list it first.
func expirable(status models.QuoteStatus) bool {
	switch status {
	case models.QuoteStatusSent, models.QuoteStatusViewed, models.QuoteStatusAccepted:
		return true
	default:
		return false
	}
}

// expireIfNeeded lazily flips a past-due quote to expired — there's no
// background job; expiry is just checked on every read/mutation that cares.
func (s *QuoteService) expireIfNeeded(ctx context.Context, q *models.Quote) {
	if expirable(q.Status) && time.Now().After(q.ExpiresAt) {
		preStatus := q.Status
		q.Status = models.QuoteStatusExpired
		q.PreExpiryStatus = preStatus
		fields := map[string]any{"status": models.QuoteStatusExpired, "pre_expiry_status": preStatus}
		if err := s.quotes.UpdateStatusFields(ctx, q.ID, fields); err != nil {
			log.Printf("quote %d: mark expired: %v", q.ID, err)
		}
	}
}

// Reopen brings an expired quote back to whatever state it was actually in
// right before it lapsed (sent/viewed/accepted, from PreExpiryStatus) with a
// new, future expiry date. Only expired quotes can be reopened — there's
// nothing to restore otherwise.
func (s *QuoteService) Reopen(ctx context.Context, tenantID, id uint64, newExpiresAt time.Time) (*models.Quote, error) {
	q, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if q.Status != models.QuoteStatusExpired {
		return nil, fmt.Errorf("quote %s: only expired quotes can be reopened: %w", q.QuoteNumber, apperrors.ErrConflict)
	}
	if !newExpiresAt.After(time.Now()) {
		return nil, fmt.Errorf("expires_at must be in the future: %w", apperrors.ErrInvalidInput)
	}
	restoredStatus := q.PreExpiryStatus
	// Defensive default for rows created before PreExpiryStatus existed.
	if restoredStatus == "" {
		restoredStatus = models.QuoteStatusSent
	}
	fields := map[string]any{
		"status": restoredStatus, "expires_at": newExpiresAt, "pre_expiry_status": "",
	}
	if err := s.quotes.UpdateFields(ctx, tenantID, id, fields); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}

// GetPublic resolves the customer-facing share link. A draft quote (never
// sent) has no live link yet, so it 404s just like an unknown token.
func (s *QuoteService) GetPublic(ctx context.Context, token string) (*models.Quote, error) {
	q, err := s.quotes.GetByShareToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if q.Status == models.QuoteStatusDraft {
		return nil, fmt.Errorf("quote: %w", apperrors.ErrNotFound)
	}
	s.expireIfNeeded(ctx, q)
	if q.Status == models.QuoteStatusSent {
		now := time.Now()
		if err := s.quotes.UpdateStatusFields(ctx, q.ID, map[string]any{"status": models.QuoteStatusViewed, "viewed_at": now}); err != nil {
			return nil, err
		}
		q.Status = models.QuoteStatusViewed
		q.ViewedAt = &now
	}
	return q, nil
}

func (s *QuoteService) Accept(ctx context.Context, token string) (*models.Quote, error) {
	q, err := s.quotes.GetByShareToken(ctx, token)
	if err != nil {
		return nil, err
	}
	s.expireIfNeeded(ctx, q)
	if q.Status != models.QuoteStatusSent && q.Status != models.QuoteStatusViewed {
		return nil, fmt.Errorf("quote %s: cannot be accepted from status %s: %w", q.QuoteNumber, q.Status, apperrors.ErrConflict)
	}
	now := time.Now()
	if err := s.quotes.UpdateStatusFields(ctx, q.ID, map[string]any{"status": models.QuoteStatusAccepted, "accepted_at": now}); err != nil {
		return nil, err
	}
	q.Status = models.QuoteStatusAccepted
	q.AcceptedAt = &now
	return q, nil
}

func (s *QuoteService) Decline(ctx context.Context, token string) (*models.Quote, error) {
	q, err := s.quotes.GetByShareToken(ctx, token)
	if err != nil {
		return nil, err
	}
	s.expireIfNeeded(ctx, q)
	if q.Status != models.QuoteStatusSent && q.Status != models.QuoteStatusViewed {
		return nil, fmt.Errorf("quote %s: cannot be declined from status %s: %w", q.QuoteNumber, q.Status, apperrors.ErrConflict)
	}
	now := time.Now()
	if err := s.quotes.UpdateStatusFields(ctx, q.ID, map[string]any{"status": models.QuoteStatusDeclined, "declined_at": now}); err != nil {
		return nil, err
	}
	q.Status = models.QuoteStatusDeclined
	q.DeclinedAt = &now
	return q, nil
}

// DeliveryAddressInput is the address collected at conversion time when
// FulfillmentType is "delivery" — not the quote's own address snapshot.
type DeliveryAddressInput struct {
	AddressLine1 string
	AddressLine2 string
	City         string
	State        string
	Postcode     string
	Country      string
}

// ConvertInput carries the fulfillment details an admin picks right before
// converting — which FlowPOS location handles the order, and whether the
// customer collects in-store or it ships to a delivery address. None of this
// is persisted on the quote; it's only forwarded into the single FlowPOS
// order-creation call this conversion makes.
type ConvertInput struct {
	LocationID      uint64
	FulfillmentType string // "collection" | "delivery"
	DeliveryAddress DeliveryAddressInput
}

func (in ConvertInput) validate() error {
	if in.LocationID == 0 {
		return fmt.Errorf("a location is required: %w", apperrors.ErrInvalidInput)
	}
	switch in.FulfillmentType {
	case "collection":
		return nil
	case "delivery":
		a := in.DeliveryAddress
		if a.AddressLine1 == "" || a.City == "" || a.Postcode == "" || a.Country == "" {
			return fmt.Errorf("a delivery address is required: %w", apperrors.ErrInvalidInput)
		}
		return nil
	default:
		return fmt.Errorf("fulfillment_type must be \"collection\" or \"delivery\": %w", apperrors.ErrInvalidInput)
	}
}

// ConvertToOrder turns an accepted quote into a real FlowPOS order. There's
// no order-level discount/shipping, only per-item — TotalDiscount is
// distributed proportionally by line value, ShippingCharges becomes an extra
// "Shipping" line item.
func (s *QuoteService) ConvertToOrder(ctx context.Context, tenantID, id uint64, in ConvertInput) (*models.Quote, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	q, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	s.expireIfNeeded(ctx, q)
	if q.Status != models.QuoteStatusAccepted {
		return nil, fmt.Errorf("quote %s: only accepted quotes can be converted: %w", q.QuoteNumber, apperrors.ErrConflict)
	}
	installation, err := s.installations.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	items := make([]flowpos.CreateOrderItem, 0, len(q.Items)+1)
	for _, it := range q.Items {
		var discount float64
		if q.SubTotal > 0 {
			discount = roundMoney(q.TotalDiscount * (it.Total / q.SubTotal))
		}
		item := flowpos.CreateOrderItem{Quantity: it.Quantity, DiscountAmount: discount}
		if it.VariantID != nil {
			item.VariantID = it.VariantID
			// FlowPOS rejects addons on custom lines; only valid on a variant.
			if len(it.Addons) > 0 {
				addons := make([]flowpos.CreateOrderAddon, len(it.Addons))
				for k, a := range it.Addons {
					addons[k] = flowpos.CreateOrderAddon{ExtensionID: a.ExtensionID, Quantity: a.Quantity}
				}
				item.ExtensionsData = &flowpos.CreateOrderExtensionsData{Addons: addons}
			}
			// tax_amount deliberately not sent for catalog lines — FlowPOS
			// recomputes it server-side from the product's own vat config.
		} else {
			price := it.UnitPrice
			item.Name = it.Name
			item.Price = &price
			item.TaxAmount = roundMoney(it.Quantity * it.TaxAmount)
		}
		items = append(items, item)
	}
	if q.ShippingCharges > 0 {
		price := q.ShippingCharges
		items = append(items, flowpos.CreateOrderItem{Name: "Shipping", Quantity: 1, Price: &price})
	}

	mode := flowpos.OrderModeCollection
	if in.FulfillmentType == "delivery" {
		mode = flowpos.OrderModeDelivery
	}
	locationID := in.LocationID
	orderInput := flowpos.CreateOrderInput{
		Items:      items,
		Note:       fmt.Sprintf("Converted from quote %s", q.QuoteNumber),
		Mode:       mode,
		LocationID: &locationID,
	}
	// OrderController reads name/email/phone from this nested object alone —
	// it does not backfill them from the customer_id relation.
	if q.CustomerID != nil {
		orderInput.CustomerID = q.CustomerID
	}
	var phone *string
	if q.CustomerPhone != "" {
		phone = &q.CustomerPhone
	}
	orderInput.Customer = &flowpos.CreateOrderCustomer{Name: q.CustomerName, Email: q.CustomerEmail, Phone: phone}
	if in.FulfillmentType == "delivery" {
		a := in.DeliveryAddress
		orderInput.Address = &flowpos.CreateOrderAddress{
			AddressLine1: a.AddressLine1, AddressLine2: a.AddressLine2, City: a.City, State: a.State,
			Postcode: a.Postcode, Country: a.Country,
		}
	}

	result, err := s.flowpos.CreateOrder(ctx, installation.APIKey, orderInput)
	if err != nil {
		return nil, fmt.Errorf("convert quote %s to order: %w", q.QuoteNumber, err)
	}

	now := time.Now()
	fields := map[string]any{
		"status": models.QuoteStatusConverted, "converted_at": now,
		"order_id": fmt.Sprintf("%d", result.ID), "order_number": result.OrderNumber,
	}
	// A failed payment link is retryable via the regenerate endpoint — it
	// shouldn't fail the whole conversion now that the order itself exists.
	if link, err := s.flowpos.GeneratePaymentLink(ctx, installation.APIKey, result.ID); err != nil {
		log.Printf("quote %s: generate payment link for order %d: %v", q.QuoteNumber, result.ID, err)
	} else {
		fields["payment_link_url"] = link
	}
	if err := s.quotes.UpdateFields(ctx, tenantID, id, fields); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}

// GeneratePaymentLink (re)generates the payment link for an already-
// converted quote's order — used when conversion-time generation failed, or
// to refresh a stale/expired link.
func (s *QuoteService) GeneratePaymentLink(ctx context.Context, tenantID, id uint64) (*models.Quote, error) {
	q, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if q.Status != models.QuoteStatusConverted || q.OrderID == "" {
		return nil, fmt.Errorf("quote %s: no converted order to generate a payment link for: %w", q.QuoteNumber, apperrors.ErrConflict)
	}
	orderID, err := strconv.ParseUint(q.OrderID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("quote %s: invalid stored order id %q: %w", q.QuoteNumber, q.OrderID, err)
	}
	installation, err := s.installations.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	link, err := s.flowpos.GeneratePaymentLink(ctx, installation.APIKey, orderID)
	if err != nil {
		return nil, fmt.Errorf("quote %s: generate payment link: %w", q.QuoteNumber, err)
	}
	if err := s.quotes.UpdateFields(ctx, tenantID, id, map[string]any{"payment_link_url": link}); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}
