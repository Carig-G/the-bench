CREATE TABLE story_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  parent_node_id INTEGER REFERENCES story_nodes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_story_nodes_story ON story_nodes(story_id);
CREATE INDEX idx_story_nodes_parent ON story_nodes(parent_node_id);
CREATE INDEX idx_story_nodes_author ON story_nodes(author_id);

-- DOWN

DROP TABLE IF EXISTS story_nodes;
