-- Flag suspected bots and our own visits instead of counting them as visitors.

ALTER TABLE events ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN bot_reason TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN asn INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN as_org TEXT DEFAULT '';

ALTER TABLE signups ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signups ADD COLUMN bot_reason TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_events_bot ON events(is_bot, internal);

-- Back-fill: flag older rows whose browser signature was clearly automated.
UPDATE events SET is_bot = 1, bot_reason = 'bot-user-agent (backfill)'
WHERE user_agent = ''
   OR user_agent NOT LIKE 'Mozilla/5.0%'
   OR lower(user_agent) LIKE '%headless%'
   OR lower(user_agent) LIKE '%bot%'
   OR lower(user_agent) LIKE '%crawl%'
   OR lower(user_agent) LIKE '%spider%'
   OR lower(user_agent) LIKE '%python%'
   OR lower(user_agent) LIKE '%curl%'
   OR lower(user_agent) LIKE '%scan%'
   OR lower(user_agent) LIKE '%preview%';
