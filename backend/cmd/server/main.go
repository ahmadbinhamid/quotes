package main

import (
	"log"
	"os"

	"github.com/FlowPosLtd/quotes/backend/internal/database"
	"github.com/FlowPosLtd/quotes/backend/internal/flowpos"
	"github.com/FlowPosLtd/quotes/backend/internal/handler"
	"github.com/FlowPosLtd/quotes/backend/internal/repository"
	"github.com/FlowPosLtd/quotes/backend/internal/service"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required, e.g. mysql://user:pass@tcp(localhost:3306)/quotes")
	}

	db, err := database.Open(dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	installationRepo := repository.NewInstallationRepository(db)
	installationService := service.NewInstallationService(installationRepo)

	flowposAPIURL := os.Getenv("FLOWPOS_API_URL")
	if flowposAPIURL == "" {
		flowposAPIURL = "https://api.flowpos.dev/v1"
	}
	flowposClient := flowpos.NewClient(flowposAPIURL)

	quoteRepo := repository.NewQuoteRepository(db)
	quoteService := service.NewQuoteService(quoteRepo, installationRepo, flowposClient)
	catalogService := service.NewCatalogService(installationRepo, flowposClient)

	// JWT auth: the main FlowPOS system signs tokens with JWT_SECRET; this
	// microservice validates them (claims: tenant_id, user_id, user_email).
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-insecure-secret-change-me"
		log.Printf("WARNING: JWT_SECRET not set — using an insecure dev secret")
	}
	// Dev token minting is off unless explicitly enabled (never enable in prod).
	allowDevTokens := os.Getenv("JWT_DEV_TOKENS") == "true"

	// Signing secret FlowPOS uses to sign /install, /uninstall and /webhooks
	// calls to this app (configured alongside this app's marketplace listing).
	signingSecret := os.Getenv("FLOWPOS_SIGNING_SECRET")
	if signingSecret == "" {
		signingSecret = "dev-insecure-signing-secret-change-me"
		log.Printf("WARNING: FLOWPOS_SIGNING_SECRET not set — using an insecure dev secret")
	}

	router := handler.NewRouter(installationService, quoteService, catalogService, jwtSecret, allowDevTokens, signingSecret)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	if err := router.Run(addr); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
