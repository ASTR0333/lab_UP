package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	address := os.Getenv("DB_ADDRESS")
	database := os.Getenv("DB_NAME")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	if address == "" || database == "" || user == "" || password == "" {
		log.Fatal("DB_ADDRESS, DB_NAME, DB_USER and DB_PASSWORD are required")
	}

	options := url.Values{
		"database":               {database},
		"encrypt":                {"true"},
		"TrustServerCertificate": {"true"},
	}
	dsn := url.URL{
		Scheme:   "sqlserver",
		Host:     address,
		User:     url.UserPassword(user, password),
		RawQuery: options.Encode(),
	}
	db, err := sql.Open("sqlserver", dsn.String())
	if err != nil {
		log.Fatal("Could not configure the SQL Server connection")
	}
	defer db.Close()

	mux := http.NewServeMux()
	sessionToken := rand.Text()
	mux.HandleFunc("POST /api/connection", connectHandler(dsn, database, sessionToken))
	mux.HandleFunc("GET /api/products", productsHandler(db))
	mux.HandleFunc("POST /api/products", requireConnection(sessionToken, saveProductHandler(db)))
	mux.HandleFunc("PUT /api/products/{id}", requireConnection(sessionToken, saveProductHandler(db)))
	mux.HandleFunc("DELETE /api/products/{id}", requireConnection(sessionToken, deleteProductHandler(db)))
	mux.HandleFunc("GET /api/products/{id}/image", productImageHandler(db))
	mux.HandleFunc("GET /api/categories", categoriesHandler(db))
	mux.HandleFunc("GET /api/chart", chartHandler(db))
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if err := db.PingContext(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintln(w, `{"status":"database_unavailable"}`)
			return
		}
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	server := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("Listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
