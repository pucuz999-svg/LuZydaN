import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Send, ShieldCheck, UserCheck } from 'lucide-react';
import { AuthStatus, AuthUser, DeviceSpec, UserRole } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginViewProps {
  devices: DeviceSpec[];
  onLoginSuccess: (token: string, user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  devices,
  onLoginSuccess,
}) => {
  const [role, setRole] = useState<UserRole>('customer');
  const [customerMode, setCustomerMode] = useState<'signin' | 'request'>('signin');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [customId, setCustomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestedDeviceId, setRequestedDeviceId] = useState('moto-g54');
  const [requestNote, setRequestNote] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json') && active) {
          const data = (await res.json()) as AuthStatus;
          setAuthStatus(data);
        } else if (active) {
          setError('Authentication server is starting up. Please refresh in a moment.');
        }
      } catch {
        if (active) {
          setError('Could not reach authentication server.');
        }
      } finally {
        if (active) setStatusLoading(false);
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const isFirstRunAdminClaim =
    role === 'admin' && authStatus !== null && !authStatus.adminConfigured;

  const isCustomerRequest = role === 'customer' && customerMode === 'request';

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
    setRequestSuccess(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestSuccess(null);

    const trimmedId = customId.trim();
    if (!trimmedId) {
      setError(`Please enter your ${role === 'admin' ? 'Admin' : 'Customer'} ID.`);
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (isFirstRunAdminClaim) {
      if (password.length < 6) {
        setError('Admin password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/admin/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customId: trimmedId, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Failed to claim admin account.');
          return;
        }
        onLoginSuccess(data.token, data.user);
      } catch {
        setError('Network error while connecting to authentication server.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isCustomerRequest) {
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/request-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customId: trimmedId,
            displayName: displayName.trim() || trimmedId,
            password,
            requestedDeviceId,
            note: requestNote.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Could not submit request.');
          return;
        }
        setRequestSuccess(
          `Request submitted for "${trimmedId}". Wait for Admin approval, then sign in with your chosen ID and password.`
        );
        setPassword('');
        setRequestNote('');
        setCustomerMode('signin');
      } catch {
        setError('Network error while submitting request.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, customId: trimmedId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Invalid credentials.');
        return;
      }
      onLoginSuccess(data.token, data.user);
    } catch {
      setError('Network error while connecting to authentication server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        {/* Brand Wordmark */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Fire<span className="text-orange-500">Tune</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Free Fire Performance, Sensitivity &amp; Drag Headshot Studio
          </p>
          <div className="mt-3 flex justify-center">
            <PWAInstallButton />
          </div>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-xl border border-slate-800/90 bg-[#111622] p-6 sm:p-7">
          {/* Role Segmented Switch */}
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800"
            role="tablist"
            aria-label="Login role"
          >
            <button
              type="button"
              role="tab"
              aria-selected={role === 'customer'}
              onClick={() => handleRoleSwitch('customer')}
              className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                role === 'customer'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Customer Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'admin'}
              onClick={() => handleRoleSwitch('admin')}
              className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                role === 'admin'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Login
            </button>
          </div>

          {/* Customer Sub-mode Switch: Sign In vs Request ID */}
          {role === 'customer' && (
            <div className="mt-4 flex items-center justify-between border-b border-slate-800/80 pb-3 text-xs">
              <span className="text-slate-400">
                {customerMode === 'signin'
                  ? 'Have an approved Customer ID?'
                  : 'Request a new Customer ID'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode((m) => (m === 'signin' ? 'request' : 'signin'));
                  setError(null);
                  setRequestSuccess(null);
                }}
                className="font-semibold text-orange-400 hover:underline whitespace-nowrap"
              >
                {customerMode === 'signin' ? 'Request Access' : 'Back to Sign In'}
              </button>
            </div>
          )}

          <div className="mt-5">
            {isFirstRunAdminClaim ? (
              <div>
                <h2 className="text-base font-semibold text-white">
                  First-Run Admin Setup
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  No admin password is configured yet. Claim your Admin ID and password once to unlock customer management and request approvals.
                </p>
              </div>
            ) : isCustomerRequest ? (
              <div>
                <h2 className="text-base font-semibold text-white">
                  Request Custom Customer ID
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Choose your desired ID, password, and device. An administrator can accept or reject your request.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-semibold text-white">
                  {role === 'admin' ? 'Administrator Sign In' : 'Customer Sign In'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {role === 'admin'
                    ? 'Sign in with your Admin ID and password to create customer credentials and approve requests.'
                    : 'Enter your approved Customer ID and password to access your Free Fire calibration studio.'}
                </p>
                {role === 'admin' && authStatus?.envOverrideActive && (
                  <p className="mt-2 rounded-lg border border-slate-800 bg-[#0B0E14] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                    Root admin secret (<span className="font-mono text-slate-200">ADMIN_ID</span> / <span className="font-mono text-slate-200">ADMIN_PASSCODE</span>) is active in Settings → Secrets. Created full-access Admin IDs can also sign in here.
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          {requestSuccess && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-3.5 py-2.5 text-xs text-emerald-300"
            >
              {requestSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="login-custom-id"
                className="block text-xs font-medium text-slate-300"
              >
                {role === 'admin' ? 'Admin ID' : 'Customer ID'}
              </label>
              <input
                id="login-custom-id"
                type="text"
                autoComplete="username"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder={
                  isFirstRunAdminClaim
                    ? 'Choose admin ID (e.g. admin)'
                    : role === 'admin'
                      ? 'Enter Admin ID'
                      : 'Enter Customer ID (e.g. player_01)'
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {isCustomerRequest && (
              <>
                <div>
                  <label
                    htmlFor="req-display-name"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Player Name
                  </label>
                  <input
                    id="req-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="In-game name or nickname"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-device"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Your Device
                  </label>
                  <select
                    id="req-device"
                    value={requestedDeviceId}
                    onChange={(e) => setRequestedDeviceId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.brand} {d.model}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-300"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    isFirstRunAdminClaim || isCustomerRequest
                      ? 'new-password'
                      : 'current-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isFirstRunAdminClaim
                      ? 'Minimum 6 characters'
                      : isCustomerRequest
                        ? 'Choose password (min 4 chars)'
                        : 'Enter password'
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#0B0E14] py-2.5 pl-3.5 pr-11 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {isCustomerRequest && (
              <div>
                <label
                  htmlFor="req-note"
                  className="block text-xs font-medium text-slate-300"
                >
                  Note for Admin (Optional)
                </label>
                <input
                  id="req-note"
                  type="text"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Need Moto G54 one-tap setup"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}

            {isFirstRunAdminClaim && (
              <div>
                <label
                  htmlFor="login-confirm-password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Confirm Admin Password
                </label>
                <input
                  id="login-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter admin password"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || statusLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
            >
              {isCustomerRequest ? (
                <Send className="h-4 w-4" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {submitting
                ? 'Processing...'
                : isFirstRunAdminClaim
                  ? 'Claim Admin Account & Sign In'
                  : isCustomerRequest
                    ? 'Submit Customer ID Request'
                    : role === 'admin'
                      ? 'Sign In as Admin'
                      : 'Sign In as Customer'}
            </button>
          </form>

          {role === 'customer' && !statusLoading && authStatus && !authStatus.adminConfigured && (
            <p className="mt-4 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
              Setting up for the first time? Switch to{' '}
              <button
                type="button"
                onClick={() => handleRoleSwitch('admin')}
                className="font-semibold text-orange-400 hover:underline"
              >
                Admin Login
              </button>{' '}
              to claim your admin credentials and review requests.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
