package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

// PublicQuoteHandler serves the customer-facing, unauthenticated endpoints
// reached via a quote's share link (/q/:token) — no tenant JWT, secured only
// by the opaque, unguessable token itself.
type PublicQuoteHandler struct {
	quotes *service.QuoteService
}

func NewPublicQuoteHandler(quotes *service.QuoteService) *PublicQuoteHandler {
	return &PublicQuoteHandler{quotes: quotes}
}

func (h *PublicQuoteHandler) Get(c *gin.Context) {
	q, err := h.quotes.GetPublic(c.Request.Context(), c.Param("token"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func (h *PublicQuoteHandler) Accept(c *gin.Context) {
	q, err := h.quotes.Accept(c.Request.Context(), c.Param("token"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func (h *PublicQuoteHandler) Decline(c *gin.Context) {
	q, err := h.quotes.Decline(c.Request.Context(), c.Param("token"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}
