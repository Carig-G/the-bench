export interface User {
  id: number;
  username: string;
  password_hash: string;
  moniker?: string | null;
  created_at: Date;
}

export type ConversationStatus = 'matching' | 'active' | 'completed' | 'archived';
export type ParticipantRole = 'initiator' | 'responder';

export interface Conversation {
  id: number;
  title: string;
  topic: string;
  description: string | null;
  status: ConversationStatus;
  creator_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  role: ParticipantRole;
  joined_at: Date;
}

export interface Message {
  id: number;
  conversation_id: number;
  author_id: number;
  parent_message_id: number | null;
  content: string;
  is_public: number; // SQLite boolean
  message_order: number;
  created_at: Date;
}

export interface MatchingQueueEntry {
  id: number;
  user_id: number;
  conversation_id: number | null;
  topic: string;
  description: string | null;
  matched: number; // SQLite boolean
  created_at: Date;
}

export interface ConversationReaction {
  id: number;
  conversation_id: number;
  user_id: number;
  reaction_type: 'bookmark' | 'like' | 'follow';
  created_at: Date;
}

export interface Payment {
  id: number;
  conversation_id: number;
  reader_id: number;
  amount: number;
  payment_type: 'single' | 'subscription';
  status: 'pending' | 'completed' | 'refunded';
  created_at: Date;
}

export interface JwtPayload {
  userId: number;
  username: string;
}

export interface ConversationPair {
  id: number;
  user_a_id: number;
  user_b_id: number;
  conversation_count: number;
  revealed: number; // SQLite boolean
  user_a_reveal_requested: number;
  user_b_reveal_requested: number;
  revealed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserStats {
  total_conversations: number;
  unique_partners: number;
  closest_to_reveal: number; // How many more conversations until next reveal
  pending_reveals: number; // How many pairs are at 10+ and awaiting mutual agreement
}

// Legacy types (kept for backward compatibility during migration)
export interface Story {
  id: number;
  title: string;
  description: string | null;
  creator_id: number;
  max_branches: number;
  max_contributors: number;
  created_at: Date;
}

export interface StoryNode {
  id: number;
  story_id: number;
  parent_node_id: number | null;
  content: string;
  author_id: number;
  position: number;
  created_at: Date;
}

export interface Vote {
  id: number;
  story_id: number;
  user_id: number;
  vote_type: 'complete' | 'favorite';
  created_at: Date;
}
