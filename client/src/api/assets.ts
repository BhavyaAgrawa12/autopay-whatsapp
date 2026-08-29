import { CompanyAssetRecord } from '../types/company';
import { API_BASE_URL, getAuthHeaders } from './config';

export async function fetchAssetsApi(query?: {
  search?: string;
  category?: string;
  sort?: string;
}): Promise<CompanyAssetRecord[]> {
  const params = new URLSearchParams();
  if (query?.search) params.append('search', query.search);
  if (query?.category) params.append('category', query.category);
  if (query?.sort) params.append('sort', query.sort);

  const res = await fetch(`${API_BASE_URL}/api/company/assets?${params.toString()}`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch assets');
  const json = await res.json();
  const raw = json.data || [];
  return raw.map((a: any) => ({
    ...a,
    id: a.id || a.assetId || a._id,
  }));
}

export async function uploadAssetApi(file: File, description?: string): Promise<CompanyAssetRecord> {
  const formData = new FormData();
  formData.append('file', file);
  if (description) formData.append('description', description);

  const res = await fetch(`${API_BASE_URL}/api/company/assets`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload media asset');
  }

  const json = await res.json();
  return json.data;
}

export async function renameAssetApi(id: string, newFilename: string): Promise<CompanyAssetRecord> {
  const res = await fetch(`${API_BASE_URL}/api/company/assets/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify({ filename: newFilename }),
  });
  if (!res.ok) throw new Error('Failed to rename asset');
  const json = await res.json();
  return json.data;
}

export async function deleteAssetApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/company/assets/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete asset');
}
