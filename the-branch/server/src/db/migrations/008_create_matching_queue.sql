-- Matching queue for users waiting to be paired
CREATE TABLE matching_queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  description TEXT,
  matched INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matching_queue_user ON matching_queue(user_id);
CREATE INDEX idx_matching_queue_topic ON matching_queue(topic);
CREATE INDEX idx_matching_queue_matched ON matching_queue(matched);

-- DOWN

DROP TABLE IF EXISTS matching_queue;
