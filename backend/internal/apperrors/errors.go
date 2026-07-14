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
	// ErrUpstreamRejected is returned when FlowPOS itself rejects a
	// server-to-server call (401/403) — typically a permission this app was
	// never granted, or granted after the tenant's installation was already
	// created (permissions sync onto the api_key at install time; a later
	// change needs a reinstall).
	ErrUpstreamRejected = errors.New("flowpos rejected the request")
)
