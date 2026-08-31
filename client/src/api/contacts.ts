import { Contact, MarketingOptInStatus } from '../types/contact';
import { API_BASE_URL, getAuthHeaders } from './config';

export interface PaginatedContactsResponse {
  contacts: Contact[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stats?: {
    totalContacts: number;
    optedOutCount: number;
    optedInCount: number;
    unknownCount: number;
  };
  facets?: {
    cities: string[];
    companies: string[];
    services: string[];
  };
}

export async function fetchContactsApi(query?: {
  page?: number;
  limit?: number;
  search?: string;
  optIn?: string;
  city?: string;
  company?: string;
  service?: string;
  sort?: string;
}): Promise<PaginatedContactsResponse> {
  const params = new URLSearchParams();
  if (query?.page) params.append('page', String(query.page));
  if (query?.limit) params.append('limit', String(query.limit));
  if (query?.search) params.append('search', query.search);
  if (query?.optIn) params.append('optIn', query.optIn);
  if (query?.city) params.append('city', query.city);
  if (query?.company) params.append('company', query.company);
  if (query?.service) params.append('service', query.service);
  if (query?.sort) params.append('sort', query.sort);

  const res = await fetch(`${API_BASE_URL}/api/contacts?${params.toString()}`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch contacts');
  const json = await res.json();
  const rawContacts = json.data?.contacts || [];
  const normalizedContacts: Contact[] = rawContacts.map((c: any) => ({
    ...c,
    id: c.id || c._id,
    phone: c.phone || c.phoneRaw || c.phoneNormalized || '',
    normalizedPhone: c.normalizedPhone || c.phoneNormalized || c.phoneRaw || c.phone || '',
    customFields: c.customFields || {},
    marketingOptIn: c.marketingOptIn || 'OPTED_IN',
  }));

  return {
    ...json.data,
    contacts: normalizedContacts,
  };
}

export async function importContactsApi(formData: FormData): Promise<{
  summary: {
    totalUploaded: number;
    importedCount: number;
    invalidCount: number;
    duplicateCount: number;
    optedOutCount: number;
    unknownCount: number;
  };
  invalidRows: any[];
  errorReportXlsxBase64?: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/contacts/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to import contacts file');
  }

  const json = await res.json();
  return json.data;
}

export async function updateContactOptInApi(
  id: string,
  marketingOptIn: MarketingOptInStatus
): Promise<Contact> {
  const res = await fetch(`${API_BASE_URL}/api/contacts/${id}/opt-in`, {
    method: 'PATCH',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify({ marketingOptIn }),
  });

  if (!res.ok) throw new Error('Failed to update opt-in status');
  const json = await res.json();
  return json.data;
}

export async function deleteContactApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete contact');
}
