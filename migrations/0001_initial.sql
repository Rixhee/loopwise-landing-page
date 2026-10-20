-- Initial tables. IF NOT EXISTS so this is harmless on a database created before migrations were used.

CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  listings TEXT DEFAULT '',
  location TEXT DEFAULT '',      -- which form: hero or footer
  source TEXT DEFAULT '',        -- ?src= / utm_source tag on the link they came from
  campaign TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  visitor_id TEXT DEFAULT '',
  country TEXT DEFAULT '',
  region TEXT DEFAULT '',
  city TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT DEFAULT '',
  visitor_id TEXT DEFAULT '',
  country TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  detail TEXT DEFAULT '',
  source TEXT DEFAULT '',
  campaign TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  path TEXT DEFAULT '',
  visitor_id TEXT DEFAULT '',
  country TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_signups_visitor ON signups(visitor_id);
