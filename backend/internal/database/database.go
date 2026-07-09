// Package database opens the GORM MySQL connection and keeps the schema up
// to date via AutoMigrate.
package database

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/FlowPosLtd/quotes/backend/internal/models"
)

// Open connects to MySQL. DATABASE_URL accepts both the plain go-sql-driver
// DSN (user:pass@tcp(host:3306)/db) and the mysql:// URL form.
func Open(databaseURL string) (*gorm.DB, error) {
	dsn, err := driverDSN(databaseURL)
	if err != nil {
		return nil, err
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	return db, nil
}

// AutoMigrate creates or updates the schema to match the model definitions.
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Installation{},
		&models.Quote{},
		&models.QuoteItem{},
		&models.QuoteSequence{},
	)
}

// driverDSN strips the optional mysql:// scheme and forces parseTime=true so
// TIMESTAMP columns scan into time.Time.
func driverDSN(databaseURL string) (string, error) {
	dsn := strings.TrimPrefix(databaseURL, "mysql://")

	base, rawQuery, _ := strings.Cut(dsn, "?")
	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		return "", fmt.Errorf("parse DATABASE_URL query: %w", err)
	}
	query.Set("parseTime", "true")
	return base + "?" + query.Encode(), nil
}
