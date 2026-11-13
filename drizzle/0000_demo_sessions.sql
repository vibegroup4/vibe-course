CREATE TABLE demo_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  jobs TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX demo_sessions_expires_at ON demo_sessions (expires_at);
