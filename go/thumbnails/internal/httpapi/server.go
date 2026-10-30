package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"kura/thumbnails/internal/encode"
	"kura/thumbnails/internal/key"
	"kura/thumbnails/internal/store"
)

const maxThumbBytes = 2 * 1024 * 1024

type Server struct {
	store  *store.Store
	secret string
	slots  chan struct{}
}

func New(objects *store.Store, secret string) *Server {
	return &Server{store: objects, secret: secret, slots: make(chan struct{}, 4)}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /v1/supported", s.authed(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string][]string{
			"images": {"gif", "jpg", "png", "webp"},
			"videos": {"mov", "mp4", "webm"},
		})
	}))
	mux.HandleFunc("POST /v1/thumbnails/batch", s.authed(s.batch))
	return mux
}

type job struct {
	StorageKey string `json:"storageKey"`
	Animate    bool   `json:"animate"`
	Force      bool   `json:"force"`
}

type made struct {
	StorageKey string `json:"storageKey"`
	ThumbKey   string `json:"thumbKey"`
	ByteSize   int64  `json:"byteSize"`
}

type failed struct {
	StorageKey string `json:"storageKey"`
	Message    string `json:"message"`
}

func (s *Server) batch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StorageKeys []string `json:"storageKeys"`
		Animate     bool     `json:"animate"`
		Force       bool     `json:"force"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "The thumbnail request was not valid.")
		return
	}
	if len(body.StorageKeys) == 0 || len(body.StorageKeys) > 20 {
		writeError(w, http.StatusBadRequest, "Send between 1 and 20 storage keys.")
		return
	}
	ok := make([]made, 0, len(body.StorageKeys))
	bad := make([]failed, 0)
	var mu sync.Mutex
	var group sync.WaitGroup
	for _, storageKey := range body.StorageKeys {
		group.Add(1)
		go func(storageKey string) {
			defer group.Done()
			item, err := s.make(r.Context(), job{StorageKey: storageKey, Animate: body.Animate, Force: body.Force})
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				status := http.StatusInternalServerError
				var httpErr *statusError
				if errors.As(err, &httpErr) {
					status = httpErr.status
				}
				message := "The thumbnail could not be made."
				if status < 500 {
					message = err.Error()
				}
				log.Printf("thumb %s: %v", storageKey, err)
				bad = append(bad, failed{StorageKey: storageKey, Message: message})
				return
			}
			ok = append(ok, item)
		}(storageKey)
	}
	group.Wait()
	writeJSON(w, http.StatusOK, map[string]any{"ok": ok, "failed": bad})
}

func (s *Server) make(ctx context.Context, job job) (made, error) {
	thumbKey, ext, err := key.Parse(job.StorageKey)
	if err != nil {
		return made{}, statusf(http.StatusBadRequest, "That storage key is not a picture we signed.")
	}
	if !job.Force {
		size, exists, err := s.store.Size(ctx, thumbKey)
		if err != nil {
			return made{}, err
		}
		if exists && size > 0 && size <= maxThumbBytes {
			return made{StorageKey: job.StorageKey, ThumbKey: thumbKey, ByteSize: size}, nil
		}
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	case <-ctx.Done():
		return made{}, ctx.Err()
	}
	file, cleanup, err := s.store.Download(ctx, job.StorageKey)
	if err != nil {
		return made{}, err
	}
	defer cleanup()
	started := time.Now()
	encoded, err := encode.Thumbnail(ctx, file, ext, job.Animate && key.Image(ext))
	if err != nil {
		return made{}, err
	}
	if len(encoded) == 0 || len(encoded) > maxThumbBytes {
		return made{}, fmtError("thumbnail is empty or over 2 MB")
	}
	if err := s.store.Upload(ctx, thumbKey, encoded); err != nil {
		return made{}, err
	}
	log.Printf("wrote %s in %s (%d bytes)", thumbKey, time.Since(started).Round(time.Millisecond), len(encoded))
	return made{StorageKey: job.StorageKey, ThumbKey: thumbKey, ByteSize: int64(len(encoded))}, nil
}

func (s *Server) authed(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || subtle.ConstantTimeCompare([]byte(token), []byte(s.secret)) != 1 {
			writeError(w, http.StatusUnauthorized, "The thumbnail service refused the request.")
			return
		}
		next(w, r)
	}
}

type statusError struct {
	status int
	error  string
}

func (e *statusError) Error() string { return e.error }

func statusf(status int, message string) error {
	return &statusError{status: status, error: message}
}

func fmtError(message string) error { return errors.New(message) }

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
