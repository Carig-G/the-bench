-- Conversation reactions (bookmarks, likes, follows)
CREATE TABLE conversation_reactions (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('bookmark', 'like', 'follow')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id, reaction_type)
);

CREATE INDEX idx_conv_reactions_conversation ON conversation_reactions(conversation_id);
CREATE INDEX idx_conv_reactions_user ON conversation_reactions(user_id);

-- DOWN

DROP TABLE IF EXISTS conversation_reactions;
