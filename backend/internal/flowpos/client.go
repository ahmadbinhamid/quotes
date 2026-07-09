// Package flowpos is a minimal client for calling the core FlowPOS API on a
// tenant's behalf, authenticated with that tenant's installation api_key —
// the same server-to-server pattern (X-API-Key over FLOWPOS_API_URL) the
// ai-builder app uses for its own catalog/checkout calls.
package flowpos

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: 15 * time.Second}}
}

// CreateOrderInput mirrors the tenant dashboard's own order-creation payload
// shape, so a converted quote produces an order with the same fields.
type CreateOrderInput struct {
	CustomerName    string             `json:"customer_name"`
	CustomerEmail   string             `json:"customer_email"`
	CustomerPhone   string             `json:"customer_phone"`
	Address         CreateOrderAddress `json:"address"`
	Items           []CreateOrderItem  `json:"items"`
	Note            string             `json:"note"`
	TotalDiscount   float64            `json:"total_discount"`
	ShippingCharges float64            `json:"shipping_charges"`
}

type CreateOrderAddress struct {
	Line1    string `json:"line1"`
	Line2    string `json:"line2"`
	City     string `json:"city"`
	State    string `json:"state"`
	Postcode string `json:"postcode"`
	Country  string `json:"country"`
}

type CreateOrderItem struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Price    float64 `json:"price"`
	Total    float64 `json:"total"`
}

type CreateOrderResult struct {
	ID          string `json:"id"`
	OrderNumber string `json:"order_number"`
}

// CreateOrder asks FlowPOS to create a real order for this tenant from a
// converted quote.
//
// NOTE: there is no documented "apps create an order" endpoint yet — this
// speculatively POSTs to /orders using the same X-API-Key server-to-server
// auth ai-builder's basket checkout reuses. Adjust the path/shape once a
// real apps-facing order-creation contract exists.
func (c *Client) CreateOrder(ctx context.Context, apiKey string, in CreateOrderInput) (*CreateOrderResult, error) {
	body, err := json.Marshal(in)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/orders", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("create order: read response: %w", err)
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("create order: unexpected status %d: %s", resp.StatusCode, respBody)
	}

	var result CreateOrderResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("create order: decode response: %w", err)
	}
	return &result, nil
}
