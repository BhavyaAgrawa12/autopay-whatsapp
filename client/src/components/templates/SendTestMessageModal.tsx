import React, { useState } from 'react';
import { Send, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { WATemplate } from '../../types/whatsapp';
import { sendTestMessageApi } from '../../api/whatsapp';

interface SendTestMessageModalProps {
  template: WATemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SendTestMessageModal: React.FC<SendTestMessageModalProps> = ({
  template,
  isOpen,
  onClose,
}) => {
  const [recipientPhone, setRecipientPhone] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !template) return null;

  const handleVariableChange = (varKey: string, val: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [varKey]: val,
    }));
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!recipientPhone.trim()) {
      setErrorMessage('Recipient phone number is required.');
      return;
    }

    setIsSending(true);

    try {
      const res = await sendTestMessageApi({
        recipientPhone: recipientPhone.trim(),
        templateName: template.name,
        languageCode: template.language,
        variables: variableValues,
      });

      setSuccessMessage(`Test message sent successfully! Message ID: ${res.messageId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send test message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Send Single Test Message</h3>
              <p className="text-xs text-slate-400">Template: <code className="text-emerald-400">{template.name}</code> ({template.language})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-3 text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-100">Single Test Dispatch</span>
            <span>This sends one real WhatsApp message to the specified phone number via the official WhatsApp Business Cloud API.</span>
          </div>
        </div>

        {errorMessage && <ErrorAlert message={errorMessage} />}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSendTest} className="space-y-4 text-xs">
          {/* Phone Number Input */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Recipient International Phone Number *
            </label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="e.g. +919876543210 or 919876543210"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Template Body Variables Input */}
          {template.variables && template.variables.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Template Body Parameters ({template.variables.length})
              </h4>
              <div className="space-y-2">
                {template.variables.map((vKey, idx) => (
                  <div key={vKey} className="flex items-center gap-2">
                    <span className="w-12 font-mono font-bold text-emerald-400 text-[11px] shrink-0">{vKey}:</span>
                    <input
                      type="text"
                      value={variableValues[vKey] || ''}
                      onChange={(e) => handleVariableChange(vKey, e.target.value)}
                      placeholder={`Value for ${vKey} (e.g. Parameter ${idx + 1})`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSending}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Test Message Now
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
