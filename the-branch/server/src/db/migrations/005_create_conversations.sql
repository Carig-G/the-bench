-- The Bench: Conversations Schema
-- This migration creates the new conversation-based tables

-- Conversations table (replaces stories concept)
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'matching' CHECK (status IN ('matching', 'active', 'completed', 'archived')),
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_creator ON conversations(creator_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_topic ON conversations(topic);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

-- DOWN

DROP TABLE IF EXISTS conversations;
