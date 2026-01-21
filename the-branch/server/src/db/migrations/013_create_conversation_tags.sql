-- Conversation tags for categorization and trending topics
-- Each conversation can have multiple tags

CREATE TABLE conversation_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups by conversation
CREATE INDEX idx_conv_tags_conversation ON conversation_tags(conversation_id);

-- Index for tag searches and trending queries
CREATE INDEX idx_conv_tags_tag ON conversation_tags(tag);

-- Index for time-based trending queries
CREATE INDEX idx_conv_tags_created ON conversation_tags(created_at);

-- Prevent duplicate tags on same conversation
CREATE UNIQUE INDEX idx_conv_tags_unique ON conversation_tags(conversation_id, tag);

-- DOWN

DROP TABLE IF EXISTS conversation_tags;
