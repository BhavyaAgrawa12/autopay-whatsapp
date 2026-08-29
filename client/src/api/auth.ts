import { AuthResponse, User } from '../types';
import { API_BASE_URL, getAuthHeaders } from './config';

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorMsg = data.error?.message || 'Authentication failed. Please check credentials.';
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).retryAfter = response.headers.get('Retry-After');
    throw err;
  }

  return data;
}

export async function logoutApi(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Accept': 'application/json' }),
    credentials: 'include',
  });
}

export async function fetchMeApi(): Promise<{ user: User; accessToken?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders({ 'Accept': 'application/json' }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Unauthenticated session');
  }

  const data = await response.json();
  return data.data;
}
