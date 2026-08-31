import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchHealthStatus } from '../../api/health';
import { 
  Server, 
  Cloud, 
  Activity, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Clock 
} from 'lucide-react';

interface ServerWakeGatewayProps {
  children: React.ReactNode;
}

type WakeStatus = 'initial_check' | 'waking' | 'connected' | 'timeout';

export const ServerWakeGateway: React.FC<ServerWakeGatewayProps> = ({ children }) => {
  const [status, setStatus] = useState<WakeStatus>('initial_check');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [, setErrorMessage] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Ping the server health endpoint
  const checkHealth = useCallback(async (_isManual: boolean = false) => {
    if (!isMountedRef.current) return false;
    
    setIsPinging(true);
    setAttempts((prev) => prev + 1);

    try {
      // Shorter timeout per probe so we don't stall UI if request drops
      const res = await fetchHealthStatus(6000);
      
      if (!isMountedRef.current) return false;

      const isMongoReady = res?.data?.database?.mongodb === 'connected' || res?.success === true;
      setDbConnected(isMongoReady);

      if (res?.success || isMongoReady) {
        setStatus('connected');
        setErrorMessage(null);
        return true;
      } else {
        setStatus('waking');
        return false;
      }
    } catch (err: any) {
      if (!isMountedRef.current) return false;
      
      // Expected during cold start: 502, 503, 504, or network timeout
      setStatus('waking');
      setErrorMessage(err?.message || 'Waiting for Render container to start...');
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsPinging(false);
      }
    }
  }, []);

  // Main lifecycle: initial check + continuous polling until ready
  useEffect(() => {
    isMountedRef.current = true;

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // If elapsed > 120s without response, switch to timeout warning state
        if (next > 120 && status !== 'connected') {
          setStatus('timeout');
        }
        return next;
      });
    }, 1000);

    // Initial check immediately
    let isInitial = true;
    const runPoller = async () => {
      const isOk = await checkHealth(isInitial);
      isInitial = false;

      if (!isOk && isMountedRef.current && status !== 'connected') {
        // Schedule next poll in 2.5s
        pollerRef.current = setTimeout(runPoller, 2500);
      }
    };

    runPoller();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollerRef.current) clearTimeout(pollerRef.current);
    };
  }, [checkHealth]);

  // Clean transition to app once connected
  const [isRendered, setIsRendered] = useState<boolean>(false);
  useEffect(() => {
    if (status === 'connected') {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollerRef.current) clearTimeout(pollerRef.current);

      // If initial check was immediate (<1s), render children immediately
      if (elapsedSeconds < 1 && attempts <= 1) {
        setIsRendered(true);
      } else {
        // Show success state briefly (600ms) for smooth visual confirmation
        const timeout = setTimeout(() => {
          setIsRendered(true);
        }, 600);
        return () => clearTimeout(timeout);
      }
    }
  }, [status, elapsedSeconds, attempts]);

  // If already connected and rendered, directly display application
  if (isRendered) {
    return <>{children}</>;
  }

  // Format seconds to mm:ss
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Estimated progress calculation (asymptotic curve reaching ~92% around 45s, 100% on connected)
  const calculateProgress = (): number => {
    if (status === 'connected') return 100;
    if (elapsedSeconds === 0) return 10;
    // Fast start to 30%, slow climb up to 92%
    const progress = Math.min(92, Math.round(15 + 77 * (1 - Math.exp(-elapsedSeconds / 25))));
    return progress;
  };

  const progress = calculateProgress();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Background Glow Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-900/60 rounded-full blur-2xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
        
        {/* Animated Brand Pulse Icon */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Concentric Pulse Waves */}
          {status !== 'connected' && (
            <>
              <div className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="absolute w-20 h-20 rounded-full bg-cyan-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </>
          )}
          
          <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
            status === 'connected'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 scale-110 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800/90 border-slate-700/80 text-emerald-400 shadow-xl'
          }`}>
            {status === 'connected' ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : status === 'timeout' ? (
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            ) : (
              <Server className="w-8 h-8 text-emerald-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Branding & Titles */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>AutoPay Tech WhatsApp</span>
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight mb-2">
          {status === 'connected'
            ? 'Backend Connected & Ready!'
            : status === 'timeout'
            ? 'Backend Waking Slower Than Usual'
            : elapsedSeconds > 12
            ? 'Waking Render Backend Instance'
            : 'Connecting to Cloud Backend'}
        </h1>

        <p className="text-xs text-slate-400 mb-6 max-w-sm leading-relaxed">
          {status === 'connected'
            ? 'All systems operational. Initializing workspace...'
            : status === 'timeout'
            ? 'The backend instance on Render is taking longer to start. You can continue waiting or trigger a manual ping.'
            : 'Render free-tier instances sleep when inactive. Waking up the container, initializing Node runtime, and connecting database...'}
        </p>

        {/* Real-time Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden mb-4 p-0.5 border border-slate-700/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              status === 'connected'
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Live Diagnostics & Timers */}
        <div className="w-full grid grid-cols-2 gap-2 mb-6 text-xs">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Elapsed
            </span>
            <span className="font-mono font-medium text-slate-200">{formatTime(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              Pings
            </span>
            <span className="font-mono font-medium text-slate-200">
              #{attempts} {isPinging && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-1" />}
            </span>
          </div>
        </div>

        {/* Step-by-Step Diagnostic Indicators */}
        <div className="w-full space-y-2 mb-6 text-left">
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-800/20 border border-slate-800/60">
            <div className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Render Container Boot</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {elapsedSeconds > 4 ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="text-amber-400 animate-pulse">Starting...</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-800/20 border border-slate-800/60">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">MongoDB Database</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {dbConnected || status === 'connected' ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-slate-500">Awaiting runtime</span>
              )}
            </span>
          </div>
        </div>

        {/* Manual Action Button */}
        <div className="w-full flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => checkHealth(true)}
            disabled={isPinging || status === 'connected'}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isPinging ? 'Checking Health...' : 'Ping Server Now'}</span>
          </button>
        </div>

        {/* Sub-footer tip */}
        <p className="text-[11px] text-slate-500 mt-5 leading-tight">
          💡 Tip: Once awake, responses will be instant for all campaign tools.
        </p>
      </div>
    </div>
  );
};
