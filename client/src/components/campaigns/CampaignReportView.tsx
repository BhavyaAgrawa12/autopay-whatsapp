import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Eye,
  Send,
  CheckCheck,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  fetchCampaignReportApi,
  fetchCampaignRecipientsApi,
  downloadCampaignExcelApi,
  retryFailedCampaignApi,
  CampaignReportData,
  CampaignRecipientItem,
} from '../../api/campaigns';

interface CampaignReportViewProps {
  campaignId: string;
  onClose: () => void;
}

export const CampaignReportView: React.FC<CampaignReportViewProps> = ({ campaignId, onClose }) => {
  const [report, setReport] = useState<CampaignReportData | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipientItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadReportAndRecipients = async () => {
    setLoading(true);
    try {
      const [reportData, recipientsData] = await Promise.all([
        fetchCampaignReportApi(campaignId),
        fetchCampaignRecipientsApi(campaignId, { page, limit, status: statusFilter, search }),
      ]);
      setReport(reportData);
      setRecipients(recipientsData.recipients);
      setTotalPages(recipientsData.pagination.totalPages);
      setTotalItems(recipientsData.pagination.total);
    } catch (err: any) {
      console.error('Failed to load campaign report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportAndRecipients();
    const interval = setInterval(() => {
      loadReportAndRecipients();
    }, 5000);
    return () => clearInterval(interval);
  }, [campaignId, page, statusFilter, search]);

  const handleDownloadExcel = async (exportType: 'failed' | 'successful' | 'all') => {
    setExportingType(exportType);
    setExportError(null);
    try {
      await downloadCampaignExcelApi(campaignId, exportType);
    } catch (err: any) {
      setExportError(err.message || 'Unable to generate report. Please try again.');
    } finally {
      setExportingType(null);
    }
  };

  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    setRetryNotice(null);
    try {
      const res = await retryFailedCampaignApi(campaignId);
      setRetryNotice(
        `Retried ${res.retriedCount} recipients.${
          res.blockedCount > 0
            ? ` ${res.blockedCount} recipients are blocked by Meta 24h marketing limit cooldown.`
            : ''
        }`
      );
      loadReportAndRecipients();
    } catch (err: any) {
      setExportError(err.message || 'Failed to trigger retry');
    } finally {
      setIsRetrying(false);
    }
  };

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
      case 'MARKETING_LIMITED':
        return <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-1" /> Marketing Limited</Badge>;
      case 'RATE_LIMITED':
        return <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-1" /> Rate Limited</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral" size="sm">Skipped</Badge>;
      case 'SENDING':
        return <Badge variant="warning" size="sm">Sending...</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const m = report?.metrics;
  const c = report?.campaign;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{c?.name || 'Campaign Report'}</h2>
              {c?.status && renderStatusBadge(c.status)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-4">
              <span>Template: <strong className="text-slate-200 font-mono">{c?.templateName}</strong> ({c?.templateLanguage})</span>
              <span>Header: <strong className="text-slate-200">{c?.headerFormat || 'TEXT'}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Export Error Alert if any */}
          {exportError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between">
              <span>{exportError}</span>
              <button onClick={() => setExportError(null)} className="hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {retryNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
              <span>{retryNotice}</span>
              <button onClick={() => setRetryNotice(null)} className="hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Action Bar / Excel Download Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Campaign Reports & Controls</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Download recipient reports or trigger manual retries for eligible failed items</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Retry Failed Recipients (also covers rate-limited & eligible marketing-limited) */}
              <Button
                variant="outline"
                size="sm"
                disabled={!m || (m.failed === 0 && m.rateLimited === 0 && m.marketingLimited === 0) || isRetrying}
                onClick={handleRetryFailed}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRetrying ? 'animate-spin' : ''}`} />}
              >
                {isRetrying ? 'Processing...' : 'Retry Failed'}
              </Button>

              {/* Download Failed Excel */}
              <Button
                variant="outline"
                size="sm"
                disabled={!m || m.failed === 0 || exportingType !== null}
                onClick={() => handleDownloadExcel('failed')}
                leftIcon={exportingType === 'failed' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Download className="w-3.5 h-3.5 text-rose-400" />}
              >
                {exportingType === 'failed' ? 'Preparing Excel...' : m && m.failed === 0 ? 'No Failed Recipients' : 'Download Failed Excel'}
              </Button>

              {/* Download Successful Excel */}
              <Button
                variant="outline"
                size="sm"
                disabled={!m || m.sent === 0 || exportingType !== null}
                onClick={() => handleDownloadExcel('successful')}
                leftIcon={exportingType === 'successful' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-emerald-400" />}
              >
                {exportingType === 'successful' ? 'Preparing Excel...' : 'Download Successful'}
              </Button>

              {/* Download Complete Report Excel */}
              <Button
                variant="primary"
                size="sm"
                disabled={!m || exportingType !== null}
                onClick={() => handleDownloadExcel('all')}
                leftIcon={exportingType === 'all' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <Download className="w-3.5 h-3.5 text-white" />}
              >
                {exportingType === 'all' ? 'Preparing Excel...' : 'Download Complete Report'}
              </Button>
            </div>
          </div>

          {/* Summary Metrics & Rates Grid */}
          {m && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Total Recipients</span>
                <span className="text-xl font-bold text-white">{m.total}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Sent (API Accepted)</span>
                <span className="text-xl font-bold text-sky-400">{m.sent}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Delivered</span>
                <span className="text-xl font-bold text-emerald-400">{m.delivered}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Read</span>
                <span className="text-xl font-bold text-purple-400">{m.read}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Failed</span>
                <span className="text-xl font-bold text-rose-400">{m.failed}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-amber-400 block">Marketing Limited</span>
                <span className="text-xl font-bold text-amber-400">{m.marketingLimited || 0}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-orange-400 block">Rate Limited</span>
                <span className="text-xl font-bold text-orange-400">{m.rateLimited || 0}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Duration</span>
                <span className="text-xl font-bold text-amber-400 font-mono">{m.durationFormatted}</span>
              </div>
            </div>
          )}

          {/* Delivery Rates Bar Cards */}
          {m && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Delivery Rate (Delivered / Sent)</span>
                  <span className="font-bold text-emerald-400 font-mono">{m.deliveryRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, m.deliveryRate)}%` }} />
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Read Rate (Read / Delivered)</span>
                  <span className="font-bold text-purple-400 font-mono">{m.readRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, m.readRate)}%` }} />
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Failure Rate (Failed / Total)</span>
                  <span className="font-bold text-rose-400 font-mono">{m.failureRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, m.failureRate)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Table Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
              {['', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'MARKETING_LIMITED', 'RATE_LIMITED', 'CANCELLED'].map((st) => (
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
                  {st === '' ? 'ALL' : st === 'CANCELLED' ? 'SKIPPED' : st === 'MARKETING_LIMITED' ? 'MKT LIMITED' : st === 'RATE_LIMITED' ? 'RATE LIMITED' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, phone, or Message ID..."
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
                onClick={loadReportAndRecipients}
                disabled={loading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Paginated Recipients Table */}
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
                  <th className="py-3 px-4">Error / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No matching recipients found in campaign report.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        {r.contactId?.name || 'Contact'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{r.phone}</td>
                      <td className="py-3 px-4">{renderStatusBadge(r.status)}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-[140px] truncate" title={r.whatsappMessageId || '-'}>
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
                      <td
                        className="py-3 px-4 text-rose-400 max-w-xs truncate"
                        title={
                          r.errorCode === '131049' || (r.errorReason || '').includes('healthy ecosystem engagement')
                            ? 'Not delivered — Meta marketing delivery limit (24h cooldown)'
                            : r.errorReason || '-'
                        }
                      >
                        {r.errorCode === '131049' || (r.errorReason || '').includes('healthy ecosystem engagement')
                          ? 'Not delivered — Meta marketing delivery limit'
                          : r.errorReason || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Pagination */}
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
