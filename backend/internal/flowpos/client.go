// Package flowpos calls the core FlowPOS API on a tenant's behalf, using
// that tenant's installation api_key. Response envelope is always
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
	"sort"
	"time"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
)

// extractErrorMessage pulls the specific field error out of a Laravel-style
// body ({"message": "...", "errors": {"field": ...}}), since errors[field] is
// sometimes a string and sometimes an array depending on the endpoint. Falls
// back to the top-level message, then the raw body.
func extractErrorMessage(body []byte) string {
	var payload struct {
		Message string                     `json:"message"`
		Errors  map[string]json.RawMessage `json:"errors"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return string(body)
	}
	if len(payload.Errors) > 0 {
		fields := make([]string, 0, len(payload.Errors))
		for field := range payload.Errors {
			fields = append(fields, field)
		}
		sort.Strings(fields)
		for _, field := range fields {
			if msg, ok := firstErrorString(payload.Errors[field]); ok {
				return msg
			}
		}
	}
	if payload.Message != "" {
		return payload.Message
	}
	return string(body)
}

// firstErrorString unwraps a single errors[field] value as either a plain
// string or an array of strings (first element).
func firstErrorString(raw json.RawMessage) (string, bool) {
	var s string
	if err := json.Unmarshal(raw, &s); err == nil && s != "" {
		return s, true
	}
	var list []string
	if err := json.Unmarshal(raw, &list); err == nil && len(list) > 0 {
		return list[0], true
	}
	return "", false
}

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
	// 4xx = the caller's mistake to fix (validation, duplicate, etc.) — map to
	// ErrInvalidInput (400) with the real message instead of a blanket 500.
	if resp.StatusCode >= 400 && resp.StatusCode < 500 {
		return fmt.Errorf("%s: %w", extractErrorMessage(respBody), apperrors.ErrInvalidInput)
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

// ListProducts proxies GET /products (products.view) — a Laravel paginator
// under the "products" key. Returned as raw JSON since the app only displays
// it.
func (c *Client) ListProducts(ctx context.Context, apiKey string, params ListParams) (json.RawMessage, error) {
	var out struct {
		Products json.RawMessage `json:"products"`
	}
	if err := c.do(ctx, http.MethodGet, "/products"+params.query(), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("list products: %w", err)
	}
	return out.Products, nil
}

// GetProduct proxies GET /products/{slug} (products.view) — resolves a
// simple product's default variant, or lists variants when has_variants is
// true. Exact shape (esp. where variants live) not yet confirmed live.
func (c *Client) GetProduct(ctx context.Context, apiKey, slug string) (json.RawMessage, error) {
	var out json.RawMessage
	if err := c.do(ctx, http.MethodGet, "/products/"+url.PathEscape(slug), apiKey, nil, &out); err != nil {
		return nil, fmt.Errorf("get product %s: %w", slug, err)
	}
	// Some FlowPOS "show" endpoints nest the resource under a key; unwrap
	// {"product": {...}} if present, otherwise use the decoded data as-is.
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

// CreateOrderAddon: price is always resolved server-side from extension_id;
// only valid against a real catalog variant, never a custom line.
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

// FlowPOS's numeric "mode" values for StoreOrderRequest (from the tenant
// dashboard's own order-creation flow).
const (
	OrderModeCollection = 3
	OrderModeDelivery   = 5
)

// CreateOrderInput matches StoreOrderRequest's validated shape.
type CreateOrderInput struct {
	CustomerID *uint64               `json:"customer_id,omitempty"`
	Customer   *CreateOrderCustomer  `json:"customer,omitempty"`
	Address    *CreateOrderAddress   `json:"address,omitempty"`
	Items      []CreateOrderItem     `json:"items"`
	Note       string                `json:"note,omitempty"`
	// Mode: OrderModeCollection or OrderModeDelivery.
	Mode       int                   `json:"mode,omitempty"`
	LocationID *uint64               `json:"location_id,omitempty"`
}

// CreateOrderResult picks out only the fields the conversion flow needs.
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

// GeneratePaymentLink asks FlowPOS for a payment URL for an existing order —
// POST /orders/{id}/pay. Reachability via X-API-Key not yet confirmed; the
// response shape is parsed defensively since it isn't confirmed either.
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
