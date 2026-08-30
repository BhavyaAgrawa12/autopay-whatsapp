import React, { useState } from 'react';
import { Send, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Campaign } from '../../types/campaign';
import { startCampaignApi } from '../../api/campaigns';
import { useContacts } from '../../context/ContactContext';
import { useCampaigns } from '../../context/CampaignContext';

interface CampaignStartModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CampaignStartModal: React.FC<CampaignStartModalProps> = ({
  campaign,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { contacts: sessionContacts } = useContacts();
  const { updateCampaignStatus, saveCampaign } = useCampaigns();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !campaign) return null;

  const selectedSet = new Set(campaign.audience?.selectedContactIds || []);
  const recipientContacts = sessionContacts.filter((c) => selectedSet.has(c.id || (c as any)._id));

  const handleStartCampaign = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Ensure campaign record is persisted to MongoDB database first
      const savedCampaign = await saveCampaign({
        ...campaign,
        status: 'READY',
      });

      const targetId = savedCampaign?.campaignId || savedCampaign?.id || campaign.campaignId || campaign.id;

      // 2. Execute bulk dispatch engine
      await startCampaignApi(targetId, {
        campaignName: campaign.name,
        templateName: campaign.templateName,
        templateLanguage: campaign.templateLanguage,
        headerConfig: campaign.headerConfig,
        variableMappings: campaign.variableMappings,
        recipients: recipientContacts.length > 0 ? recipientContacts : undefined,
      });

      updateCampaignStatus(targetId, 'RUNNING');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start bulk campaign engine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTested = campaign.status === 'TESTED' || !!campaign.testedAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Confirm Bulk Campaign Launch</h3>
              <p className="text-xs text-slate-400">Official WhatsApp Business Cloud API Engine</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strong Warning Banner */}
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200 text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-rose-100 mb-0.5">Real WhatsApp Message Dispatch</span>
            <span>
              This operation will send <strong>{campaign.audience.eligibleCount} real WhatsApp messages</strong> to eligible contacts using the configured WhatsApp Business Cloud API and the controlled campaign sending engine. This operation cannot be undone once started.
            </span>
          </div>
        </div>

        {/* Test Status Check */}
        {!isTested ? (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center gap-2.5 text-xs text-amber-300 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Warning: No successful test message has been sent for this campaign.</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Test Status: Single test message sent successfully ✓</span>
          </div>
        )}

        {errorMessage && <ErrorAlert message={errorMessage} />}

        {/* Campaign Breakdown Table */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Campaign Name:</span>
            <strong className="text-white font-semibold">{campaign.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Template Name:</span>
            <strong className="text-emerald-400 font-mono">{campaign.templateName} ({campaign.templateLanguage})</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Eligible Recipients:</span>
            <strong className="text-emerald-400 font-bold">{campaign.audience.eligibleCount} contacts</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Excluded (Opted-out/Unknown):</span>
            <strong className="text-slate-400">{campaign.audience.excludedCount} contacts</strong>
          </div>
          {campaign.headerConfig.assetFilename && (
            <div className="flex justify-between pt-1 border-t border-slate-800/60">
              <span className="text-slate-400">Header Asset:</span>
              <strong className="text-slate-200">{campaign.headerConfig.assetFilename}</strong>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleStartCampaign}
            leftIcon={<Send className="w-4 h-4" />}
          >
            START CAMPAIGN NOW
          </Button>
        </div>
      </div>
    </div>
  );
};
