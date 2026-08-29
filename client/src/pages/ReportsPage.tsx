import React, { useState } from 'react';
import { BarChart3, FileSpreadsheet, FileCode2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useCampaigns } from '../context/CampaignContext';
import { Campaign } from '../types/campaign';
import { CampaignReportView } from '../components/campaigns/CampaignReportView';

export const ReportsPage: React.FC = () => {
  const { campaigns } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'RUNNING':
        return <Badge variant="info" size="sm">Running...</Badge>;
      case 'PAUSED':
        return <Badge variant="warning" size="sm">Paused</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Reports & Analytics"
        description="Comprehensive delivery tracking, status metrics, and Excel (.xlsx) export center."
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No Campaign Reports Available"
          description="Create and execute a WhatsApp campaign to generate real-time delivery and read reports."
          actionLabel="Go to Campaign Builder"
          onAction={() => window.location.href = '/campaigns'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
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
                  {renderStatusBadge(campaign.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-3">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Eligible Audience</span>
                    <span className="font-bold text-emerald-400">{campaign.audience?.eligibleCount ?? 0} contacts</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Header Format</span>
                    <span className="font-bold text-slate-200">{campaign.headerConfig?.format || 'TEXT'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Created {new Date(campaign.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSelectedCampaign(campaign)}
                  leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-white" />}
                >
                  Open Report & Excel
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedCampaign && (
        <CampaignReportView
          campaignId={selectedCampaign.id}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
};
