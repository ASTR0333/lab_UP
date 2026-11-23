package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"
)

type category struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type chartPoint struct {
	Month int     `json:"month"`
	Value float64 `json:"value"`
}

func categoriesHandler(db *sql.DB) http.HandlerFunc {
	return catalogDataHandler(db, `SELECT ID, [name] FROM dbo.category ORDER BY [name], ID`, func(rows *sql.Rows) (category, error) {
		var value category
		err := rows.Scan(&value.ID, &value.Name)
		return value, err
	})
}

func chartHandler(db *sql.DB) http.HandlerFunc {
	return catalogDataHandler(db, `SELECT [Month], Proceed FROM dbo.chart ORDER BY [Month]`, func(rows *sql.Rows) (chartPoint, error) {
		var value chartPoint
		err := rows.Scan(&value.Month, &value.Value)
		return value, err
	})
}

func catalogDataHandler[T any](db *sql.DB, query string, scan func(*sql.Rows) (T, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		values, err := queryCatalogData(ctx, db, query, scan)
		if err != nil {
			log.Printf("Could not read catalog data: %v", err)
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Не удалось загрузить данные."})
			return
		}
		writeJSON(w, http.StatusOK, values)
	}
}

func queryCatalogData[T any](ctx context.Context, db *sql.DB, query string, scan func(*sql.Rows) (T, error)) ([]T, error) {
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := make([]T, 0)
	for rows.Next() {
		value, err := scan(rows)
		if err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	return values, rows.Err()
}
