package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

// MeHandler exposes the caller's installation state, used by the frontend to
// confirm the JWT round-trip works and the tenant is installed.
type MeHandler struct {
	installations *service.InstallationService
}

func NewMeHandler(installations *service.InstallationService) *MeHandler {
	return &MeHandler{installations: installations}
}

// Me returns the caller's installation (null if the tenant never installed
// the app — shouldn't normally happen since the dashboard only embeds this
// app post-install, but kept defensive).
func (h *MeHandler) Me(c *gin.Context) {
	installation, err := h.installations.GetByTenant(c.Request.Context(), tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"installation": installation})
}
