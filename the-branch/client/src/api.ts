import type {
  AuthResponse,
  Story,
  StoryWithNodes,
  StoryNode,
  PaginatedResponse,
  PaginatedConversations,
  Conversation,
  ConversationWithDetails,
  Message,
  Payment,
  ConversationPair,
  UserStats,
  User,
  TrendingTag,
  BrowseResponse,
} from './types';

// Use environment variable for API URL, fallback to relative /api for same-origin
const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed');
  }

  return data;
}

// Auth
export const auth = {
  register: (username: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ user: AuthResponse['user'] }>('/auth/me'),

  updateProfile: (data: { display_name?: string; contact_info?: string }) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Conversations (The Bench)
export const conversations = {
  list: (page = 1, limit = 20, options?: { status?: string; topic?: string }) => {
    let url = `/conversations?page=${page}&limit=${limit}`;
    if (options?.status) url += `&status=${options.status}`;
    if (options?.topic) url += `&topic=${encodeURIComponent(options.topic)}`;
    return request<PaginatedConversations<Conversation>>(url);
  },

  get: (id: number) => request<ConversationWithDetails>(`/conversations/${id}`),

  create: (data: {
    title: string;
    topic: string;
    description?: string;
    openingMessage: string;
    tags?: string[];
  }) =>
    request<{ conversation: Conversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTrendingTags: (limit = 15) =>
    request<{ tags: TrendingTag[] }>(`/conversations/trending-tags?limit=${limit}`),

  browse: (tag?: string) => {
    let url = '/conversations/browse';
    if (tag) url += `?tag=${encodeURIComponent(tag)}`;
    return request<BrowseResponse>(url);
  },

  join: (id: number) =>
    request<{ conversation: Conversation }>(`/conversations/${id}/join`, {
      method: 'POST',
    }),

  updateStatus: (id: number, status: string) =>
    request<{ conversation: Conversation }>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  browseQueue: (topic?: string) => {
    let url = '/conversations/queue/browse';
    if (topic) url += `?topic=${encodeURIComponent(topic)}`;
    return request<{
      conversations: {
        id: number;
        title: string;
        topic: string;
        description: string | null;
        created_at: string;
        creator_username: string;
        opening_message: string;
      }[];
    }>(url);
  },

  mine: () =>
    request<{ conversations: (Conversation & { my_role: string; last_message: string | null; last_message_at: string | null })[] }>(
      '/conversations/mine'
    ),
};

// Messages
export const messages = {
  create: (data: { conversationId: number; content: string; parentMessageId?: number }) =>
    request<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getForConversation: (conversationId: number) =>
    request<{ messages: Message[]; has_paid: boolean; is_participant: boolean }>(
      `/messages/conversation/${conversationId}`
    ),

  update: (id: number, content: string) =>
    request<{ message: Message }>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/messages/${id}`, {
      method: 'DELETE',
    }),
};

// Payments
export const payments = {
  check: (conversationId: number) =>
    request<{ has_paid: boolean; payment: Payment | null }>(`/payments/check/${conversationId}`),

  create: (conversationId: number, amount?: number) =>
    request<{ payment: Payment; message: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({ conversationId, amount }),
    }),

  history: () => request<{ payments: Payment[] }>('/payments/history'),

  revenue: (conversationId: number) =>
    request<{ total_readers: number; total_revenue: number; your_share: number }>(
      `/payments/revenue/${conversationId}`
    ),
};

// Legacy: Stories
export const stories = {
  list: (page = 1, limit = 20) =>
    request<PaginatedResponse<Story>>(`/stories?page=${page}&limit=${limit}`),

  get: (id: number) => request<StoryWithNodes>(`/stories/${id}`),

  create: (data: {
    title: string;
    description?: string;
    firstChapter: string;
    maxBranches?: number;
    maxContributors?: number;
  }) =>
    request<{ story: Story; rootNode: StoryNode }>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Story>) =>
    request<{ story: Story }>(`/stories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ message: string }>(`/stories/${id}`, {
      method: 'DELETE',
    }),
};

// Legacy: Nodes
export const nodes = {
  get: (id: number) =>
    request<{ node: StoryNode; children: StoryNode[] }>(`/nodes/${id}`),

  getPath: (id: number) => request<{ path: StoryNode[] }>(`/nodes/${id}/path`),

  create: (data: { storyId: number; parentNodeId: number; content: string }) =>
    request<{ node: StoryNode }>('/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, content: string) =>
    request<{ node: StoryNode }>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  delete: (id: number) =>
    request<{ message: string }>(`/nodes/${id}`, {
      method: 'DELETE',
    }),
};

// Legacy: Votes
export const votes = {
  getForStory: (storyId: number) =>
    request<{ votes: Record<string, number> }>(`/votes/story/${storyId}`),

  getMyVotes: (storyId: number) =>
    request<{ votes: { vote_type: string }[] }>(`/votes/story/${storyId}/me`),

  add: (storyId: number, voteType: 'complete' | 'favorite') =>
    request<{ vote?: { id: number }; message?: string }>('/votes', {
      method: 'POST',
      body: JSON.stringify({ storyId, voteType }),
    }),

  remove: (storyId: number, voteType: 'complete' | 'favorite') =>
    request<{ message: string }>('/votes', {
      method: 'DELETE',
      body: JSON.stringify({ storyId, voteType }),
    }),
};

// Pairs (reveal feature)
export const pairs = {
  stats: () => request<{ stats: UserStats }>('/pairs/stats'),

  list: () => request<{ pairs: ConversationPair[] }>('/pairs'),

  revealEligible: () => request<{ pairs: ConversationPair[] }>('/pairs/reveal-eligible'),

  revealed: () => request<{ pairs: ConversationPair[] }>('/pairs/revealed'),

  requestReveal: (pairId: number) =>
    request<{ pair: ConversationPair; revealed: boolean; message: string }>(
      `/pairs/${pairId}/request-reveal`,
      { method: 'POST' }
    ),
};
