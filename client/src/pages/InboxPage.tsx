import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchConversationsApi,
  fetchConversationMessagesApi,
  sendOutboundMessageApi,
  markConversationReadApi,
  fetchApprovedTemplatesApi,
} from '../api/inbox';
import { ConversationItem, MessageItem, ApprovedTemplate } from '../types/inbox';
import { ConversationList } from '../components/inbox/ConversationList';
import { ChatWindow } from '../components/inbox/ChatWindow';
import { TemplateSelectModal } from '../components/inbox/TemplateSelectModal';
import { MessageSquare } from 'lucide-react';

export const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [templates, setTemplates] = useState<ApprovedTemplate[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Pagination for messages
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Load conversations list
  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoadingConversations(true);
      const res = await fetchConversationsApi({ search: searchTerm, filter, limit: 50 });
      setConversations(res.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  }, [searchTerm, filter]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetchApprovedTemplatesApi();
      setTemplates(res || []);
    } catch (err) {
      console.error('Failed to load approved templates', err);
    }
  }, []);

  // Initial load & Polling
  useEffect(() => {
    loadConversations();
    loadTemplates();

    const interval = setInterval(() => {
      loadConversations(true);
    }, 4000); // 4-second polling

    return () => clearInterval(interval);
  }, [loadConversations, loadTemplates]);

  // Load active conversation messages
  const loadMessages = useCallback(async (convId: string, page = 1, appendOlder = false) => {
    try {
      if (appendOlder) setIsLoadingOlder(true);

      const res = await fetchConversationMessagesApi(convId, { page, limit: 50 });

      if (appendOlder) {
        setMessages((prev) => [...res.messages, ...prev]);
      } else {
        setMessages(res.messages || []);
      }

      setHasMoreMessages(res.messages.length >= 50);
      setMessagePage(page);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, []);

  // Active conversation background polling
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      fetchConversationMessagesApi(selectedConversation._id, { page: 1, limit: 50 })
        .then((res) => {
          setMessages(res.messages || []);
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  // Handle selecting a conversation
  const handleSelectConversation = async (conv: ConversationItem) => {
    setSelectedConversation(conv);
    loadMessages(conv._id, 1, false);

    // Mark read if unread
    if (conv.unreadCount > 0) {
      try {
        const updated = await markConversationReadApi(conv._id);
        setConversations((prev) =>
          prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
        );
        setSelectedConversation(updated);
      } catch (err) {
        console.error('Failed marking conversation read', err);
      }
    }
  };

  // Send Outbound Text Reply
  const handleSendMessage = async (text: string) => {
    if (!selectedConversation) return;
    const res = await sendOutboundMessageApi(selectedConversation._id, { text });
    setMessages((prev) => [...prev, res.message]);
    setSelectedConversation(res.conversation);
    loadConversations(true);
  };

  // Send Outbound Template Reply
  const handleSendTemplate = async (templateName: string, languageCode: string, variables?: Record<string, string>) => {
    if (!selectedConversation) return;
    const res = await sendOutboundMessageApi(selectedConversation._id, {
      templateName,
      languageCode,
      variables,
    });
    setMessages((prev) => [...prev, res.message]);
    setSelectedConversation(res.conversation);
    loadConversations(true);
  };

  // Load older messages
  const handleLoadOlder = () => {
    if (!selectedConversation || isLoadingOlder) return;
    loadMessages(selectedConversation._id, messagePage + 1, true);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-950">
      {/* Sidebar List (Full width on mobile when no chat selected, 320px on desktop) */}
      <div
        className={`w-full lg:w-80 shrink-0 h-full ${
          selectedConversation ? 'hidden lg:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?._id || null}
          onSelect={handleSelectConversation}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filter={filter}
          onFilterChange={setFilter}
          isLoading={isLoadingConversations}
        />
      </div>

      {/* Main Chat Area */}
      <div
        className={`flex-1 h-full ${
          !selectedConversation ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <div className="w-full h-full">
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              onBackMobile={() => setSelectedConversation(null)}
              onSendMessage={handleSendMessage}
              onSendTemplate={handleSendTemplate}
              onLoadOlder={handleLoadOlder}
              hasMore={hasMoreMessages}
              isLoadingOlder={isLoadingOlder}
              templates={templates}
              onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
              onRefresh={() => loadMessages(selectedConversation._id, 1, false)}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-8 text-center">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4 text-emerald-400">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-200 mb-1">Two-Way WhatsApp Inbox</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Select a conversation from the left panel to view customer messages and send real-time replies.
            </p>
          </div>
        )}
      </div>

      {/* Template Selection Modal */}
      {selectedConversation && (
        <TemplateSelectModal
          isOpen={isTemplateModalOpen}
          templates={templates}
          onClose={() => setIsTemplateModalOpen(false)}
          onSendTemplate={handleSendTemplate}
        />
      )}
    </div>
  );
};
