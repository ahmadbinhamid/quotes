package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
	"github.com/FlowPosLtd/quotes/backend/internal/models"
)

// QuoteFilter narrows QuoteRepository.List. Limit is clamped to a sane range
// by the implementation.
type QuoteFilter struct {
	Status string
	// ExcludeExpired drops expired and superseded quotes from the result —
	// used by the default ("active") list view, which shows everything still
	// actionable rather than one exact status match. Ignored if Status is
	// also set.
	ExcludeExpired bool
	Search         string
	Limit          int
	Offset         int
}

type QuoteRepository interface {
	Create(ctx context.Context, q *models.Quote) error
	GetByID(ctx context.Context, tenantID, id uint64) (*models.Quote, error)
	// GetByShareToken looks up a quote by its public link token, with no
	// tenant scoping — the token itself is the only credential a customer has.
	GetByShareToken(ctx context.Context, token string) (*models.Quote, error)
	List(ctx context.Context, tenantID uint64, filter QuoteFilter) ([]models.Quote, int64, error)
	// UpdateFields is tenant-scoped, for staff-initiated changes.
	UpdateFields(ctx context.Context, tenantID, id uint64, fields map[string]any) error
	// TryTransitionStatus atomically moves a quote from `from` to `to`,
	// succeeding only if its status still matches `from` at the moment of the
	// write — the guard against two concurrent callers (e.g. two convert
	// clicks) both thinking they're the one making the transition.
	TryTransitionStatus(ctx context.Context, tenantID, id uint64, from, to models.QuoteStatus) (bool, error)
	// UpdateStatusFields is not tenant-scoped, for lifecycle transitions
	// reached via the public share-token endpoints (view/accept/decline),
	// where the caller has already resolved the quote by token.
	UpdateStatusFields(ctx context.Context, id uint64, fields map[string]any) error
	ReplaceItems(ctx context.Context, quoteID uint64, items []models.QuoteItem) error
	Delete(ctx context.Context, tenantID, id uint64) error
	// NextQuoteNumber atomically increments and returns the tenant's quote
	// counter, starting at 1.
	NextQuoteNumber(ctx context.Context, tenantID uint64) (uint64, error)
}

type quoteRepository struct {
	db *gorm.DB
}

func NewQuoteRepository(db *gorm.DB) QuoteRepository {
	return &quoteRepository{db: db}
}

func (r *quoteRepository) Create(ctx context.Context, q *models.Quote) error {
	err := r.db.WithContext(ctx).Create(q).Error
	return translate(err, fmt.Sprintf("quote %s", q.QuoteNumber))
}

func (r *quoteRepository) GetByID(ctx context.Context, tenantID, id uint64) (*models.Quote, error) {
	var q models.Quote
	err := r.db.WithContext(ctx).Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("tenant_id = ? AND id = ?", tenantID, id).First(&q).Error
	if err != nil {
		return nil, translate(err, fmt.Sprintf("quote %d", id))
	}
	return &q, nil
}

func (r *quoteRepository) GetByShareToken(ctx context.Context, token string) (*models.Quote, error) {
	var q models.Quote
	err := r.db.WithContext(ctx).Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("share_token = ?", token).First(&q).Error
	if err != nil {
		return nil, translate(err, "quote")
	}
	return &q, nil
}

func (r *quoteRepository) List(ctx context.Context, tenantID uint64, filter QuoteFilter) ([]models.Quote, int64, error) {
	base := r.db.WithContext(ctx).Model(&models.Quote{}).Where("tenant_id = ?", tenantID)
	if filter.Status != "" {
		base = base.Where("status = ?", filter.Status)
	} else if filter.ExcludeExpired {
		// Superseded quotes are the same kind of dead end as expired ones —
		// whatever replaced them already shows up in this same active view.
		base = base.Where("status NOT IN (?, ?)", models.QuoteStatusExpired, models.QuoteStatusSuperseded)
	}
	if filter.Search != "" {
		like := "%" + filter.Search + "%"
		base = base.Where(
			"quote_number LIKE ? OR customer_name LIKE ? OR order_number LIKE ? OR order_id LIKE ?",
			like, like, like, like,
		)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var quotes []models.Quote
	err := base.Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Order("id DESC").Limit(limit).Offset(filter.Offset).Find(&quotes).Error
	if err != nil {
		return nil, 0, err
	}
	return quotes, total, nil
}

func (r *quoteRepository) UpdateFields(ctx context.Context, tenantID, id uint64, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	res := r.db.WithContext(ctx).Model(&models.Quote{}).
		Where("tenant_id = ? AND id = ?", tenantID, id).
		Updates(fields)
	if res.Error != nil {
		return translate(res.Error, fmt.Sprintf("quote %d", id))
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("quote %d: %w", id, apperrors.ErrNotFound)
	}
	return nil
}

func (r *quoteRepository) TryTransitionStatus(ctx context.Context, tenantID, id uint64, from, to models.QuoteStatus) (bool, error) {
	res := r.db.WithContext(ctx).Model(&models.Quote{}).
		Where("tenant_id = ? AND id = ? AND status = ?", tenantID, id, from).
		Update("status", to)
	if res.Error != nil {
		return false, translate(res.Error, fmt.Sprintf("quote %d", id))
	}
	return res.RowsAffected > 0, nil
}

func (r *quoteRepository) UpdateStatusFields(ctx context.Context, id uint64, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	err := r.db.WithContext(ctx).Model(&models.Quote{}).Where("id = ?", id).Updates(fields).Error
	return translate(err, fmt.Sprintf("quote %d", id))
}

// ReplaceItems swaps a quote's line items wholesale — simpler and safer than
// diffing, and fine given quotes are only editable while still a draft.
func (r *quoteRepository) ReplaceItems(ctx context.Context, quoteID uint64, items []models.QuoteItem) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("quote_id = ?", quoteID).Delete(&models.QuoteItem{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		for i := range items {
			items[i].ID = 0
			items[i].QuoteID = quoteID
		}
		return tx.Create(&items).Error
	})
}

func (r *quoteRepository) Delete(ctx context.Context, tenantID, id uint64) error {
	res := r.db.WithContext(ctx).Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&models.Quote{})
	if res.Error != nil {
		return translate(res.Error, fmt.Sprintf("quote %d", id))
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("quote %d: %w", id, apperrors.ErrNotFound)
	}
	return nil
}

// NextQuoteNumber uses the standard MySQL upsert-and-increment pattern: the
// UPDATE (folded into the INSERT via ON DUPLICATE KEY) holds a row lock for
// the rest of the transaction, so concurrent callers for the same tenant
// serialize instead of racing to the same number.
func (r *quoteRepository) NextQuoteNumber(ctx context.Context, tenantID uint64) (uint64, error) {
	var next uint64
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(
			`INSERT INTO quote_sequences (tenant_id, next_number) VALUES (?, 2)
			 ON DUPLICATE KEY UPDATE next_number = next_number + 1`,
			tenantID,
		).Error; err != nil {
			return err
		}
		return tx.Raw(`SELECT next_number - 1 FROM quote_sequences WHERE tenant_id = ?`, tenantID).Scan(&next).Error
	})
	return next, err
}
