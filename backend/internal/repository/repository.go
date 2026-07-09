// Package repository provides the data-access layer. Interfaces are defined
// here so services stay decoupled from GORM and can be tested with fakes.
package repository

import (
	"errors"
	"fmt"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
)

// translate maps driver/GORM errors onto the shared sentinel errors.
func translate(err error, entity string) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("%s: %w", entity, apperrors.ErrNotFound)
	}
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		return fmt.Errorf("%s: %w", entity, apperrors.ErrDuplicate)
	}
	return err
}
