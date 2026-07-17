// Package models defines the GORM entities; the schema is created and kept
// up to date via AutoMigrate at startup.
package models

import "time"

// Installation tracks a single tenant's install of this app. One row per
// tenant_id, created on first /install and never deleted — /uninstall just
// flips Installed back to false so re-installing is a cheap update.
type Installation struct {
	ID uint64 `gorm:"primaryKey" json:"id"`
	// TenantID is the FlowPOS tenant ID; each tenant has at most one
	// installation of this app, so it is unique.
	TenantID uint64 `gorm:"not null;uniqueIndex:uq_installation_tenant_id" json:"tenant_id"`
	// APIKey authenticates calls to the FlowPOS backend on this tenant's
	// behalf. Secret — never returned in JSON.
	APIKey string `gorm:"type:varchar(512);not null;default:''" json:"-"`
	// Installed reflects the FlowPOS marketplace install state: false after
	// an /uninstall call, back to true on re-install. No data is deleted
	// while false.
	Installed bool      `gorm:"not null;default:true" json:"installed"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Installation) TableName() string { return "installations" }

// QuoteStatus is the lifecycle state of a Quote. Transitions are one-way
// (see service.QuoteService): draft -> sent -> viewed -> accepted/declined,
// accepted -> converted, sent/viewed -> expired once past ExpiresAt, and
// sent/viewed -> superseded if staff clone it into a revision instead.
type QuoteStatus string

const (
	QuoteStatusDraft      QuoteStatus = "draft"
	QuoteStatusSent       QuoteStatus = "sent"
	QuoteStatusViewed     QuoteStatus = "viewed"
	QuoteStatusAccepted   QuoteStatus = "accepted"
	QuoteStatusDeclined   QuoteStatus = "declined"
	QuoteStatusExpired    QuoteStatus = "expired"
	QuoteStatusConverted  QuoteStatus = "converted"
	QuoteStatusSuperseded QuoteStatus = "superseded"
)

// Quote is a priced estimate a tenant sends a customer, shareable via a
// unique public link (ShareToken), that the customer can accept or decline
// and staff can then convert into a real FlowPOS order.
type Quote struct {
	ID          uint64      `gorm:"primaryKey" json:"id"`
	TenantID    uint64      `gorm:"not null;index:idx_quotes_tenant_id" json:"tenant_id"`
	QuoteNumber string      `gorm:"type:varchar(32);not null" json:"quote_number"`
	// ShareToken is the opaque, globally-unique token in the public link
	// (/q/:token) — generated on creation, never reused, never exposed to
	// other tenants.
	ShareToken string      `gorm:"type:varchar(64);not null;uniqueIndex:uq_quotes_share_token" json:"share_token"`
	Status     QuoteStatus `gorm:"type:varchar(20);not null;default:'draft'" json:"status"`

	// CustomerID is nil for a walk-in/manually-typed customer not yet in
	// FlowPOS; Name/Email/Phone below are always populated either way.
	CustomerID    *uint64 `json:"customer_id,omitempty"`
	CustomerName  string `gorm:"type:varchar(255);not null;default:''" json:"customer_name"`
	CustomerEmail string `gorm:"type:varchar(255);not null;default:''" json:"customer_email"`
	CustomerPhone string `gorm:"type:varchar(64);not null;default:''" json:"customer_phone"`

	AddressLine1 string `gorm:"type:varchar(255);not null;default:''" json:"address_line1"`
	AddressLine2 string `gorm:"type:varchar(255);not null;default:''" json:"address_line2"`
	City         string `gorm:"type:varchar(120);not null;default:''" json:"city"`
	State        string `gorm:"type:varchar(120);not null;default:''" json:"state"`
	Postcode     string `gorm:"type:varchar(32);not null;default:''" json:"postcode"`
	Country      string `gorm:"type:varchar(120);not null;default:''" json:"country"`

	Items []QuoteItem `gorm:"foreignKey:QuoteID;constraint:OnDelete:CASCADE" json:"items"`

	SubTotal        float64 `json:"sub_total"`
	TotalDiscount   float64 `json:"total_discount"`
	TotalTax        float64 `json:"total_tax"`
	ShippingCharges float64 `json:"shipping_charges"`
	Total           float64 `json:"total"`

	Notes string `gorm:"type:text" json:"notes"`

	// PreExpiryStatus is a snapshot of Status taken the moment a quote lapses
	// into expired (see service.QuoteService.expireIfNeeded) — the only way
	// Reopen can restore a quote to what it actually was (sent/viewed/
	// accepted) instead of guessing.
	PreExpiryStatus QuoteStatus `gorm:"type:varchar(20);not null;default:''" json:"-"`

	ExpiresAt   time.Time  `gorm:"not null" json:"expires_at"`
	SentAt      *time.Time `json:"sent_at,omitempty"`
	ViewedAt    *time.Time `json:"viewed_at,omitempty"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	DeclinedAt  *time.Time `json:"declined_at,omitempty"`
	ConvertedAt *time.Time `json:"converted_at,omitempty"`

	// OrderID/OrderNumber are populated once ConvertToOrder succeeds.
	OrderID     string `gorm:"type:varchar(64);not null;default:''" json:"order_id,omitempty"`
	OrderNumber string `gorm:"type:varchar(64);not null;default:''" json:"order_number,omitempty"`
	// PaymentLinkURL is cached from the last GeneratePaymentLink call so
	// staff can re-copy/re-send it without hitting FlowPOS again; refreshed
	// by the payment-link regenerate endpoint.
	PaymentLinkURL *string `gorm:"type:varchar(1024)" json:"payment_link_url,omitempty"`

	// RevisesQuoteID is set on a revision — the quote it was cloned from.
	RevisesQuoteID *uint64 `json:"revises_quote_id,omitempty"`
	// SupersededByQuoteID is set on the original once a revision of it
	// exists. Its status also moves to Superseded at the same time, which is
	// what actually blocks further accept/decline — this field only exists
	// so the UI can link straight to the newer quote.
	SupersededByQuoteID *uint64 `json:"superseded_by_quote_id,omitempty"`

	CreatedByUserID uint64 `json:"created_by_user_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Quote) TableName() string { return "quotes" }

// QuoteItem is a line item on a Quote — either typed directly by staff (no
// VariantID) or snapshotted from a picked product/variant at add-time.
type QuoteItem struct {
	ID          uint64           `gorm:"primaryKey" json:"id"`
	QuoteID     uint64           `gorm:"not null;index:idx_quote_items_quote_id" json:"quote_id"`
	VariantID   *uint64          `json:"variant_id,omitempty"`
	Name        string           `gorm:"type:varchar(255);not null" json:"name"`
	Description string           `gorm:"type:varchar(500);not null;default:''" json:"description"`
	Quantity    float64          `gorm:"not null;default:1" json:"quantity"`
	UnitPrice   float64          `gorm:"not null;default:0" json:"unit_price"`
	// TaxAmount is a per-unit VAT breakdown, informational only — not added
	// into Total. Always 0 for a custom (non-catalog) line.
	TaxAmount float64 `gorm:"not null;default:0" json:"tax_amount"`
	// Addons is a display snapshot — FlowPOS order creation only sends
	// extension_id/quantity and resolves price server-side.
	Addons    []QuoteItemAddon `gorm:"serializer:json" json:"addons,omitempty"`
	Total     float64          `gorm:"not null;default:0" json:"total"`
	SortOrder int              `gorm:"not null;default:0" json:"sort_order"`
}

// QuoteItemAddon is only meaningful when VariantID is set — FlowPOS rejects
// add-ons on custom lines. ExtensionID is the FlowPOS AddOn id.
type QuoteItemAddon struct {
	ExtensionID uint64  `json:"extension_id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Quantity    float64 `json:"quantity"`
}

func (QuoteItem) TableName() string { return "quote_items" }

// QuoteSequence backs per-tenant quote numbering (Q-0001, Q-0002, ...): a
// single-row counter per tenant, incremented atomically in
// repository.QuoteRepository.NextQuoteNumber.
type QuoteSequence struct {
	TenantID   uint64 `gorm:"primaryKey" json:"tenant_id"`
	NextNumber uint64 `gorm:"not null;default:1" json:"next_number"`
}

func (QuoteSequence) TableName() string { return "quote_sequences" }
