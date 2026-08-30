import React, { useState } from 'react';
import { X, Send, FileText, AlertTriangle } from 'lucide-react';
import { ApprovedTemplate } from '../../types/inbox';

interface TemplateSelectModalProps {
  isOpen: boolean;
  templates: ApprovedTemplate[];
  onClose: () => void;
  onSendTemplate: (templateName: string, languageCode: string, variables?: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
}

export const TemplateSelectModal: React.FC<TemplateSelectModalProps> = ({
  isOpen,
  templates,
  onClose,
  onSendTemplate,
  isLoading = false,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovedTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleSelect = (template: ApprovedTemplate) => {
    setSelectedTemplate(template);
    setErrorMsg('');
    const initialVars: Record<string, string> = {};
    (template.variables || []).forEach((_, idx) => {
      initialVars[`${idx + 1}`] = '';
    });
    setVariableValues(initialVars);
  };

  const handleVarChange = (key: string, val: string) => {
    setVariableValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      setErrorMsg('Please select a template');
      return;
    }

    try {
      setErrorMsg('');
      await onSendTemplate(selectedTemplate.name, selectedTemplate.language, variableValues);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send template');
    }
  };

  // Generate preview text replacing variables
  const getPreviewText = () => {
    if (!selectedTemplate) return '';
    let body = selectedTemplate.bodyText || '';
    Object.entries(variableValues).forEach(([idx, val]) => {
      const placeholder = `{{${idx}}}`;
      body = body.split(placeholder).join(val.trim() || `[${placeholder}]`);
    });
    return body;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">Send WhatsApp Template</h3>
              <p className="text-xs text-slate-400">Customer service window expired. Select an approved template to reply.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3 text-rose-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Template Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select Approved Template ({templates.length})
            </label>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                No approved templates found. Please create and submit a template for Meta approval first.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelect(tpl)}
                      className={`p-3 text-left rounded-lg border transition-all text-xs ${
                        isSelected
                          ? 'bg-emerald-600/15 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 truncate">{tpl.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded uppercase">{tpl.language}</span>
                        <span>{tpl.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTemplate && (
            <>
              {/* Template Variables Inputs */}
              {(selectedTemplate.variables || []).length > 0 && (
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-lg border border-slate-800">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Template Variables
                  </label>
                  {selectedTemplate.variables.map((_, idx) => {
                    const key = `${idx + 1}`;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-emerald-400 w-14 shrink-0 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-center">
                          {`{{${key}}}`}
                        </span>
                        <input
                          type="text"
                          required
                          value={variableValues[key] || ''}
                          onChange={(e) => handleVarChange(key, e.target.value)}
                          placeholder={`Enter value for variable ${key}`}
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Message Live Preview */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Message Preview
                </label>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-sm space-y-2">
                  {selectedTemplate.headerType && selectedTemplate.headerType !== 'NONE' && (
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-800">
                      [{selectedTemplate.headerType} HEADER]
                    </div>
                  )}
                  <div className="text-sm text-slate-200 whitespace-pre-wrap">{getPreviewText()}</div>
                  {selectedTemplate.footerText && (
                    <div className="text-xs text-slate-500 pt-1 border-t border-slate-800/60">
                      {selectedTemplate.footerText}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedTemplate || isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Sending...' : 'Send Template Reply'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
