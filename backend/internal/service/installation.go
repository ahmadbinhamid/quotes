// Package service holds the business logic between HTTP handlers and
// repositories. For this scaffold that is limited to the marketplace
// install/uninstall lifecycle — real quotes domain logic (line items,
// pricing, etc.) lands in later work.
package service

import (
	"context"
	"errors"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
	"github.com/FlowPosLtd/quotes/backend/internal/models"
	"github.com/FlowPosLtd/quotes/backend/internal/repository"
)

type InstallationService struct {
	installations repository.InstallationRepository
}

func NewInstallationService(installations repository.InstallationRepository) *InstallationService {
	return &InstallationService{installations: installations}
}

// Install provisions the tenant's installation on first install, or
// re-activates an existing one — idempotent, since FlowPOS may call it more
// than once for the same tenant (e.g. reinstalling after an uninstall).
func (s *InstallationService) Install(ctx context.Context, tenantID uint64, apiKey string) (*models.Installation, error) {
	existing, err := s.installations.GetByTenantID(ctx, tenantID)
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, err
	}
	if existing == nil {
		in := &models.Installation{
			TenantID:  tenantID,
			APIKey:    apiKey,
			Installed: true,
		}
		if err := s.installations.Create(ctx, in); err != nil {
			return nil, err
		}
		return in, nil
	}
	fields := map[string]any{"installed": true}
	if apiKey != "" {
		fields["api_key"] = apiKey
	}
	if err := s.installations.UpdateFields(ctx, tenantID, fields); err != nil {
		return nil, err
	}
	return s.installations.GetByTenantID(ctx, tenantID)
}

// Uninstall soft-disables the tenant's installation without deleting any
// data — Install re-activates it. A no-op if the tenant was never installed.
func (s *InstallationService) Uninstall(ctx context.Context, tenantID uint64) error {
	_, err := s.installations.GetByTenantID(ctx, tenantID)
	if errors.Is(err, apperrors.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return s.installations.UpdateFields(ctx, tenantID, map[string]any{"installed": false})
}

// GetByTenant returns the tenant's installation, or (nil, nil) when the
// tenant has never installed the app.
func (s *InstallationService) GetByTenant(ctx context.Context, tenantID uint64) (*models.Installation, error) {
	in, err := s.installations.GetByTenantID(ctx, tenantID)
	if errors.Is(err, apperrors.ErrNotFound) {
		return nil, nil
	}
	return in, err
}
