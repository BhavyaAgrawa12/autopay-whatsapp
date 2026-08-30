import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  ShieldCheck,
  FileText,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { ConversationItem, MessageItem, ApprovedTemplate } from '../../types/inbox';

interface ChatWindowProps {
  conversation: ConversationItem;
  messages: MessageItem[];
  onBackMobile?: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onSendTemplate: (templateName: string, languageCode: string, variables?: Record<string, string>) => Promise<void>;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  templates: ApprovedTemplate[];
  onOpenTemplateModal: () => void;
  onRefresh?: () => void;
}

function formatMessageTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  onBackMobile,
  onSendMessage,
  onLoadOlder,
  hasMore = false,
  isLoadingOlder = false,
  onOpenTemplateModal,
  onRefresh,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const windowExpiry = conversation.messagingWindowExpiresAt
    ? new Date(conversation.messagingWindowExpiresAt)
    : null;
  const isWindowActive = windowExpiry ? windowExpiry.getTime() > now.getTime() : false;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSendError('');
      await onSendMessage(inputText.trim());
      setInputText('');
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusIcon = (msg: MessageItem) => {
    if (msg.direction === 'INBOUND') return null;

    switch (msg.status) {
      case 'SENT':
        return (
          <span title="Sent">
            <Check className="w-3.5 h-3.5 text-slate-400" />
          </span>
        );
      case 'DELIVERED':
        return (
          <span title="Delivered">
            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
          </span>
        );
      case 'READ':
        return (
          <span title="Read">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-rose-400 text-[10px]" title={msg.errorMessage || 'Failed'}>
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-200 font-bold">
            {conversation.displayName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm">{conversation.displayName}</h3>
              {conversation.contactId && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                  <UserCheck className="w-3 h-3" />
                  Contact
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">+{conversation.phoneNumber}</p>
          </div>
        </div>

        {/* Messaging Window Indicator & Refresh */}
        <div className="flex items-center gap-3">
          {isWindowActive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>24h Service Window Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Service Window Expired</span>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {hasMore && (
          <div className="text-center pb-2">
            <button
              onClick={onLoadOlder}
              disabled={isLoadingOlder}
              className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              {isLoadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <ShieldCheck className="w-10 h-10 text-slate-700 mb-2" />
            <p>No messages in this conversation yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === 'INBOUND';

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm space-y-1 ${
                    isInbound
                      ? 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                      : 'bg-emerald-950/80 text-slate-100 rounded-tr-none border border-emerald-800/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-slate-400">
                    <span>{formatMessageTime(msg.sentAt)}</span>
                    {renderStatusIcon(msg)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        {sendError && (
          <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center justify-between">
            <span>{sendError}</span>
            <button onClick={() => setSendError('')} className="text-slate-400 hover:text-slate-200">
              Dismiss
            </button>
          </div>
        )}

        {isWindowActive ? (
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your reply message..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-amber-300 text-xs">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Customer service 24-hour window has expired. Meta policy requires sending an approved template.</span>
            </div>
            <button
              onClick={onOpenTemplateModal}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors shrink-0 shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Send Template</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
