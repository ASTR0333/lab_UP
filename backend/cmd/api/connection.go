package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"mime"
	"net/http"
	"net/url"
	"time"
)

type connectionDetails struct {
	Address  string `json:"address"`
	Database string `json:"database"`
	User     string `json:"user"`
}

func connectHandler(configuredDSN url.URL, database, sessionToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaType != "application/json" {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var input struct {
			connectionDetails
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Password == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if input.Address != configuredDSN.Host || input.Database != database || input.User != configuredDSN.User.Username() {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Open a separate connection to verify the submitted password against SQL Server.
		dsn := configuredDSN
		dsn.User = url.UserPassword(input.User, input.Password)
		db, err := sql.Open("sqlserver", dsn.String())
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		defer db.Close()

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name: "fasol_connection", Value: sessionToken, Path: "/api/", HttpOnly: true,
			Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}

func requireConnection(token string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("fasol_connection")
		if err != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(token)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Подключитесь к БД заново."})
			return
		}
		next(w, r)
	}
}
