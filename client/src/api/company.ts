import { CompanyProfile, CompanyServiceItem } from '../types/company';

export async function fetchCompanyProfileApi(): Promise<CompanyProfile> {
  const res = await fetch('/api/company', {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch company profile');
  const json = await res.json();
  return json.data;
}

export async function updateCompanyProfileApi(data: Partial<CompanyProfile>): Promise<CompanyProfile> {
  const res = await fetch('/api/company', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update company profile');
  const json = await res.json();
  return json.data;
}

export async function uploadCompanyLogoApi(file: File): Promise<{ logoUrl: string; profile: CompanyProfile }> {
  const formData = new FormData();
  formData.append('logo', file);

  const res = await fetch('/api/company/logo', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload company logo');
  }
  const json = await res.json();
  return json.data;
}

export async function removeCompanyLogoApi(): Promise<CompanyProfile> {
  const res = await fetch('/api/company/logo', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to remove logo');
  const json = await res.json();
  return json.data;
}

// Services API
export async function addCompanyServiceApi(data: { name: string; description: string }): Promise<CompanyServiceItem> {
  const res = await fetch('/api/company/services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add service');
  const json = await res.json();
  return json.data;
}

export async function updateCompanyServiceApi(id: string, data: Partial<CompanyServiceItem>): Promise<CompanyServiceItem> {
  const res = await fetch(`/api/company/services/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update service');
  const json = await res.json();
  return json.data;
}

export async function deleteCompanyServiceApi(id: string): Promise<void> {
  const res = await fetch(`/api/company/services/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete service');
}
