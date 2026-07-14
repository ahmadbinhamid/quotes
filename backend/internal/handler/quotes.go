package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/FlowPosLtd/quotes/backend/internal/repository"
	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

// QuoteHandler serves the authenticated /api/v1/quotes routes used by staff
// in the tenant dashboard.
type QuoteHandler struct {
	quotes *service.QuoteService
}

func NewQuoteHandler(quotes *service.QuoteService) *QuoteHandler {
	return &QuoteHandler{quotes: quotes}
}

func (h *QuoteHandler) Create(c *gin.Context) {
	var in service.QuoteInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	claims := claimsFrom(c)
	q, err := h.quotes.Create(c.Request.Context(), claims.TenantID, claims.UserID, in)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"quote": q})
}

func (h *QuoteHandler) List(c *gin.Context) {
	filter := repository.QuoteFilter{Status: c.Query("status")}
	if limit, err := strconv.Atoi(c.Query("limit")); err == nil {
		filter.Limit = limit
	}
	if offset, err := strconv.Atoi(c.Query("offset")); err == nil {
		filter.Offset = offset
	}
	quotes, total, err := h.quotes.List(c.Request.Context(), tenantID(c), filter)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quotes": quotes, "total": total})
}

func (h *QuoteHandler) Get(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	q, err := h.quotes.Get(c.Request.Context(), tenantID(c), id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func (h *QuoteHandler) Update(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	var in service.QuoteInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	q, err := h.quotes.Update(c.Request.Context(), tenantID(c), id, in)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func (h *QuoteHandler) Delete(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	if err := h.quotes.Delete(c.Request.Context(), tenantID(c), id); err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *QuoteHandler) Send(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	q, err := h.quotes.Send(c.Request.Context(), tenantID(c), id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func (h *QuoteHandler) Convert(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	q, err := h.quotes.ConvertToOrder(c.Request.Context(), tenantID(c), id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

// RegeneratePaymentLink re-requests a payment link for a converted quote's
// order — used when conversion-time generation failed, or to refresh a
// stale link before re-sending it to the customer.
func (h *QuoteHandler) RegeneratePaymentLink(c *gin.Context) {
	id, ok := quoteIDParam(c)
	if !ok {
		return
	}
	q, err := h.quotes.GeneratePaymentLink(c.Request.Context(), tenantID(c), id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"quote": q})
}

func quoteIDParam(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quote id"})
		return 0, false
	}
	return id, true
}
