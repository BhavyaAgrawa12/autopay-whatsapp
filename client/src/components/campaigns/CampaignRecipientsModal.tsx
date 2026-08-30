import React, { useEffect, useState } from 'react';
import { X, Search, RefreshCw, Eye, AlertTriangle, Send, CheckCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  fetchCampaignRecipientsApi,
  fetchCampaignProgressApi,
  CampaignRecipientItem,
  CampaignProgressData,
} from '../../api/campaigns';

interface CampaignRecipientsModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

export const CampaignRecipientsModal: React.FC<CampaignRecipientsModalProps> = ({
  campaignId,
  campaignName,
  onClose,
}) => {
  const [progress, setProgress] = useState<CampaignProgressData | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipientItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [progData, recData] = await Promise.all([
        fetchCampaignProgressApi(campaignId),
        fetchCampaignRecipientsApi(campaignId, { page, limit, status: statusFilter, search }),
      ]);
      setProgress(progData);
      setRecipients(recData.recipients);
      setTotalPages(recData.pagination.totalPages);
      setTotalItems(recData.pagination.total);
    } catch (err: any) {
      console.error('Failed to load campaign recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [campaignId, page, statusFilter, search]);

  const deliveryRate = progress && progress.sent > 0 ? ((progress.delivered / progress.sent) * 100).toFixed(1) : '0.0';
  const readRate = progress && progress.delivered > 0 ? ((progress.read / progress.delivered) * 100).toFixed(1) : '0.0';
  const failureRate = progress && progress.total > 0 ? ((progress.failed / progress.total) * 100).toFixed(1) : '0.0';

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'READ':
        return <Badge variant="success" size="sm"><Eye className="w-3 h-3 mr-1" /> Read</Badge>;
      case 'DELIVERED':
        return <Badge variant="info" size="sm"><CheckCheck className="w-3 h-3 mr-1" /> Delivered</Badge>;
      case 'SENT':
        return <Badge variant="neutral" size="sm"><Send className="w-3 h-3 mr-1" /> Sent</Badge>;
      case 'FAILED':
        return <Badge variant="error" size="sm"><AlertTriangle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'SENDING':
        return <Badge variant="warning" size="sm">Sending...</Badge>;
      case 'QUEUED':
        return <Badge variant="neutral" size="sm">Queued</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>{campaignName}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                {campaignId}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Real-time Webhook Delivery, Read & Failure Metrics</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Progress & Delivery Metrics Cards */}
          {progress && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Total Audience</span>
                <span className="text-lg font-bold text-white">{progress.total}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Sent (API Accepted)</span>
                <span className="text-lg font-bold text-sky-400">{progress.sent}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Delivered</span>
                <span className="text-lg font-bold text-emerald-400">{progress.delivered} <span className="text-xs font-normal text-slate-400">({deliveryRate}%)</span></span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Read</span>
                <span className="text-lg font-bold text-purple-400">{progress.read} <span className="text-xs font-normal text-slate-400">({readRate}%)</span></span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Failed</span>
                <span className="text-lg font-bold text-rose-400">{progress.failed} <span className="text-xs font-normal text-slate-400">({failureRate}%)</span></span>
              </div>
            </div>
          )}

          {/* Filters & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
              {['', 'SENT', 'DELIVERED', 'READ', 'FAILED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {st === '' ? 'ALL' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search phone or Message ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Recipients Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">WhatsApp Message ID</th>
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4">Delivered At</th>
                  <th className="py-3 px-4">Read At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No matching recipients found.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        {r.contactId?.name || 'Test Contact'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{r.phone}</td>
                      <td className="py-3 px-4">
                        {renderStatusBadge(r.status)}
                        {r.errorReason && (
                          <span
                            className="block text-[10px] text-rose-400 mt-0.5 max-w-xs truncate"
                            title={
                              r.errorCode === '131049' || (r.errorReason || '').includes('healthy ecosystem engagement')
                                ? 'Not delivered — Meta marketing delivery limit (24h cooldown)'
                                : r.errorReason
                            }
                          >
                            {r.errorCode === '131049' || (r.errorReason || '').includes('healthy ecosystem engagement')
                              ? 'Not delivered — Meta marketing delivery limit'
                              : r.errorReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-[150px] truncate" title={r.whatsappMessageId || '-'}>
                        {r.whatsappMessageId || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-mono text-[11px]">
                        {r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-purple-400 font-mono text-[11px]">
                        {r.readAt ? new Date(r.readAt).toLocaleTimeString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer / Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/80 text-xs">
          <span className="text-slate-400">
            Showing <strong className="text-white">{recipients.length}</strong> of <strong className="text-white">{totalItems}</strong> recipients
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-slate-400 px-2 font-mono">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
