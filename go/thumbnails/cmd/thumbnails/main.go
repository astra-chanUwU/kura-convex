package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/davidbyttow/govips/v2/vips"
	"kura/thumbnails/internal/httpapi"
	"kura/thumbnails/internal/store"
)

func main() {
	secret := os.Getenv("KURA_THUMB_SECRET")
	if secret == "" {
		log.Fatal("KURA_THUMB_SECRET is required")
	}
	objects, err := store.New(
		env("KURA_S3_ENDPOINT", "http://host.docker.internal:9000"),
		env("KURA_S3_BUCKET", "kura-images"),
		env("KURA_S3_ACCESS_KEY_ID", "kura"),
		env("KURA_S3_SECRET_ACCESS_KEY", "kura-secret-key"),
	)
	if err != nil {
		log.Fatal(err)
	}
	vips.LoggingSettings(nil, vips.LogLevelError)
	vips.Startup(nil)
	defer vips.Shutdown()

	addr := env("KURA_THUMB_ADDR", ":8080")
	server := &http.Server{
		Addr:              addr,
		Handler:           httpapi.New(objects, secret).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("thumbnail service listening on %s", addr)
	log.Fatal(server.ListenAndServe())
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
