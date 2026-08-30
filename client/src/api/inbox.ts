import { API_BASE_URL, getAuthHeaders } from './config';
import { ConversationItem, MessageItem, ApprovedTemplate } from '../types/inbox';

export interface FetchConversationsResult {
  conversations: ConversationItem[];
  total: number;
  page: number;
  pages: number;
}

export interface FetchMessagesResult {
  messages: MessageItem[];
  total: number;
  conversation: ConversationItem;
}

export async function fetchConversationsApi(params?: {
  search?: string;
  filter?: 'all' | 'unread';
  page?: number;
  limit?: number;
}): Promise<FetchConversationsResult> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.filter) query.set('filter', params.filter);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE_URL}/api/inbox/conversations?${query.toString()}`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  const json = await res.json();
  return json.data;
}

export async function fetchConversationMessagesApi(
  conversationId: string,
  params?: { page?: number; limit?: number; beforeId?: string }
): Promise<FetchMessagesResult> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.beforeId) query.set('beforeId', params.beforeId);

  const res = await fetch(`${API_BASE_URL}/api/inbox/conversations/${conversationId}/messages?${query.toString()}`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch conversation messages');
  const json = await res.json();
  return json.data;
}

export async function sendOutboundMessageApi(
  conversationId: string,
  payload: {
    text?: string;
    templateName?: string;
    languageCode?: string;
    variables?: Record<string, string>;
  }
): Promise<{ message: MessageItem; conversation: ConversationItem }> {
  const res = await fetch(`${API_BASE_URL}/api/inbox/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = json.error?.message || json.message || 'Failed to send message';
    const err = new Error(errorMsg) as any;
    err.code = json.error?.code || json.code;
    throw err;
  }
  return json.data;
}

export async function markConversationReadApi(conversationId: string): Promise<ConversationItem> {
  const res = await fetch(`${API_BASE_URL}/api/inbox/conversations/${conversationId}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark conversation as read');
  const json = await res.json();
  return json.data;
}

export async function markConversationUnreadApi(conversationId: string): Promise<ConversationItem> {
  const res = await fetch(`${API_BASE_URL}/api/inbox/conversations/${conversationId}/unread`, {
    method: 'PATCH',
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark conversation as unread');
  const json = await res.json();
  return json.data;
}

export async function fetchApprovedTemplatesApi(): Promise<ApprovedTemplate[]> {
  const res = await fetch(`${API_BASE_URL}/api/inbox/templates`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch approved templates');
  const json = await res.json();
  return json.data;
}
