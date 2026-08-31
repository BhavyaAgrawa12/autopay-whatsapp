import { Campaign } from '../types/campaign';
import { API_BASE_URL, getAuthHeaders } from './config';

export interface CampaignProgressData {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  marketingLimited: number;
  rateLimited: number;
  processed: number;
  percentage: number;
  status: string;
  sendingRate: string;
  pauseReason?: string;
  rateLimitCooldownUntil?: string;
}

export interface CampaignRecipientItem {
  _id: string;
  campaignId: string;
  phone: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED' | 'MARKETING_LIMITED' | 'RATE_LIMITED';
  whatsappMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string;
  errorReason?: string;
  retryAfter?: string;
  contactId?: {
    name?: string;
    phoneRaw?: string;
    marketingOptIn?: string;
  };
}

export interface PaginatedRecipientsResponse {
  recipients: CampaignRecipientItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchCampaignsApi(): Promise<Campaign[]> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  const json = await res.json();
  return json.data;
}

export async function saveCampaignApi(campaign: Partial<Campaign>): Promise<Campaign> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify(campaign),
  });
  if (!res.ok) throw new Error('Failed to save campaign to database');
  const json = await res.json();
  return json.data;
}

export async function deleteCampaignApi(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete campaign');
}

export async function startCampaignApi(
  campaignId: string,
  payload: {
    campaignName: string;
    templateName: string;
    templateLanguage: string;
    headerConfig: any;
    variableMappings: any[];
    recipients?: any[];
  }
): Promise<{ campaignId: string; status: string; totalJobs: number }> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/send`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || json.data?.message || 'Failed to start campaign bulk dispatch');
  }
  return json.data;
}

export async function pauseCampaignApi(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/pause`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to pause campaign');
}

export async function resumeCampaignApi(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/resume`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to resume campaign');
}

export async function cancelCampaignApi(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to cancel campaign');
}

export async function fetchCampaignProgressApi(campaignId: string): Promise<CampaignProgressData> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/progress`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch campaign progress');
  const json = await res.json();
  return json.data;
}

export async function fetchCampaignRecipientsApi(
  campaignId: string,
  params?: { page?: number; limit?: number; status?: string; search?: string }
): Promise<PaginatedRecipientsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/recipients?${query.toString()}`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch campaign recipients');
  const json = await res.json();
  return json.data;
}

export interface CampaignReportData {
  campaign: {
    id: string;
    name: string;
    templateName: string;
    templateLanguage: string;
    status: string;
    pauseReason?: string;
    rateLimitCooldownUntil?: string;
    headerFormat?: string;
    audienceCount: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
  metrics: {
    total: number;
    queued: number;
    sending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    marketingLimited: number;
    rateLimited: number;
    skipped: number;
    deliveryRate: number;
    readRate: number;
    failureRate: number;
    durationSeconds: number;
    durationFormatted: string;
  };
}

export async function fetchCampaignReportApi(campaignId: string): Promise<CampaignReportData> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/report`, {
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch campaign report');
  const json = await res.json();
  return json.data;
}

export async function downloadCampaignExcelApi(
  campaignId: string,
  exportType: 'failed' | 'successful' | 'all'
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/export/${exportType}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to export ${exportType} Excel report`);

  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = `Campaign-${exportType}-Report.xlsx`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function retryFailedCampaignApi(
  campaignId: string
): Promise<{ retriedCount: number; blockedCount: number }> {
  const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/retry-failed`, {
    method: 'POST',
    headers: getAuthHeaders({ Accept: 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to retry failed recipients');
  const json = await res.json();
  return json.data;
}
