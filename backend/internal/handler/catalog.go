package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

// CatalogHandler serves the authenticated /api/v1/catalog/* routes that
// proxy FlowPOS's own product/category/customer/location endpoints using
// the tenant's installation api_key — backs the quote form's product picker
// and customer selector. Each list response is passed through as raw JSON
// (its exact field shape isn't committed to server-side); see
// service/catalog.go and flowpos/client.go.
type CatalogHandler struct {
	catalog *service.CatalogService
}

func NewCatalogHandler(catalog *service.CatalogService) *CatalogHandler {
	return &CatalogHandler{catalog: catalog}
}

func (h *CatalogHandler) Products(c *gin.Context) {
	data, err := h.catalog.ListProducts(c.Request.Context(), tenantID(c), c.Query("search"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"products": data})
}

func (h *CatalogHandler) Product(c *gin.Context) {
	data, err := h.catalog.GetProduct(c.Request.Context(), tenantID(c), c.Param("slug"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"product": data})
}

func (h *CatalogHandler) Categories(c *gin.Context) {
	data, err := h.catalog.ListCategories(c.Request.Context(), tenantID(c), c.Query("search"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": data})
}

func (h *CatalogHandler) Customers(c *gin.Context) {
	data, err := h.catalog.ListCustomers(c.Request.Context(), tenantID(c), c.Query("search"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"customers": data})
}

func (h *CatalogHandler) CreateCustomer(c *gin.Context) {
	var in struct {
		Name  string  `json:"name" binding:"required"`
		Email string  `json:"email" binding:"required"`
		Phone *string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	data, err := h.catalog.CreateCustomer(c.Request.Context(), tenantID(c), in.Name, in.Email, in.Phone)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"customer": data})
}

func (h *CatalogHandler) Locations(c *gin.Context) {
	data, err := h.catalog.ListLocations(c.Request.Context(), tenantID(c), c.Query("search"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"locations": data})
}
