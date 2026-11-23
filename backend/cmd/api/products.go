package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type product struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Category   string `json:"category"`
	CategoryID int    `json:"categoryId"`
	Date       string `json:"date"`
	ImageURL   string `json:"imageUrl,omitempty"`
}

func productsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		products, err := listProducts(ctx, db)
		if err != nil {
			log.Printf("Could not list products: %v", err)
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "products_unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, products)
	}
}

func listProducts(ctx context.Context, db *sql.DB) ([]product, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT p.ID, p.[name], c.[name], c.ID, COALESCE(CONVERT(char(10), p.ProductDate, 23), ''),
		       CAST(CASE WHEN p.ImageData IS NULL THEN 0 ELSE 1 END AS bit)
		FROM dbo.product AS p JOIN dbo.category AS c ON p.CategoryID = c.ID ORDER BY p.ID`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]product, 0)
	for rows.Next() {
		var item product
		var hasImage bool
		if err := rows.Scan(&item.ID, &item.Name, &item.Category, &item.CategoryID, &item.Date, &hasImage); err != nil {
			return nil, err
		}
		if hasImage {
			item.ImageURL = fmt.Sprintf("/api/products/%d/image", item.ID)
		}
		products = append(products, item)
	}
	return products, rows.Err()
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
