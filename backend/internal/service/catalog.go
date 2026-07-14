package service

import (
	"context"
	"encoding/json"

	"github.com/FlowPosLtd/quotes/backend/internal/flowpos"
	"github.com/FlowPosLtd/quotes/backend/internal/repository"
)

// CatalogService proxies read/create calls against the tenant's FlowPOS
// catalog (products/categories/customers/locations) using their stored
// installation api_key — the frontend never sees that key directly. Backs
// the quote form's product picker and customer selector.
type CatalogService struct {
	installations repository.InstallationRepository
	flowpos       *flowpos.Client
}

func NewCatalogService(installations repository.InstallationRepository, flowposClient *flowpos.Client) *CatalogService {
	return &CatalogService{installations: installations, flowpos: flowposClient}
}

func (s *CatalogService) apiKey(ctx context.Context, tenantID uint64) (string, error) {
	installation, err := s.installations.GetByTenantID(ctx, tenantID)
	if err != nil {
		return "", err
	}
	return installation.APIKey, nil
}

func (s *CatalogService) ListProducts(ctx context.Context, tenantID uint64, search string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.ListProducts(ctx, apiKey, flowpos.ListParams{Search: search, Limit: 50})
}

func (s *CatalogService) GetProduct(ctx context.Context, tenantID uint64, slug string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.GetProduct(ctx, apiKey, slug)
}

func (s *CatalogService) ListCategories(ctx context.Context, tenantID uint64, search string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.ListCategories(ctx, apiKey, flowpos.ListParams{Search: search, Limit: 100})
}

func (s *CatalogService) ListCustomers(ctx context.Context, tenantID uint64, search string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.ListCustomers(ctx, apiKey, flowpos.ListParams{Search: search, Limit: 50})
}

func (s *CatalogService) CreateCustomer(ctx context.Context, tenantID uint64, name, email string, phone *string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.CreateCustomer(ctx, apiKey, flowpos.CreateCustomerInput{Name: name, Email: email, Phone: phone})
}

func (s *CatalogService) ListLocations(ctx context.Context, tenantID uint64, search string) (json.RawMessage, error) {
	apiKey, err := s.apiKey(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.flowpos.ListLocations(ctx, apiKey, flowpos.ListParams{Search: search})
}
