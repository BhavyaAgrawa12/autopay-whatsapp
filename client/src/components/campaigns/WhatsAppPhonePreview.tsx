import React from 'react';
import {
  PhoneCall,
  ExternalLink,
  CornerUpLeft,
  FileText,
  Video,
  CheckCheck,
  ShieldCheck,
} from 'lucide-react';
import { HeaderConfig } from '../../types/campaign';
import { WATemplateComponent } from '../../types/whatsapp';

interface WhatsAppPhonePreviewProps {
  headerConfig: HeaderConfig;
  renderedBodyText: string;
  components: WATemplateComponent[];
  companyName?: string;
}

export const WhatsAppPhonePreview: React.FC<WhatsAppPhonePreviewProps> = ({
  headerConfig,
  renderedBodyText,
  components,
  companyName = 'AutoPay Tech',
}) => {
  const footerComp = components.find((c) => c.type === 'FOOTER');
  const buttonsComp = components.find((c) => c.type === 'BUTTONS');

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-900 border-4 border-slate-800 rounded-[36px] overflow-hidden shadow-2xl flex flex-col h-[580px] selection:bg-none">
      {/* Mobile Phone Status Bar */}
      <div className="bg-[#075e54] px-6 py-2 text-[10px] font-semibold text-white/90 flex justify-between items-center select-none">
        <span>9:41 AM</span>
        <div className="flex items-center gap-1.5">
          <span>5G</span>
          <span>100%</span>
        </div>
      </div>

      {/* WhatsApp Header Bar */}
      <div className="bg-[#075e54] px-4 py-3 text-white flex items-center gap-3 shadow-md border-b border-[#054c44]">
        <div className="w-9 h-9 rounded-full bg-emerald-600 border border-emerald-400/40 flex items-center justify-center font-bold text-xs shadow-inner">
          WA
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-xs truncate leading-tight">{companyName}</h4>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          </div>
          <span className="text-[10px] text-emerald-100/80 block leading-tight">Official Business Account</span>
        </div>
      </div>

      {/* WhatsApp Chat Wall Background */}
      <div className="flex-1 bg-[#0b141a] p-4 overflow-y-auto space-y-3 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Date Badge */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-lg bg-[#182229] text-[10px] font-medium text-[#8696a0] shadow-sm">
            TODAY
          </span>
        </div>

        {/* WhatsApp Message Card Bubble */}
        <div className="bg-[#202c33] border border-[#233138] rounded-xl overflow-hidden shadow-xl text-slate-100 max-w-[92%] ml-auto">
          {/* Header Component Rendering */}
          {headerConfig.format === 'IMAGE' && (
            <div className="w-full h-44 bg-[#111b21] flex items-center justify-center overflow-hidden border-b border-[#233138]">
              {headerConfig.assetId || headerConfig.assetUrl ? (
                <img
                  src={
                    headerConfig.assetId
                      ? `/api/company/assets/${headerConfig.assetId}/file`
                      : headerConfig.assetUrl!
                  }
                  alt="Header"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4 text-slate-500">
                  <span className="text-xs font-semibold block">[ Promotional Image Header ]</span>
                  <span className="text-[10px]">Image will render here</span>
                </div>
              )}
            </div>
          )}

          {headerConfig.format === 'VIDEO' && (
            <div className="w-full h-40 bg-[#111b21] flex flex-col items-center justify-center text-sky-400 border-b border-[#233138] p-4">
              <Video className="w-10 h-10 mb-1" />
              <span className="text-xs font-semibold text-slate-300">
                {headerConfig.assetFilename || 'Promotional Video Header'}
              </span>
            </div>
          )}

          {headerConfig.format === 'DOCUMENT' && (
            <div className="p-3 bg-[#182229] border-b border-[#233138] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#202c33] text-amber-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">
                  {headerConfig.assetFilename || 'Document Header'}
                </span>
                <span className="text-[10px] text-[#8696a0]">PDF Document</span>
              </div>
            </div>
          )}

          {headerConfig.format === 'TEXT' && headerConfig.textValue && (
            <div className="px-3 py-2 font-bold text-xs text-white border-b border-[#233138]">
              {headerConfig.textValue}
            </div>
          )}

          {/* Body Text Component */}
          <div className="p-3.5 space-y-2 text-xs leading-relaxed text-slate-100 whitespace-pre-wrap font-sans">
            {renderedBodyText || 'Message body text...'}
            <div className="flex justify-end items-center gap-1 pt-1 text-[9px] text-[#8696a0]">
              <span>9:41 AM</span>
              <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>

          {/* Footer Component */}
          {footerComp?.text && (
            <div className="px-3.5 pb-3 text-[11px] text-[#8696a0] italic border-t border-[#233138]/60 pt-2">
              {footerComp.text}
            </div>
          )}

          {/* WhatsApp Interactive Action Buttons */}
          {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
            <div className="border-t border-[#233138] divide-y divide-[#233138] bg-[#182229]">
              {buttonsComp.buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 text-center text-xs font-semibold text-[#00a884] flex items-center justify-center gap-2 hover:bg-[#202c33] cursor-pointer transition-colors"
                >
                  {btn.type === 'PHONE_NUMBER' && <PhoneCall className="w-3.5 h-3.5" />}
                  {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5" />}
                  {btn.type === 'QUICK_REPLY' && <CornerUpLeft className="w-3.5 h-3.5" />}
                  <span>{btn.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Footer Decorator */}
      <div className="bg-[#111b21] p-3 text-center border-t border-[#233138]">
        <div className="w-32 h-1 rounded-full bg-slate-700 mx-auto"></div>
      </div>
    </div>
  );
};
