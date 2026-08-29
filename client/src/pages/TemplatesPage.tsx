import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  RefreshCw,
  Send,
  Info,
  FileText,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { EmptyState } from '../components/ui/EmptyState';
import { WATemplate } from '../types/whatsapp';
import { fetchTemplatesApi, syncTemplatesApi } from '../api/whatsapp';
import { SendTestMessageModal } from '../components/templates/SendTestMessageModal';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected template for sending single test message
  const [testModalTemplate, setTestModalTemplate] = useState<WATemplate | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplatesApi();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSyncTemplates = async () => {
    setSyncing(true);
    setError(null);
    try {
      const updated = await syncTemplatesApi();
      setTemplates(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to synchronize templates from Meta Cloud API.');
    } finally {
      setSyncing(false);
    }
  };

  const getHeaderIcon = (format?: string) => {
    switch (format) {
      case 'IMAGE':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'VIDEO':
        return <Video className="w-4 h-4 text-sky-400" />;
      case 'DOCUMENT':
        return <FileText className="w-4 h-4 text-amber-400" />;
      default:
        return <FileCode2 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div>
      <PageHeader
        title="WhatsApp Message Templates"
        description="Meta-approved message templates synchronized from official WhatsApp Business Cloud API."
        badge={<Badge variant="success">Meta Cloud API Sync</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleSyncTemplates}
            isLoading={syncing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh Templates from Meta
          </Button>
        }
      />

      {/* Meta Template Rule Banner */}
      <div className="mb-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3 text-xs leading-relaxed text-slate-300 shadow-md">
        <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">Meta Template Approval Policy</span>
          <span>
            WhatsApp message templates are created and approved directly by Meta. Templates cannot be modified inside this application. You can inspect components, view variable slots, and send single test messages.
          </span>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadTemplates} />}

      {loading ? (
        <LoadingSpinner label="Synchronizing approved templates from Meta..." />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="No Approved Templates Found"
          description="Click 'Refresh Templates from Meta' to synchronize approved message templates from your WhatsApp Business Account."
          actionLabel="Sync Templates from Meta"
          onAction={handleSyncTemplates}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <Card key={tpl.id || tpl.name} variant="default" className="flex flex-col justify-between space-y-4">
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base font-mono">{tpl.name}</h3>
                      <Badge variant="success" size="sm">{tpl.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Language: <strong className="text-slate-200">{tpl.language}</strong></span>
                      <span>Category: <strong className="text-slate-200">{tpl.category}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Component Breakdown */}
                <div className="space-y-2.5 text-xs">
                  {/* Header Component */}
                  {tpl.headerType && tpl.headerType !== 'NONE' && (
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                      {getHeaderIcon(tpl.headerType)}
                      <span className="font-semibold text-slate-300">Header Format:</span>
                      <Badge variant="info" size="sm">{tpl.headerType}</Badge>
                    </div>
                  )}

                  {/* Body Component */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Body Message Text
                    </span>
                    <p className="text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                      {tpl.bodyText || 'No body text.'}
                    </p>

                    {tpl.variables && tpl.variables.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Variables:</span>
                        <div className="flex flex-wrap gap-1">
                          {tpl.variables.map((v) => (
                            <code key={v} className="bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-emerald-800/40">
                              {v}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Component */}
                  {tpl.footerText && (
                    <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-400 italic text-[11px]">
                      Footer: {tpl.footerText}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">ID: {tpl.id}</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setTestModalTemplate(tpl)}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Send Test Message
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Send Single Test Message Modal */}
      <SendTestMessageModal
        template={testModalTemplate}
        isOpen={!!testModalTemplate}
        onClose={() => setTestModalTemplate(null)}
      />
    </div>
  );
};
