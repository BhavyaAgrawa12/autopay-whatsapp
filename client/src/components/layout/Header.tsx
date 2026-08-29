import React, { useEffect, useState } from 'react';
import { ShieldCheck, Server, Menu, X, LogOut, User } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { fetchHealthStatus } from '../../api/health';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, isMobileMenuOpen }) => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchHealthStatus()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950/50">
            <span className="font-extrabold text-white text-base">WA</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-wide">Autopay Tech</h2>
            <p className="text-[11px] text-slate-400 font-medium">WhatsApp Campaign Manager</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Verified Account Banner Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-300 font-semibold">1 Verified WhatsApp Account</span>
        </div>

        {/* Backend Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-300 font-medium">Backend:</span>
          {backendStatus === 'checking' && (
            <Badge variant="neutral" size="sm">Checking...</Badge>
          )}
          {backendStatus === 'online' && (
            <Badge variant="success" size="sm">Online</Badge>
          )}
          {backendStatus === 'offline' && (
            <Badge variant="error" size="sm">Offline</Badge>
          )}
        </div>

        {/* User Profile Badge & Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 text-xs text-slate-300 border border-slate-700/80">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
              title="Log out of console"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
