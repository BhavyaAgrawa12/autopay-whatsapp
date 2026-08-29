import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Plus,
  Edit2,
  Copy,
  Trash2,
  AlertCircle,
  FileCode2,
  Play,
  Pause,
  XCircle,
  Users,
  BarChart2,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useCampaigns } from '../context/CampaignContext';
import { Campaign } from '../types/campaign';
import {
  pauseCampaignApi,
  resumeCampaignApi,
  cancelCampaignApi,
  fetchCampaignProgressApi,
  CampaignProgressData,
} from '../api/campaigns';
import { CampaignStartModal } from '../components/campaigns/CampaignStartModal';
import { CampaignRecipientsModal } from '../components/campaigns/CampaignRecipientsModal';
import { CampaignReportView } from '../components/campaigns/CampaignReportView';

export const CampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaigns, duplicateCampaign, deleteCampaign } = useCampaigns();

  // Progress polling store for campaign executions
  const [progressMap, setProgressMap] = useState<Record<string, CampaignProgressData>>({});
  const [startModalCampaign, setStartModalCampaign] = useState<Campaign | null>(null);
  const [recipientsModalCampaign, setRecipientsModalCampaign] = useState<Campaign | null>(null);
  const [reportModalCampaign, setReportModalCampaign] = useState<Campaign | null>(null);

  // Poll progress for active campaigns every 2 seconds
  useEffect(() => {
    const pollActiveCampaigns = async () => {
      for (const campaign of campaigns) {
        try {
          const prog = await fetchCampaignProgressApi(campaign.id);
          setProgressMap((prev) => ({
            ...prev,
            [campaign.id]: prog,
          }));
        } catch {
          // Ignore polling errors for inactive campaigns
        }
      }
    };

    pollActiveCampaigns();
    const interval = setInterval(pollActiveCampaigns, 2000);
    return () => clearInterval(interval);
  }, [campaigns]);

  const handlePause = async (campaignId: string) => {
    try {
      await pauseCampaignApi(campaignId);
    } catch (err: any) {
      alert(err.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async (campaignId: string) => {
    try {
      await resumeCampaignApi(campaignId);
    } catch (err: any) {
      alert(err.message || 'Failed to resume campaign');
    }
  };

  const handleCancel = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to cancel this campaign? Queued jobs will be discarded.')) return;
    try {
      await cancelCampaignApi(campaignId);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel campaign');
    }
  };

  const handleDuplicate = async (id: string) => {
    const dup = await duplicateCampaign(id);
    if (dup) {
      navigate(`/campaigns/edit/${dup.id || (dup as any).campaignId}`);
    }
  };

  const getEffectiveStatus = (campaign: Campaign): string => {
    const prog = progressMap[campaign.id];
    if (prog && prog.status && prog.status !== 'READY') {
      return prog.status;
    }
    return campaign.status;
  };

  const renderStatusBadge = (effectiveStatus: string) => {
    switch (effectiveStatus) {
      case 'RUNNING':
        return <Badge variant="info">RUNNING</Badge>;
      case 'PAUSED':
        return <Badge variant="warning">PAUSED</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED ✓</Badge>;
      case 'CANCELLED':
        return <Badge variant="error">CANCELLED</Badge>;
      case 'READY':
        return <Badge variant="success">READY</Badge>;
      case 'TESTED':
        return <Badge variant="info">TESTED</Badge>;
      default:
        return <Badge variant="neutral">DRAFT</Badge>;
    }
  };

  const draftCount = campaigns.filter((c) => c.status === 'DRAFT').length;
  const readyCount = campaigns.filter((c) => c.status === 'READY').length;
  const activeCount = Object.values(progressMap).filter((p) => p.status === 'RUNNING' || p.status === 'QUEUED').length;

  return (
    <div>
      <PageHeader
        title="Promotional Campaign Management"
        description="Session-based campaign workflow: build, configure variables, preview, test, and execute bulk broadcasts."
        badge={<Badge variant="success">BullMQ Queue Engine Active</Badge>}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/campaigns/new')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New Campaign
          </Button>
        }
      />

      {/* Session Lifetime Notice Banner */}
      <div className="mb-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3 text-xs leading-relaxed text-slate-300 shadow-md">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">Session Runtime Data Architecture</span>
          <span>
            In accordance with the <strong>Zero Database</strong> rule, campaign execution state and logs exist in current-session runtime memory (`CampaignRunStore`).
          </span>
        </div>
      </div>

      {/* Campaign Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <span className="text-xs text-slate-400 font-medium block">Total Campaigns</span>
          <span className="text-2xl font-bold text-white mt-1 block">{campaigns.length}</span>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-slate-400 font-medium block">Draft Campaigns</span>
          <span className="text-2xl font-bold text-slate-300 mt-1 block">{draftCount}</span>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-slate-400 font-medium block">Active Running</span>
          <span className="text-2xl font-bold text-sky-400 mt-1 block">{activeCount}</span>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-slate-400 font-medium block">Ready for Dispatch</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1 block">{readyCount}</span>
        </Card>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No Active Campaigns Created"
          description="Build your first promotional WhatsApp campaign using Excel contacts, company media assets, and Meta-approved templates."
          actionLabel="Create New Campaign"
          onAction={() => navigate('/campaigns/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((campaign) => {
            const prog = progressMap[campaign.id];
            const effStatus = getEffectiveStatus(campaign);
            const isRunning = effStatus === 'RUNNING' || effStatus === 'QUEUED';
            const isPaused = effStatus === 'PAUSED';

            const percent = prog && prog.total > 0 ? Math.round((prog.processed / prog.total) * 100) : 0;

            return (
              <Card key={campaign.id} variant="bordered" className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-white text-base">{campaign.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Template: <strong className="text-slate-200 font-mono">{campaign.templateName}</strong></span>
                      </div>
                    </div>
                    {renderStatusBadge(effStatus)}
                  </div>

                  {/* Progress Metrics & Bar if active or processed */}
                  {prog && prog.total > 0 && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-semibold">
                        <span>Progress: {prog.processed} / {prog.total} ({percent}%)</span>
                        <span className="text-[11px] text-emerald-400 font-mono">
                          Sent: {prog.sent} | Delivered: {prog.delivered || 0} | Read: {prog.read || 0} | Failed: {prog.failed}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-purple-400 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-3">
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Eligible Audience</span>
                      <span className="font-bold text-emerald-400">{campaign.audience?.eligibleCount ?? 0} contacts</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Header Component</span>
                      <span className="font-bold text-slate-200">{campaign.headerConfig?.format || 'TEXT'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecipientsModalCampaign(campaign)}
                      leftIcon={<Users className="w-3.5 h-3.5 text-purple-400" />}
                    >
                      Recipients & Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportModalCampaign(campaign)}
                      leftIcon={<BarChart2 className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      View Report
                    </Button>
                    {/* Execution Controls */}
                    {isRunning && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePause(campaign.id)}
                        leftIcon={<Pause className="w-3.5 h-3.5" />}
                      >
                        Pause
                      </Button>
                    )}

                    {isPaused && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleResume(campaign.id)}
                        leftIcon={<Play className="w-3.5 h-3.5" />}
                      >
                        Resume
                      </Button>
                    )}

                    {(isRunning || isPaused) && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancel(campaign.id)}
                        leftIcon={<XCircle className="w-3.5 h-3.5" />}
                      >
                        Cancel
                      </Button>
                    )}

                    {!isRunning && !isPaused && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setStartModalCampaign(campaign)}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Start Campaign
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(campaign.id)}
                      leftIcon={<Copy className="w-3.5 h-3.5" />}
                    >
                      Duplicate
                    </Button>
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                      title="Delete campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Start Bulk Campaign Confirmation Modal */}
      <CampaignStartModal
        campaign={startModalCampaign}
        isOpen={!!startModalCampaign}
        onClose={() => setStartModalCampaign(null)}
      />

      {/* Recipient Delivery & Webhooks Modal */}
      {recipientsModalCampaign && (
        <CampaignRecipientsModal
          campaignId={recipientsModalCampaign.id}
          campaignName={recipientsModalCampaign.name}
          onClose={() => setRecipientsModalCampaign(null)}
        />
      )}

      {/* Full Campaign Report & Excel Export Modal */}
      {reportModalCampaign && (
        <CampaignReportView
          campaignId={reportModalCampaign.id}
          onClose={() => setReportModalCampaign(null)}
        />
      )}
    </div>
  );
};
