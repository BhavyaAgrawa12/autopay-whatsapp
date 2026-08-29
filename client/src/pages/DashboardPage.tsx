import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldCheck,
  Activity,
  CheckCircle2,
  Send,
  Users,
  FileCode2,
  Building2,
  Server,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { fetchHealthStatus } from '../api/health';
import { HealthResponse } from '../types';

export const DashboardPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealthStatus();
      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div>
      <PageHeader
        title="System Overview"
        description="IT Company WhatsApp Promotional Campaign Management Foundation"
        badge={<Badge variant="info">Phase 1 Foundation</Badge>}
        actions={
          <Button variant="outline" size="sm" onClick={loadHealth} leftIcon={<Activity className="w-4 h-4" />}>
            Check Backend Status
          </Button>
        }
      />

      {/* Account Verification & Setup Banner */}
      <Card variant="glass" className="mb-6 border-emerald-800/40 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Verified WhatsApp Business Account</h3>
                <Badge variant="success">Verified</Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Configured for single IT company promotional operations. Infrastructure ready for future campaign dispatching.
              </p>
            </div>
          </div>
          <NavLink to="/company">
            <Button variant="secondary" size="sm" rightIcon={<Building2 className="w-4 h-4" />}>
              View Company Profile
            </Button>
          </NavLink>
        </div>
      </Card>

      {/* System Health Section */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          Backend API Health Status
        </h3>

        {loading && <LoadingSpinner label="Connecting to REST API..." />}

        {error && (
          <ErrorAlert
            title="Backend Connection Failed"
            message={`Unable to contact http://localhost:5000/api/health: ${error}`}
            onRetry={loadHealth}
          />
        )}

        {healthData && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Service Status</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-emerald-400 uppercase tracking-wide">
                {healthData.data.status}
              </p>
              <span className="text-[11px] text-slate-500">API Endpoint Responsive</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Uptime</span>
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-xl font-bold text-white">
                {healthData.data.uptime} seconds
              </p>
              <span className="text-[11px] text-slate-500">Node process runtime</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Environment</span>
                <Badge variant="info" size="sm">{healthData.data.environment}</Badge>
              </div>
              <p className="text-xl font-bold text-white capitalize">
                {healthData.data.environment}
              </p>
              <span className="text-[11px] text-slate-500">Express configuration</span>
            </Card>

            <Card>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">API Version</span>
                <span className="text-xs font-semibold text-slate-400">v{healthData.data.version}</span>
              </div>
              <p className="text-xl font-bold text-white">
                v{healthData.data.version}
              </p>
              <span className="text-[11px] text-slate-500">System release version</span>
            </Card>
          </div>
        )}
      </div>

      {/* Module Shortcuts Grid */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Management Modules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NavLink to="/contacts" className="group">
            <Card variant="bordered" className="h-full group-hover:border-emerald-500/50 transition-colors">
              <Users className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Contacts</h4>
              <p className="text-xs text-slate-400 mt-1">Manage single company customer target contacts.</p>
            </Card>
          </NavLink>

          <NavLink to="/campaigns" className="group">
            <Card variant="bordered" className="h-full group-hover:border-emerald-500/50 transition-colors">
              <Send className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Campaigns</h4>
              <p className="text-xs text-slate-400 mt-1">Configure promotional broadcast campaigns.</p>
            </Card>
          </NavLink>

          <NavLink to="/templates" className="group">
            <Card variant="bordered" className="h-full group-hover:border-emerald-500/50 transition-colors">
              <FileCode2 className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Templates</h4>
              <p className="text-xs text-slate-400 mt-1">WhatsApp Business approved message templates.</p>
            </Card>
          </NavLink>

          <NavLink to="/company" className="group">
            <Card variant="bordered" className="h-full group-hover:border-emerald-500/50 transition-colors">
              <Building2 className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Company</h4>
              <p className="text-xs text-slate-400 mt-1">Company profile and verified WhatsApp settings.</p>
            </Card>
          </NavLink>
        </div>
      </div>
    </div>
  );
};
