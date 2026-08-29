import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (countdown !== null && countdown > 0) return;
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await login(email, password);
      setCountdown(null);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('Too many failed')) {
        const secs = parseInt(err.retryAfter || '60', 10) || 60;
        setCountdown(secs);
        setAuthError(`Too many failed login attempts. Please try again in ${secs} seconds.`);
      } else {
        setAuthError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-950/60 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">IT Company Admin</h1>
          <p className="text-xs text-slate-400 mt-1">WhatsApp Promotional Campaign Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950/80">
          <h2 className="text-lg font-bold text-white mb-1">Administrator Sign In</h2>
          <p className="text-xs text-slate-400 mb-6">Enter your authorized administrative credentials to access the console.</p>

          {/* Auth Error / Rate Limit Banner */}
          {countdown !== null && countdown > 0 ? (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/50 border border-amber-800/60 flex items-start gap-3 text-amber-200">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold block mb-0.5">Rate Limit Active</span>
                <span className="text-amber-300">
                  Too many failed login attempts. Please try again in <strong className="font-mono text-white underline">{countdown} seconds</strong>.
                </span>
              </div>
            </div>
          ) : authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-3 text-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold block mb-0.5">Authentication Failed</span>
                <span className="text-rose-300/90">{authError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) setValidationErrors({ ...validationErrors, email: undefined });
                  }}
                  placeholder="admin@itcompany.com"
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-colors ${
                    validationErrors.email
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] text-rose-400 mt-1 font-medium">{validationErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) setValidationErrors({ ...validationErrors, password: undefined });
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-9 pr-10 py-2.5 bg-slate-950 border rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-colors ${
                    validationErrors.password
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[11px] text-rose-400 mt-1 font-medium">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Sign In to Console
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-slate-600 text-center mt-6">
          Single IT Company Internal Access • Secure Session Protocol
        </p>
      </div>
    </div>
  );
};
