// Package handler exposes the REST endpoints, delegating to the service
// layer and mapping domain errors onto HTTP status codes.
package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/FlowPosLtd/quotes/backend/internal/apperrors"
	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

// NewRouter builds the Gin engine with all routes registered.
func NewRouter(installations *service.InstallationService, quotes *service.QuoteService, catalog *service.CatalogService, jwtSecret string, allowDevTokens bool, signingSecret string) *gin.Engine {
	lifecycleHandler := NewLifecycleHandler(installations)
	meHandler := NewMeHandler(installations)
	devHandler := NewDevTokenHandler(jwtSecret)
	quoteHandler := NewQuoteHandler(quotes)
	publicQuoteHandler := NewPublicQuoteHandler(quotes)
	catalogHandler := NewCatalogHandler(catalog)

	router := gin.Default()
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Marketplace lifecycle: FlowPOS calls these directly (no tenant JWT),
	// signing each request with this app's signing secret. Mounted at the
	// public root, not under /api, per the marketplace listing contract.
	verifySignature := signatureMiddleware(signingSecret)
	router.POST("/install", verifySignature, lifecycleHandler.Install)
	router.POST("/uninstall", verifySignature, lifecycleHandler.Uninstall)
	router.POST("/webhooks", verifySignature, lifecycleHandler.Webhook)

	v1 := router.Group("/api/v1")

	// --- Public within /api/v1 (no bearer token) ---
	// Dev-only: mint a JWT for local testing (the real token is delivered by
	// the tenant dashboard, either via the apps-sdk postMessage handshake or
	// the legacy ?token= query param). Disabled when JWT_DEV_TOKENS=false.
	if allowDevTokens {
		v1.POST("/dev/token", devHandler.Mint)
	}

	// --- Protected: everything else requires a valid JWT ---
	p := v1.Group("")
	p.Use(authMiddleware(jwtSecret))

	// Identity + installation state (null installation ⇒ shouldn't happen in
	// practice, since the dashboard only embeds this app post-install).
	p.GET("/me", meHandler.Me)

	// Quote CRUD + lifecycle, staff-side (authenticated).
	q := p.Group("/quotes")
	q.POST("", quoteHandler.Create)
	q.GET("", quoteHandler.List)
	q.GET("/:id", quoteHandler.Get)
	q.PATCH("/:id", quoteHandler.Update)
	q.DELETE("/:id", quoteHandler.Delete)
	q.POST("/:id/send", quoteHandler.Send)
	q.POST("/:id/reopen", quoteHandler.Reopen)
	q.POST("/:id/revise", quoteHandler.Revise)
	q.POST("/:id/convert", quoteHandler.Convert)
	q.POST("/:id/payment-link", quoteHandler.RegeneratePaymentLink)

	// Catalog proxy — the quote form's product picker and customer selector
	// call these instead of the tenant's raw FlowPOS api_key (which never
	// leaves the backend). See service/catalog.go.
	catalogGroup := p.Group("/catalog")
	catalogGroup.GET("/products", catalogHandler.Products)
	catalogGroup.GET("/products/:slug", catalogHandler.Product)
	catalogGroup.GET("/categories", catalogHandler.Categories)
	catalogGroup.GET("/customers", catalogHandler.Customers)
	catalogGroup.POST("/customers", catalogHandler.CreateCustomer)
	catalogGroup.GET("/locations", catalogHandler.Locations)

	// Customer-facing share link (/q/:token in the frontend) — no tenant
	// JWT, secured only by the opaque token. Mounted under /api/public so
	// nginx's existing `location /api/` proxy covers it with no config
	// changes.
	public := router.Group("/api/public/quotes")
	public.GET("/:token", publicQuoteHandler.Get)
	public.POST("/:token/accept", publicQuoteHandler.Accept)
	public.POST("/:token/decline", publicQuoteHandler.Decline)

	return router
}

// fail translates service errors into HTTP responses.
func fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, apperrors.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, apperrors.ErrInvalidInput):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, apperrors.ErrDuplicate), errors.Is(err, apperrors.ErrConflict):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, apperrors.ErrUpstreamRejected):
		// FlowPOS itself rejected the call — almost always a permission
		// this app's api_key doesn't have (not a bug in this service).
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		_ = c.Error(err)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		_ = c.Error(err)
	}
}
