-- Conversation participants - exactly 2 per conversation
CREATE TABLE conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('initiator', 'responder')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id),
  UNIQUE(conversation_id, role)
);

CREATE INDEX idx_conv_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);

-- DOWN

DROP TABLE IF EXISTS conversation_participants;
