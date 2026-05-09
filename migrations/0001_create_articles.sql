CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  published_at TEXT,
  summary TEXT,
  category TEXT,
  relevance_score INTEGER,
  posted_to_slack INTEGER DEFAULT 0,
  markdown_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
