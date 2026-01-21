CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('complete', 'favorite')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, user_id, vote_type)
);

CREATE INDEX idx_votes_story ON votes(story_id);
CREATE INDEX idx_votes_user ON votes(user_id);

-- DOWN

DROP TABLE IF EXISTS votes;
