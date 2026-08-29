import React, { useEffect, useState } from 'react';
import { Key, ShieldCheck, Activity, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { fetchWhatsAppStatusApi, testWhatsAppConnectionApi } from '../api/whatsapp';
import { WhatsAppStatusInfo } from '../types/whatsapp';

export const SettingsPage: React.FC = () => {
  const [waStatus, setWaStatus] = useState<WhatsAppStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string; details?: any } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchWhatsAppStatusApi();
      setWaStatus(data);
    } catch {
      setWaStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testWhatsAppConnectionApi();
      setTestResult(res);
      await loadStatus();
    } catch (err: any) {
      setTestResult({
        connected: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="System & API Settings"
        description="Official Meta WhatsApp Business Cloud API parameters, MongoDB database, and system configuration."
      />

      <div className="space-y-6">
        {/* WhatsApp Business Settings */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white text-base">WhatsApp Business Cloud API</h3>
                <p className="text-xs text-slate-400">Official Meta Graph API Integration Settings</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              isLoading={testing}
              leftIcon={<Activity className="w-4 h-4" />}
            >
              Test Connection
            </Button>
          </div>

          {testResult && (
            <div
              className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                testResult.connected
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
              }`}
            >
              {testResult.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block text-sm mb-0.5">
                  {testResult.connected ? 'Connection Verified ✓' : 'Connection Test Failed'}
                </span>
                <span>{testResult.message}</span>
                {testResult.details?.displayPhoneNumber && (
                  <span className="block mt-1 font-mono text-[11px] text-slate-300">
                    Phone: {testResult.details.displayPhoneNumber} ({testResult.details.verifiedName})
                  </span>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <LoadingSpinner label="Checking WhatsApp Cloud API configuration..." />
          ) : !waStatus ? (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Unable to check WhatsApp connection. Server status API is unreachable.</span>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {/* Overall Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-slate-200 block">Connection Status</span>
                    {waStatus.displayPhoneNumber && waStatus.verifiedName && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Account: <strong className="text-emerald-400">{waStatus.displayPhoneNumber}</strong> ({waStatus.verifiedName})
                      </span>
                    )}
                  </div>
                </div>
                {waStatus.configured && waStatus.connected ? (
                  <Badge variant="success">Connection Verified ✓</Badge>
                ) : waStatus.configured ? (
                  <Badge variant="warning">Configuration Present / Meta Connection Failed</Badge>
                ) : (
                  <Badge variant="error">Not Configured / Credentials Missing</Badge>
                )}
              </div>

              {/* Phone Number ID */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 gap-2">
                <div>
                  <span className="font-semibold text-slate-200 block">Phone Number ID</span>
                  <span className="text-slate-400">Environment variable: <code className="text-emerald-400">WHATSAPP_PHONE_NUMBER_ID</code></span>
                </div>
                {waStatus.phoneNumberIdConfigured ? (
                  <Badge variant="success">Configured ✓</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>

              {/* Business Account ID */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 gap-2">
                <div>
                  <span className="font-semibold text-slate-200 block">Business Account ID</span>
                  <span className="text-slate-400">Environment variable: <code className="text-emerald-400">WHATSAPP_BUSINESS_ACCOUNT_ID</code></span>
                </div>
                {waStatus.businessAccountIdConfigured ? (
                  <Badge variant="success">Configured ✓</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>

              {/* Access Token */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 gap-2">
                <div>
                  <span className="font-semibold text-slate-200 block">WhatsApp Access Token</span>
                  <span className="text-slate-400">Environment variable: <code className="text-emerald-400">WHATSAPP_ACCESS_TOKEN</code> (Secret)</span>
                </div>
                {waStatus.accessTokenConfigured ? (
                  <Badge variant="success">Configured ✓ (Secret)</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>

              {/* App Secret */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 gap-2">
                <div>
                  <span className="font-semibold text-slate-200 block">WhatsApp App Secret (Webhook HMAC)</span>
                  <span className="text-slate-400">Environment variable: <code className="text-emerald-400">WHATSAPP_APP_SECRET</code> (Secret)</span>
                </div>
                {waStatus.appSecretConfigured ? (
                  <Badge variant="success">Configured ✓ (Secret)</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>

              {/* API Version */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 gap-2">
                <div>
                  <span className="font-semibold text-slate-200 block">Meta Graph API Version</span>
                  <span className="text-slate-400">Environment variable: <code className="text-emerald-400">WHATSAPP_API_VERSION</code></span>
                </div>
                <Badge variant="info">{waStatus.apiVersion || 'v18.0'}</Badge>
              </div>
            </div>
          )}
        </Card>

        {/* MongoDB Database Architecture */}
        <Card>
          <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-800">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">MongoDB Permanent Database Architecture</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Database Engine</span>
                <Badge variant="success">MongoDB (Mongoose)</Badge>
              </div>
              <p className="text-slate-400 text-[11px]">
                Permanent database source of truth for Contacts, Contact Lists, Campaigns, and Recipient logs. Atlas Ready.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Sending Engine</span>
                <Badge variant="info">In-Process Concurrency</Badge>
              </div>
              <p className="text-slate-400 text-[11px]">
                Controlled in-process campaign sender with atomic recipient claiming. Zero Redis/BullMQ dependency.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
