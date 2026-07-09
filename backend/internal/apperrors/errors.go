// Package apperrors defines the sentinel errors shared across layers so
// handlers can map service/repository failures onto HTTP status codes.
package apperrors

import "errors"

var (
	// ErrNotFound is returned when the requested entity does not exist.
	ErrNotFound = errors.New("not found")
	// ErrDuplicate is returned when a unique constraint is violated.
	ErrDuplicate = errors.New("already exists")
	// ErrInvalidInput is returned when a request payload is malformed or fails
	// validation.
	ErrInvalidInput = errors.New("invalid input")
	// ErrConflict is returned when an action doesn't fit the entity's current
	// state (e.g. editing a quote that has already been sent).
	ErrConflict = errors.New("conflict")
)
