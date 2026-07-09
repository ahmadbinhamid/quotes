package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/FlowPosLtd/quotes/backend/internal/models"
)

type InstallationRepository interface {
	Create(ctx context.Context, in *models.Installation) error
	GetByTenantID(ctx context.Context, tenantID uint64) (*models.Installation, error)
	// UpdateFields updates only the given columns on the tenant's installation.
	UpdateFields(ctx context.Context, tenantID uint64, fields map[string]any) error
}

type installationRepository struct {
	db *gorm.DB
}

func NewInstallationRepository(db *gorm.DB) InstallationRepository {
	return &installationRepository{db: db}
}

func (r *installationRepository) Create(ctx context.Context, in *models.Installation) error {
	err := r.db.WithContext(ctx).Create(in).Error
	return translate(err, fmt.Sprintf("installation for tenant %d", in.TenantID))
}

func (r *installationRepository) GetByTenantID(ctx context.Context, tenantID uint64) (*models.Installation, error) {
	var in models.Installation
	err := r.db.WithContext(ctx).Where("tenant_id = ?", tenantID).First(&in).Error
	if err != nil {
		return nil, translate(err, fmt.Sprintf("installation for tenant %d", tenantID))
	}
	return &in, nil
}

func (r *installationRepository) UpdateFields(ctx context.Context, tenantID uint64, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	err := r.db.WithContext(ctx).
		Model(&models.Installation{}).
		Where("tenant_id = ?", tenantID).
		Updates(fields).Error
	return translate(err, fmt.Sprintf("installation for tenant %d", tenantID))
}
