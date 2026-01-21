export interface User {
  id: number;
  username: string;
  display_name?: string | null;
  contact_info?: string | null;
  created_at: string;
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
  creator_username?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  reader_count?: number;
}

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  username?: string;
  role: ParticipantRole;
  joined_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  author_id: number;
  author_username?: string;
  author_role?: ParticipantRole;
  parent_message_id: number | null;
  content: string;
  is_public: boolean;
  message_order: number;
  created_at: string;
}

export interface MatchingQueueEntry {
  id: number;
  user_id: number;
  conversation_id: number | null;
  topic: string;
  description: string | null;
  matched: boolean;
  created_at: string;
}

export interface ConversationReaction {
  id: number;
  conversation_id: number;
  user_id: number;
  reaction_type: 'bookmark' | 'like' | 'follow';
  created_at: string;
}

export interface Payment {
  id: number;
  conversation_id: number;
  reader_id: number;
  amount: number;
  payment_type: 'single' | 'subscription';
  status: 'pending' | 'completed' | 'refunded';
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ConversationPair {
  id: number;
  user_a_id: number;
  user_b_id: number;
  conversation_count: number;
  revealed: number;
  user_a_reveal_requested: number;
  user_b_reveal_requested: number;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
  partner_username?: string;
  partner_id?: number;
  i_requested_reveal?: number;
  partner_requested_reveal?: number;
  partner_contact_info?: string | null;
  partner_display_name?: string | null;
}

export interface UserStats {
  total_conversations: number;
  unique_partners: number;
  closest_to_reveal: number;
  pending_reveals: number;
}

export interface ConversationWithDetails {
  conversation: Conversation;
  participants: ConversationParticipant[];
  messages: Message[];
  has_paid?: boolean;
  is_participant?: boolean;
}

export interface PaginatedConversations<T> {
  conversations: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Browse page types
export interface TrendingTag {
  tag: string;
  conversation_count: number;
}

export interface BrowseConversation extends Conversation {
  opening_post: string | null;
  tags: string[];
}

export interface BrowseResponse {
  openBenches: BrowseConversation[];
  activeConversations: BrowseConversation[];
}

// Legacy paginated response for stories
export interface PaginatedResponse<T> {
  stories: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Legacy types (kept for backward compatibility during migration)
export interface Story {
  id: number;
  title: string;
  description: string | null;
  creator_id: number;
  creator_username: string;
  max_branches: number;
  max_contributors: number;
  created_at: string;
  node_count?: number;
  complete_votes?: number;
}

export interface StoryNode {
  id: number;
  story_id: number;
  parent_node_id: number | null;
  content: string;
  author_id: number;
  author_username: string;
  position: number;
  created_at: string;
}

export interface Vote {
  id: number;
  story_id: number;
  user_id: number;
  vote_type: 'complete' | 'favorite';
  created_at: string;
}

export interface StoryWithNodes {
  story: Story;
  nodes: StoryNode[];
  contributors: number;
}
