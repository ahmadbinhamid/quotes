// Package flowpos is a minimal client for calling the core FlowPOS API on a
// tenant's behalf, authenticated with that tenant's installation api_key.
//
// There is no separate "apps API" — an app's X-API-Key is authenticated by
// the same SetActorMiddleware that resolves the tenant-dashboard's session
// user, and hits the exact same tenant-module routes/controllers (products,
// categories, customers, locations, orders), gated by whatever permissions
// this app was granted on install. Response envelope is always
// {"data": {...}, "status": true}.
package flowpos

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
)

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: 15 * time.Second}}
}

// envelope is the {"data": ..., "status": true} wrapper every endpoint below
// uses; do unmarshals the response body, verifies the HTTP status, and
// decodes envelope.Data into out (out may be nil to discard the body).
func (c *Client) do(ctx context.Context, method, path, apiKey string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-API-Key", apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("%s %s: read response: %w", method, path, err)
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("%s %s: %w: %s", method, path, apperrors.ErrUpstreamRejected, respBody)
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: unexpected status %d: %s", method, path, resp.StatusCode, respBody)
	}
	if out == nil {
		return nil
	}
	var env struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(respBody, &env); err != nil {
		return fmt.Errorf("%s %s: decode envelope: %w", method, path, err)
	}
	if len(env.Data) == 0 {
		return nil
	}
	return json.Unmarshal(env.Data, out)
}

// ListParams covers the search/limit query params the catalog list endpoints
// (products/categories/customers/locations) accept.
type ListParams struct {
	Search string
	Limit  int
}

func (p ListParams) query() string {
	q := url.Values{}
	if p.Search != "" {
		q.Set("search", p.Search)
	}
	if p.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", p.Limit))
	}
	if len(q) == 0 {
		return ""
	}
	return "?" + q.Encode()
}

// ListProducts proxies GET /products (products.view). The inner "products"
// value (a Laravel paginator) is returned as raw JSON rather than a typed
// struct — the app only needs to display/search it, not know its exact
// field-by-field shape, and that shape hasn't been confirmed against a live
// response yet.
func (c *Client) ListProducts(ctx context.Context, apiKey string, params ListParams) (json.RawMessage, error) {
	var out struct {
		Products json.RawMessage `json:"products"`
	}
	if err := c.do(ctx, http.MethodGet, "/products"+params.query(), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("list products: %w", err)
	}
	return out.Products, nil
}

// GetProduct proxies GET /products/{slug} (products.view) — the detail
// endpoint the tenant dashboard's own order flow calls to resolve a simple
// product's default variant, or to list variants for the picker to show
// when has_variants is true. Passed through as raw JSON for the same reason
// as ListProducts — the exact shape (in particular where the variant list
// lives) isn't confirmed against a live response with variants populated
// yet.
func (c *Client) GetProduct(ctx context.Context, apiKey, slug string) (json.RawMessage, error) {
	var out json.RawMessage
	if err := c.do(ctx, http.MethodGet, "/products/"+url.PathEscape(slug), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("get product %s: %w", slug, err)
	}
	// Some FlowPOS "show" endpoints nest the resource under a key (e.g.
	// {"customer": {...}} on customer create); others may return the object
	// directly. Unwrap a {"product": {...}} envelope if present, otherwise
	// use the decoded data as-is.
	var wrapped struct {
		Product json.RawMessage `json:"product"`
	}
	if err := json.Unmarshal(out, &wrapped); err == nil && len(wrapped.Product) > 0 {
		return wrapped.Product, nil
	}
	return out, nil
}

// ListCategories proxies GET /categories (categories.view).
func (c *Client) ListCategories(ctx context.Context, apiKey string, params ListParams) (json.RawMessage, error) {
	var out struct {
		Categories json.RawMessage `json:"categories"`
	}
	if err := c.do(ctx, http.MethodGet, "/categories"+params.query(), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}
	return out.Categories, nil
}

// ListCustomers proxies GET /customers (customers.view).
func (c *Client) ListCustomers(ctx context.Context, apiKey string, params ListParams) (json.RawMessage, error) {
	var out struct {
		Customers json.RawMessage `json:"customers"`
	}
	if err := c.do(ctx, http.MethodGet, "/customers"+params.query(), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("list customers: %w", err)
	}
	return out.Customers, nil
}

// CreateCustomerInput is the confirmed body shape for POST /customers.
type CreateCustomerInput struct {
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Phone *string `json:"phone,omitempty"`
}

// CreateCustomer proxies POST /customers (customers.create).
func (c *Client) CreateCustomer(ctx context.Context, apiKey string, in CreateCustomerInput) (json.RawMessage, error) {
	var out struct {
		Customer json.RawMessage `json:"customer"`
	}
	if err := c.do(ctx, http.MethodPost, "/customers", apiKey, in, &out); err != nil {
		return nil, fmt.Errorf("create customer: %w", err)
	}
	return out.Customer, nil
}

// ListLocations proxies GET /locations (locations.view). Unlike the other
// list endpoints this one isn't paginated server-side (a plain array).
func (c *Client) ListLocations(ctx context.Context, apiKey string, params ListParams) (json.RawMessage, error) {
	var out struct {
		Locations json.RawMessage `json:"locations"`
	}
	if err := c.do(ctx, http.MethodGet, "/locations"+params.query(), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("list locations: %w", err)
	}
	return out.Locations, nil
}

// CreateOrderCustomer is the nested customer object StoreOrderRequest reads
// (unvalidated server-side, but this is the shape OrderController actually
// looks for: $request->customer['name'] etc).
type CreateOrderCustomer struct {
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Phone *string `json:"phone"`
}

// CreateOrderAddress matches StoreOrderRequest's address.* validation rules.
type CreateOrderAddress struct {
	AddressLine1 string `json:"address_line_1"`
	AddressLine2 string `json:"address_line_2,omitempty"`
	City         string `json:"city"`
	State        string `json:"state,omitempty"`
	Postcode     string `json:"postcode"`
	Country      string `json:"country"`
}

// CreateOrderAddon matches AddonExtension's live-validation contract: only
// extension_id and quantity are accepted — price is always resolved
// server-side from the AddOn record, and addons are only valid against a
// real catalog variant (never a custom/no-variant_id line).
type CreateOrderAddon struct {
	ExtensionID uint64  `json:"extension_id"`
	Quantity    float64 `json:"quantity"`
}

type CreateOrderExtensionsData struct {
	Addons []CreateOrderAddon `json:"addons"`
}

// CreateOrderItem matches StoreOrderRequest's items.* validation rules: a
// catalog line references VariantID (optionally with ExtensionsData for
// addons); a custom line (no catalog product) omits it and supplies
// Name/Price instead. There is no "total" field — the server computes it.
type CreateOrderItem struct {
	VariantID      *uint64                     `json:"variant_id,omitempty"`
	Name           string                      `json:"name,omitempty"`
	Price          *float64                    `json:"price,omitempty"`
	Quantity       float64                     `json:"quantity"`
	DiscountAmount float64                     `json:"discount_amount,omitempty"`
	TaxAmount      float64                     `json:"tax_amount,omitempty"`
	ExtensionsData *CreateOrderExtensionsData  `json:"extensions_data,omitempty"`
}

// CreateOrderInput matches StoreOrderRequest's real validated shape — see
// backend README/plan notes for how this differs from what this client used
// to send (top-level customer_name/email/phone, address.line1/2, items with
// a "total" field — none of which StoreOrderRequest actually accepts).
type CreateOrderInput struct {
	CustomerID *uint64               `json:"customer_id,omitempty"`
	Customer   *CreateOrderCustomer  `json:"customer,omitempty"`
	Address    *CreateOrderAddress   `json:"address,omitempty"`
	Items      []CreateOrderItem     `json:"items"`
	Note       string                `json:"note,omitempty"`
	Mode       string                `json:"mode,omitempty"`
}

// CreateOrderResult only picks out the two fields the quote-conversion flow
// needs to store; unknown fields in the real (much larger) Order resource
// are ignored by json.Unmarshal.
type CreateOrderResult struct {
	ID          uint64 `json:"id"`
	OrderNumber string `json:"order_number"`
}

// CreateOrder asks FlowPOS to create a real order for this tenant from a
// converted quote — POST /orders (orders.create), the same endpoint the
// tenant dashboard's own order-creation flow uses.
func (c *Client) CreateOrder(ctx context.Context, apiKey string, in CreateOrderInput) (*CreateOrderResult, error) {
	var out struct {
		Order CreateOrderResult `json:"order"`
	}
	if err := c.do(ctx, http.MethodPost, "/orders", apiKey, in, &out); err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}
	return &out.Order, nil
}

// GeneratePaymentLink asks FlowPOS for a payment URL for an already-created
// order — POST /orders/{id}/pay, mirroring the tenant dashboard's own
// generatePaymentLink. Not directly confirmed reachable via X-API-Key (only
// POST /orders itself was confirmed) — verify with a live call. The response
// shape is defensively parsed the same way the dashboard's frontend does,
// since even that code doesn't commit to one exact key.
func (c *Client) GeneratePaymentLink(ctx context.Context, apiKey string, orderID uint64) (string, error) {
	var out map[string]any
	path := fmt.Sprintf("/orders/%d/pay", orderID)
	if err := c.do(ctx, http.MethodPost, path, apiKey, map[string]string{"type": "card"}, &out); err != nil {
		return "", fmt.Errorf("generate payment link: %w", err)
	}
	for _, key := range []string{"url", "payment_link", "link"} {
		if v, ok := out[key].(string); ok && v != "" {
			return v, nil
		}
	}
	if order, ok := out["order"].(map[string]any); ok {
		if payments, ok := order["payments"].([]any); ok && len(payments) > 0 {
			if p0, ok := payments[0].(map[string]any); ok {
				if v, ok := p0["url"].(string); ok && v != "" {
					return v, nil
				}
			}
		}
	}
	return "", fmt.Errorf("generate payment link: no url found in response")
}
