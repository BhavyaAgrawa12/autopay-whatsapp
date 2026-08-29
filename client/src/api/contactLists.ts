export interface ContactListSummary {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  optInStatus: string;
  createdAt: string;
}

export interface ContactListDetailsResponse {
  list: ContactListSummary;
  contacts: ContactListMember[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export async function fetchContactListsApi(): Promise<ContactListSummary[]> {
  const res = await fetch('/api/contact-lists', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch contact lists');
  }
  return data.data;
}

export async function createContactListApi(name: string, description?: string): Promise<ContactListSummary> {
  const res = await fetch('/api/contact-lists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to create contact list');
  }
  return data.data;
}

export async function fetchContactListDetailsApi(
  id: string,
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<ContactListDetailsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.search) query.append('search', params.search);

  const res = await fetch(`/api/contact-lists/${id}?${query.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch list details');
  }
  return data.data;
}

export async function updateContactListApi(id: string, name?: string, description?: string): Promise<ContactListSummary> {
  const res = await fetch(`/api/contact-lists/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to update contact list');
  }
  return data.data;
}

export async function deleteContactListApi(id: string): Promise<void> {
  const res = await fetch(`/api/contact-lists/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to delete contact list');
  }
}

export async function addContactsToListApi(id: string, contactIds: string[]): Promise<{ addedCount: number; totalMembers: number }> {
  const res = await fetch(`/api/contact-lists/${id}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ contactIds }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to add contacts to list');
  }
  return data.data;
}

export async function removeContactFromListApi(id: string, contactId: string): Promise<{ totalMembers: number }> {
  const res = await fetch(`/api/contact-lists/${id}/contacts/${contactId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to remove contact from list');
  }
  return data.data;
}
