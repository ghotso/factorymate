package connection

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	pendingBroadcastKeyPrefix = "connection.pending_broadcast."
	pendingBroadcastTTL       = 15 * time.Minute
)

type pendingBroadcastPayload struct {
	Old       Details `json:"old"`
	New       Details `json:"new"`
	CreatedAt string  `json:"createdAt"`
}

func pendingBroadcastKey(adminUserID int64) string {
	return pendingBroadcastKeyPrefix + fmt.Sprintf("%d", adminUserID)
}

// SavePendingBroadcast stores a pending broadcast decision for Discord follow-up buttons.
func (s *Service) SavePendingBroadcast(ctx context.Context, adminUserID int64, old, new Details) error {
	payload := pendingBroadcastPayload{
		Old:       old,
		New:       new,
		CreatedAt: s.Now().UTC().Format(time.RFC3339),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal pending broadcast: %w", err)
	}
	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO app_setting_kv (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		pendingBroadcastKey(adminUserID), string(raw),
	); err != nil {
		return fmt.Errorf("save pending broadcast: %w", err)
	}
	return nil
}

// LoadPendingBroadcast returns stored old/new details if present and not expired.
func (s *Service) LoadPendingBroadcast(ctx context.Context, adminUserID int64) (old, new Details, ok bool, err error) {
	var raw string
	err = s.DB.QueryRowContext(ctx, `
		SELECT value FROM app_setting_kv WHERE key = ?`, pendingBroadcastKey(adminUserID),
	).Scan(&raw)
	if err == sql.ErrNoRows || strings.TrimSpace(raw) == "" {
		return Details{}, Details{}, false, nil
	}
	if err != nil {
		return Details{}, Details{}, false, fmt.Errorf("load pending broadcast: %w", err)
	}
	var payload pendingBroadcastPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return Details{}, Details{}, false, fmt.Errorf("parse pending broadcast: %w", err)
	}
	if payload.CreatedAt != "" {
		created, parseErr := time.Parse(time.RFC3339, payload.CreatedAt)
		if parseErr == nil && s.Now().Sub(created) > pendingBroadcastTTL {
			_ = s.DeletePendingBroadcast(ctx, adminUserID)
			return Details{}, Details{}, false, nil
		}
	}
	return payload.Old, payload.New, true, nil
}

// DeletePendingBroadcast removes a stored pending broadcast.
func (s *Service) DeletePendingBroadcast(ctx context.Context, adminUserID int64) error {
	_, err := s.DB.ExecContext(ctx, `
		DELETE FROM app_setting_kv WHERE key = ?`, pendingBroadcastKey(adminUserID),
	)
	if err != nil {
		return fmt.Errorf("delete pending broadcast: %w", err)
	}
	return nil
}
