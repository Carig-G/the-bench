CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_branches INTEGER DEFAULT 3,
  max_contributors INTEGER DEFAULT 10,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stories_creator ON stories(creator_id);
CREATE INDEX idx_stories_created_at ON stories(created_at);

-- DOWN

DROP TABLE IF EXISTS stories;
