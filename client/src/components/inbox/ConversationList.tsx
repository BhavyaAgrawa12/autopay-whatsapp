import React from 'react';
import { Search, User, Filter } from 'lucide-react';
import { ConversationItem } from '../../types/inbox';

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (conv: ConversationItem) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  filter: 'all' | 'unread';
  onFilterChange: (filter: 'all' | 'unread') => void;
  isLoading?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  filter,
  onFilterChange,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Inbox
            {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-semibold">
                {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)} unread
              </span>
            )}
          </h2>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, phone, message..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <button
            onClick={() => onFilterChange('all')}
            className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Messages
          </button>
          <button
            onClick={() => onFilterChange('unread')}
            className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            Unread Only
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {isLoading && conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {searchTerm ? 'No conversations matching search' : 'No conversations found'}
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedId === conv._id;
            const hasUnread = conv.unreadCount > 0;

            return (
              <button
                key={conv._id}
                onClick={() => onSelect(conv)}
                className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors ${
                  isSelected
                    ? 'bg-slate-800/90 border-l-4 border-emerald-500'
                    : 'hover:bg-slate-800/40 border-l-4 border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 font-bold text-sm">
                    {conv.contactId ? (
                      conv.displayName.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs truncate ${
                        hasUnread ? 'font-bold text-slate-100' : 'font-semibold text-slate-200'
                      }`}
                    >
                      {conv.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>

                  <p
                    className={`text-xs truncate ${
                      hasUnread ? 'text-slate-200 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {conv.lastMessage || 'No messages yet'}
                  </p>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      +{conv.phoneNumber}
                    </span>
                    {hasUnread && (
                      <span className="bg-emerald-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
