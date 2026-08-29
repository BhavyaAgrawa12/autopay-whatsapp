import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ListFilter,
  Send,
  FileCode2,
  Building2,
  FolderArchive,
  BarChart3,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/contact-lists', label: 'Contact Lists', icon: ListFilter },
  { path: '/campaigns', label: 'Campaigns', icon: Send },
  { path: '/templates', label: 'Templates', icon: FileCode2 },
  { path: '/company', label: 'Company', icon: Building2 },
  { path: '/company-assets', label: 'Company Assets', icon: FolderArchive },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-200 block">Single Account Mode</span>
              <span className="text-[11px] text-slate-500">Phase 1 Foundation</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
