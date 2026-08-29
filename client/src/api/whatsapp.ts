import { WhatsAppStatusInfo, WATemplate, SendTestMessagePayload } from '../types/whatsapp';
import { API_BASE_URL } from './config';

export async function fetchWhatsAppStatusApi(): Promise<WhatsAppStatusInfo> {
  const res = await fetch(`${API_BASE_URL}/api/whatsapp/status`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
  const json = await res.json();
  return json.data;
}

export async function testWhatsAppConnectionApi(): Promise<{ connected: boolean; message: string; details?: any }> {
  const res = await fetch(`${API_BASE_URL}/api/whatsapp/test-connection`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.data?.message || json.error?.message || 'WhatsApp connection test failed');
  }
  return json.data;
}

export async function fetchTemplatesApi(): Promise<WATemplate[]> {
  const res = await fetch(`${API_BASE_URL}/api/whatsapp/templates`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch templates');
  const json = await res.json();
  return json.data;
}

export async function syncTemplatesApi(): Promise<WATemplate[]> {
  const res = await fetch(`${API_BASE_URL}/api/whatsapp/templates/sync`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || 'Failed to synchronize templates from Meta Cloud API');
  }
  const json = await res.json();
  return json.data;
}

export async function sendTestMessageApi(payload: SendTestMessagePayload): Promise<{ messageId: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/whatsapp/send-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || json.data?.message || 'Failed to send WhatsApp test message');
  }
  return json.data;
}
