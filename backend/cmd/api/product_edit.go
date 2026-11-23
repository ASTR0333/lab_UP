package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

const maxImageBytes = 2 << 20

type productInput struct {
	Name       string  `json:"name"`
	CategoryID int     `json:"categoryId"`
	Date       string  `json:"date"`
	Image      *string `json:"image"`
}

func saveProductHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "Ожидается JSON."})
			return
		}
		maxBodyBytes := int64(base64.StdEncoding.EncodedLen(maxImageBytes) + 4096)
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		var input productInput
		if err := decoder.Decode(&input); err != nil || decoder.Decode(new(any)) != io.EOF {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Проверьте поля формы и размер фотографии."})
			return
		}
		input.Name = strings.TrimSpace(input.Name)
		if input.Name == "" || len(utf16.Encode([]rune(input.Name))) > 30 || input.CategoryID < 1 || input.CategoryID > 2147483647 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Укажите название до 30 символов и выберите категорию."})
			return
		}
		if input.Date != "" {
			date, err := time.Parse(time.DateOnly, input.Date)
			if err != nil || date.Year() < 1 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Укажите корректную дату."})
				return
			}
		}
		var imageData []byte
		var imageType string
		if input.Image != nil && *input.Image != "" {
			var err error
			imageData, imageType, err = decodeImage(*input.Image)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Выберите PNG или JPEG до 2 МБ и 16 мегапикселей."})
				return
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
		defer cancel()
		args := []any{sql.Named("name", input.Name), sql.Named("category", input.CategoryID), sql.Named("date", input.Date),
			sql.Named("image", imageData), sql.Named("type", imageType)}
		query := `INSERT INTO dbo.product ([name], CategoryID, ProductDate, ImageData, ImageType)
			SELECT @name, ID, CONVERT(date, NULLIF(@date, ''), 23), @image, NULLIF(@type, '') FROM dbo.category WHERE ID = @category`
		status := http.StatusCreated
		if r.Method == http.MethodPut {
			id, ok := productID(w, r)
			if !ok {
				return
			}
			query = `UPDATE dbo.product SET [name] = @name, CategoryID = @category,
				ProductDate = CONVERT(date, NULLIF(@date, ''), 23),
				ImageData = CASE WHEN @replace = 1 THEN @image ELSE ImageData END,
				ImageType = CASE WHEN @replace = 1 THEN NULLIF(@type, '') ELSE ImageType END
				WHERE ID = @id AND EXISTS (SELECT 1 FROM dbo.category WHERE ID = @category)`
			args = append(args, sql.Named("id", id), sql.Named("replace", input.Image != nil))
			status = http.StatusNoContent
		}

		result, err := db.ExecContext(ctx, query, args...)
		finishMutation(w, result, err, status, "Товар или категория не найдены.")
	}
}

func decodeImage(value string) ([]byte, string, error) {
	metadata, encoded, ok := strings.Cut(value, ",")
	if !ok || (metadata != "data:image/png;base64" && metadata != "data:image/jpeg;base64") {
		return nil, "", errors.New("invalid image type")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(data) > maxImageBytes {
		return nil, "", errors.New("invalid image data")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 16_000_000 || metadata != "data:image/"+format+";base64" {
		return nil, "", errors.New("invalid image dimensions or format")
	}
	return data, "image/" + format, nil
}

func deleteProductHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := productID(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
		defer cancel()
		result, err := db.ExecContext(ctx, `DELETE FROM dbo.product WHERE ID = @id`, sql.Named("id", id))
		finishMutation(w, result, err, http.StatusNoContent, "Товар уже удалён или не найден.")
	}
}

func productID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil || id < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Некорректный ID товара."})
		return 0, false
	}
	return id, true
}

func finishMutation(w http.ResponseWriter, result sql.Result, err error, status int, missing string) {
	if err == nil {
		var count int64
		count, err = result.RowsAffected()
		if err == nil && count == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": missing})
			return
		}
	}
	if err != nil {
		log.Printf("Could not modify product: %v", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Не удалось изменить сведения о товаре."})
		return
	}
	w.WriteHeader(status)
}

func productImageHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := productID(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		var data []byte
		var contentType string
		err := db.QueryRowContext(ctx, `SELECT ImageData, ImageType FROM dbo.product WHERE ID = @id AND ImageData IS NOT NULL`, sql.Named("id", id)).Scan(&data, &contentType)
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(data)
	}
}
