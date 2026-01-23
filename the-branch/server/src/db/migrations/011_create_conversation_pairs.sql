-- Track conversation pairs for the reveal feature
-- When two users have 10 conversations together, they can reveal identities

CREATE TABLE conversation_pairs (
  id SERIAL PRIMARY KEY,
  user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_count INTEGER NOT NULL DEFAULT 1,
  revealed INTEGER NOT NULL DEFAULT 0,
  user_a_reveal_requested INTEGER NOT NULL DEFAULT 0,
  user_b_reveal_requested INTEGER NOT NULL DEFAULT 0,
  revealed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Ensure user_a_id < user_b_id to prevent duplicates
  CHECK (user_a_id < user_b_id),
  UNIQUE(user_a_id, user_b_id)
);

-- Track which conversations contributed to a pair's count
CREATE TABLE pair_conversations (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER NOT NULL REFERENCES conversation_pairs(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pair_id, conversation_id)
);

CREATE INDEX idx_conv_pairs_user_a ON conversation_pairs(user_a_id);
CREATE INDEX idx_conv_pairs_user_b ON conversation_pairs(user_b_id);
CREATE INDEX idx_conv_pairs_count ON conversation_pairs(conversation_count);
CREATE INDEX idx_pair_convs_pair ON pair_conversations(pair_id);

-- DOWN

DROP TABLE IF EXISTS pair_conversations;
DROP TABLE IF EXISTS conversation_pairs;
