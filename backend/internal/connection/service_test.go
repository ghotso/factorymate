package connection_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"factorymate/internal/auth"
	"factorymate/internal/connection"
	"factorymate/internal/db"
	"factorymate/internal/notify"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	database, err := db.Open(path)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return database
}

func TestRedactForLog(t *testing.T) {
	password := "hunter2"
	raw := `{"game_password":"` + password + `"}`
	redacted := connection.RedactForLog(raw)
	if strings.Contains(redacted, password) {
		t.Fatalf("redacted still contains password: %s", redacted)
	}
	plain := "Password: hunter2"
	redactedPlain := connection.RedactForLog(plain)
	if strings.Contains(redactedPlain, "hunter2") {
		t.Fatalf("redacted plain still contains password: %s", redactedPlain)
	}
}

func TestSetBroadcastsOnlyWhenOptIn(t *testing.T) {
	t.Chdir("../..")
	ctx := context.Background()
	database := openTestDB(t)
	defer database.Close()
	if err := db.Init(ctx, database, db.SeedConfig{}); err != nil {
		t.Fatalf("init: %v", err)
	}

	mock := notify.NewMockDiscordSession()
	svc := connection.NewService(database, notify.NewDiscordProvider(mock))

	authSvc := auth.NewService(database)
	admin, err := authSvc.CreateUser(ctx, "admin1", "password123", auth.RoleAdmin)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}

	input := connection.UpdateInput{
		GameHost:     strPtr("play.example.com"),
		GamePort:     intPtr(7777),
		GamePassword: strPtr("secretpass"),
	}
	_, err = svc.Set(ctx, input, admin.ID)
	if err != nil {
		t.Fatalf("set: %v", err)
	}

	_, err = authSvc.CreateUser(ctx, "viewer1", "password123", auth.RoleViewer)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	_, err = database.ExecContext(ctx, `
		UPDATE users SET external_platform = 'discord', external_user_id = 'discord-1', status = 'active'
		WHERE username = 'viewer1'`)
	if err != nil {
		t.Fatalf("link user: %v", err)
	}

	mock.ChannelCalls = nil
	mock.DMUserIDs = nil

	inputNoBroadcast := connection.UpdateInput{Notes: strPtr("Epic only")}
	_, err = svc.Set(ctx, inputNoBroadcast, admin.ID)
	if err != nil {
		t.Fatalf("set without broadcast: %v", err)
	}
	waitForDMs(t, mock, 0)

	broadcastTrue := true
	inputBroadcast := connection.UpdateInput{Notes: strPtr("Updated notes"), Broadcast: &broadcastTrue}
	_, err = svc.Set(ctx, inputBroadcast, admin.ID)
	if err != nil {
		t.Fatalf("set with broadcast: %v", err)
	}
	waitForDMs(t, mock, 1)
	if len(mock.DMUserIDs) != 1 || mock.DMUserIDs[0] != "discord-1" {
		t.Fatalf("DM user ids = %v, want [discord-1]", mock.DMUserIDs)
	}
}

func TestSetExcludesUpdaterFromBroadcast(t *testing.T) {
	t.Chdir("../..")
	ctx := context.Background()
	database := openTestDB(t)
	defer database.Close()
	if err := db.Init(ctx, database, db.SeedConfig{}); err != nil {
		t.Fatalf("init: %v", err)
	}

	mock := notify.NewMockDiscordSession()
	svc := connection.NewService(database, notify.NewDiscordProvider(mock))

	authSvc := auth.NewService(database)
	admin, err := authSvc.CreateUser(ctx, "admin1", "password123", auth.RoleAdmin)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}
	_, err = database.ExecContext(ctx, `
		UPDATE users SET external_platform = 'discord', external_user_id = 'discord-admin', status = 'active'
		WHERE id = ?`, admin.ID)
	if err != nil {
		t.Fatalf("link admin: %v", err)
	}

	_, err = authSvc.CreateUser(ctx, "viewer1", "password123", auth.RoleViewer)
	if err != nil {
		t.Fatalf("create viewer: %v", err)
	}
	_, err = database.ExecContext(ctx, `
		UPDATE users SET external_platform = 'discord', external_user_id = 'discord-viewer', status = 'active'
		WHERE username = 'viewer1'`)
	if err != nil {
		t.Fatalf("link viewer: %v", err)
	}

	input := connection.UpdateInput{
		GameHost: strPtr("play.example.com"),
		GamePort: intPtr(7777),
	}
	_, err = svc.Set(ctx, input, admin.ID)
	if err != nil {
		t.Fatalf("initial set: %v", err)
	}

	mock.ChannelCalls = nil
	mock.DMUserIDs = nil

	broadcastTrue := true
	_, err = svc.Set(ctx, connection.UpdateInput{
		Notes:     strPtr("New notes"),
		Broadcast: &broadcastTrue,
	}, admin.ID)
	if err != nil {
		t.Fatalf("broadcast set: %v", err)
	}
	waitForDMs(t, mock, 1)
	if len(mock.DMUserIDs) != 1 || mock.DMUserIDs[0] != "discord-viewer" {
		t.Fatalf("DM user ids = %v, want [discord-viewer]", mock.DMUserIDs)
	}
}

func TestSetNoBroadcastWhenUnchanged(t *testing.T) {
	t.Chdir("../..")
	ctx := context.Background()
	database := openTestDB(t)
	defer database.Close()
	if err := db.Init(ctx, database, db.SeedConfig{}); err != nil {
		t.Fatalf("init: %v", err)
	}

	mock := notify.NewMockDiscordSession()
	svc := connection.NewService(database, notify.NewDiscordProvider(mock))

	authSvc := auth.NewService(database)
	admin, err := authSvc.CreateUser(ctx, "admin1", "password123", auth.RoleAdmin)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}
	_, err = authSvc.CreateUser(ctx, "viewer1", "password123", auth.RoleViewer)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	_, err = database.ExecContext(ctx, `
		UPDATE users SET external_platform = 'discord', external_user_id = 'discord-1', status = 'active'
		WHERE username = 'viewer1'`)
	if err != nil {
		t.Fatalf("link user: %v", err)
	}

	input := connection.UpdateInput{
		GameHost: strPtr("play.example.com"),
		GamePort: intPtr(7777),
	}
	_, err = svc.Set(ctx, input, admin.ID)
	if err != nil {
		t.Fatalf("set: %v", err)
	}

	mock.ChannelCalls = nil
	mock.DMUserIDs = nil

	broadcastTrue := true
	_, err = svc.Set(ctx, connection.UpdateInput{
		GameHost:  strPtr("play.example.com"),
		GamePort:  intPtr(7777),
		Broadcast: &broadcastTrue,
	}, admin.ID)
	if err != nil {
		t.Fatalf("unchanged set: %v", err)
	}
	waitForDMs(t, mock, 0)
}

func TestSendToUserUsesEmbedTemplate(t *testing.T) {
	t.Chdir("../..")
	ctx := context.Background()
	database := openTestDB(t)
	defer database.Close()
	if err := db.Init(ctx, database, db.SeedConfig{}); err != nil {
		t.Fatalf("init: %v", err)
	}

	mock := notify.NewMockDiscordSession()
	svc := connection.NewService(database, notify.NewDiscordProvider(mock))

	authSvc := auth.NewService(database)
	admin, err := authSvc.CreateUser(ctx, "admin1", "password123", auth.RoleAdmin)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}

	input := connection.UpdateInput{
		GameHost:     strPtr("play.example.com"),
		GamePort:     intPtr(7777),
		GamePassword: strPtr("joinpass"),
	}
	_, err = svc.Set(ctx, input, admin.ID)
	if err != nil {
		t.Fatalf("set: %v", err)
	}

	mock.ChannelCalls = nil
	if err := svc.SendToUser(ctx, "discord-user-1"); err != nil {
		t.Fatalf("send to user: %v", err)
	}
	if len(mock.ChannelCalls) == 0 {
		t.Fatal("expected DM channel send")
	}
	dmMsg := mock.ChannelCalls[len(mock.ChannelCalls)-1].Message
	if dmMsg.Embeds == nil || len(dmMsg.Embeds) == 0 {
		t.Fatalf("expected embed DM, got plain content=%q", dmMsg.Content)
	}
	if !strings.Contains(dmMsg.Embeds[0].Title, "Join details") {
		t.Fatalf("embed title = %q, want join details", dmMsg.Embeds[0].Title)
	}

	var logKey string
	err = database.QueryRowContext(ctx, `
		SELECT message_type_key FROM notification_log
		WHERE recipient_external_user_id = 'discord-user-1' ORDER BY id DESC LIMIT 1`,
	).Scan(&logKey)
	if err != nil {
		t.Fatalf("query log: %v", err)
	}
	if logKey != "connection_details" {
		t.Fatalf("log message type = %q, want connection_details", logKey)
	}
}

func waitForDMs(t *testing.T, mock *notify.MockDiscordSession, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if len(mock.DMUserIDs) == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	if len(mock.DMUserIDs) != want {
		t.Fatalf("DM count = %d, want %d (ids=%v)", len(mock.DMUserIDs), want, mock.DMUserIDs)
	}
}

func strPtr(s string) *string { return &s }
func intPtr(n int) *int       { return &n }
