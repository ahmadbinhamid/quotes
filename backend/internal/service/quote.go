package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"time"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
	"github.com/FlowPosLtd/quotes/backend/internal/flowpos"
	"github.com/FlowPosLtd/quotes/backend/internal/models"
	"github.com/FlowPosLtd/quotes/backend/internal/repository"
)

// QuoteItemInput is a freeform line item as typed by staff — no product
// catalog integration.
type QuoteItemInput struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity" binding:"required,gt=0"`
	UnitPrice   float64 `json:"unit_price" binding:"gte=0"`
}

// QuoteInput is the create/update payload. Customer/address fields are
// freeform — they're either typed directly in the quotes UI or supplied by
// whatever platform (tenant dashboard, or another caller) creates the quote
// via the API.
type QuoteInput struct {
	CustomerName    string           `json:"customer_name" binding:"required"`
	CustomerEmail   string           `json:"customer_email"`
	CustomerPhone   string           `json:"customer_phone"`
	AddressLine1    string           `json:"address_line1"`
	AddressLine2    string           `json:"address_line2"`
	City            string           `json:"city"`
	State           string           `json:"state"`
	Postcode        string           `json:"postcode"`
	Country         string           `json:"country"`
	Items           []QuoteItemInput `json:"items" binding:"required,min=1"`
	TotalDiscount   float64          `json:"total_discount" binding:"gte=0"`
	TotalTax        float64          `json:"total_tax" binding:"gte=0"`
	ShippingCharges float64          `json:"shipping_charges" binding:"gte=0"`
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

func priceItems(in []QuoteItemInput) ([]models.QuoteItem, float64) {
	items := make([]models.QuoteItem, len(in))
	var subtotal float64
	for i, it := range in {
		total := roundMoney(it.Quantity * it.UnitPrice)
		items[i] = models.QuoteItem{
			Name:        it.Name,
			Description: it.Description,
			Quantity:    it.Quantity,
			UnitPrice:   it.UnitPrice,
			Total:       total,
			SortOrder:   i,
		}
		subtotal += total
	}
	return items, roundMoney(subtotal)
}

// Create builds a new draft quote, pricing items and assigning the next
// quote number and share token server-side.
func (s *QuoteService) Create(ctx context.Context, tenantID, userID uint64, in QuoteInput) (*models.Quote, error) {
	if !in.ExpiresAt.After(time.Now()) {
		return nil, fmt.Errorf("expires_at must be in the future: %w", apperrors.ErrInvalidInput)
	}

	items, subtotal := priceItems(in.Items)
	total := roundMoney(subtotal - in.TotalDiscount + in.TotalTax + in.ShippingCharges)

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
		TotalTax:        in.TotalTax,
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

	items, subtotal := priceItems(in.Items)
	total := roundMoney(subtotal - in.TotalDiscount + in.TotalTax + in.ShippingCharges)

	fields := map[string]any{
		"customer_name": in.CustomerName, "customer_email": in.CustomerEmail, "customer_phone": in.CustomerPhone,
		"address_line1": in.AddressLine1, "address_line2": in.AddressLine2, "city": in.City, "state": in.State,
		"postcode": in.Postcode, "country": in.Country,
		"sub_total": subtotal, "total_discount": in.TotalDiscount, "total_tax": in.TotalTax,
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

// expireIfNeeded lazily flips a past-due sent/viewed quote to expired —
// there's no background job; expiry is just checked on every read.
func (s *QuoteService) expireIfNeeded(ctx context.Context, q *models.Quote) {
	if (q.Status == models.QuoteStatusSent || q.Status == models.QuoteStatusViewed) && time.Now().After(q.ExpiresAt) {
		q.Status = models.QuoteStatusExpired
		_ = s.quotes.UpdateStatusFields(ctx, q.ID, map[string]any{"status": models.QuoteStatusExpired})
	}
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

// ConvertToOrder turns an accepted quote into a real FlowPOS order via the
// tenant's stored api_key — see internal/flowpos/client.go for the caveat
// that the order-creation endpoint it calls is not yet a confirmed contract.
func (s *QuoteService) ConvertToOrder(ctx context.Context, tenantID, id uint64) (*models.Quote, error) {
	q, err := s.quotes.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if q.Status != models.QuoteStatusAccepted {
		return nil, fmt.Errorf("quote %s: only accepted quotes can be converted: %w", q.QuoteNumber, apperrors.ErrConflict)
	}
	installation, err := s.installations.GetByTenantID(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	items := make([]flowpos.CreateOrderItem, len(q.Items))
	for i, it := range q.Items {
		items[i] = flowpos.CreateOrderItem{Name: it.Name, Quantity: it.Quantity, Price: it.UnitPrice, Total: it.Total}
	}
	result, err := s.flowpos.CreateOrder(ctx, installation.APIKey, flowpos.CreateOrderInput{
		CustomerName:  q.CustomerName,
		CustomerEmail: q.CustomerEmail,
		CustomerPhone: q.CustomerPhone,
		Address: flowpos.CreateOrderAddress{
			Line1: q.AddressLine1, Line2: q.AddressLine2, City: q.City, State: q.State,
			Postcode: q.Postcode, Country: q.Country,
		},
		Items:           items,
		Note:            fmt.Sprintf("Converted from quote %s", q.QuoteNumber),
		TotalDiscount:   q.TotalDiscount,
		ShippingCharges: q.ShippingCharges,
	})
	if err != nil {
		return nil, fmt.Errorf("convert quote %s to order: %w", q.QuoteNumber, err)
	}

	now := time.Now()
	fields := map[string]any{
		"status": models.QuoteStatusConverted, "converted_at": now,
		"order_id": result.ID, "order_number": result.OrderNumber,
	}
	if err := s.quotes.UpdateFields(ctx, tenantID, id, fields); err != nil {
		return nil, err
	}
	return s.quotes.GetByID(ctx, tenantID, id)
}
