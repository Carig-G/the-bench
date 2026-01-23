import db from './config.js';

// Create all tables if they don't exist
export async function initializeDatabase(): Promise<void> {
  console.log('Initializing database schema...');

  // Users table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      contact_info TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  // Stories table (legacy)
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_branches INTEGER DEFAULT 3,
      max_contributors INTEGER DEFAULT 10,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_creator ON stories(creator_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at)`);

  // Story nodes table (legacy)
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS story_nodes (
      id SERIAL PRIMARY KEY,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      parent_node_id INTEGER REFERENCES story_nodes(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_story_nodes_story ON story_nodes(story_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_story_nodes_parent ON story_nodes(parent_node_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_story_nodes_author ON story_nodes(author_id)`);

  // Votes table (legacy)
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_type TEXT NOT NULL CHECK (vote_type IN ('complete', 'favorite')),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(story_id, user_id, vote_type)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_votes_story ON votes(story_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)`);

  // Conversations table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'matching' CHECK (status IN ('matching', 'active', 'completed', 'archived')),
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_creator ON conversations(creator_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_topic ON conversations(topic)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)`);

  // Conversation participants table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('initiator', 'responder')),
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id, user_id)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id)`);

  // Messages table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      message_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(conversation_id, message_order)`);

  // Matching queue table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS matching_queue (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      description TEXT,
      matched INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_matching_queue_user ON matching_queue(user_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_matching_queue_topic ON matching_queue(topic)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_matching_queue_matched ON matching_queue(matched)`);

  // Conversation reactions table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_reactions (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction_type TEXT NOT NULL CHECK (reaction_type IN ('bookmark', 'like', 'follow')),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id, user_id, reaction_type)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_reactions_conv ON conversation_reactions(conversation_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_reactions_user ON conversation_reactions(user_id)`);

  // Payments table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'single' CHECK (payment_type IN ('single', 'subscription')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id, reader_id)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_conv ON payments(conversation_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_reader ON payments(reader_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);

  // Conversation pairs table (for reveal feature)
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_pairs (
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
      CHECK (user_a_id < user_b_id),
      UNIQUE(user_a_id, user_b_id)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_pairs_user_a ON conversation_pairs(user_a_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_pairs_user_b ON conversation_pairs(user_b_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_pairs_count ON conversation_pairs(conversation_count)`);

  // Pair conversations table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS pair_conversations (
      id SERIAL PRIMARY KEY,
      pair_id INTEGER NOT NULL REFERENCES conversation_pairs(id) ON DELETE CASCADE,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(pair_id, conversation_id)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_pair_convs_pair ON pair_conversations(pair_id)`);

  // Conversation tags table
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_tags (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(conversation_id, tag)
    )
  `);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_tags_conv ON conversation_tags(conversation_id)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_tags_tag ON conversation_tags(tag)`);
  await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_tags_created ON conversation_tags(created_at)`);

  console.log('Database schema initialized.');
}
