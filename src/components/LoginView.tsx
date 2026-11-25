import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogIn, ShieldCheck, Smartphone } from 'lucide-react';
import { ADMIN_EMAIL, signInWithGoogle } from '../firebase';
import { DeviceSpec, FirebaseUserProfile } from '../types';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import type { User } from 'firebase/auth';

interface LoginViewProps {
  devices: DeviceSpec[];
  isAdminRoute: boolean;
  onNavigateHome?: () => void;
  onAuthComplete: (user: User, profile: FirebaseUserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  devices,
  isAdminRoute,
  onNavigateHome,
  onAuthComplete,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState('samsung-a54');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (devices.length > 0 && !devices.some((d) => d.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const { user, profile } = await signInWithGoogle(selectedDeviceId);
      onAuthComplete(user, profile);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google sign-in popup was closed before completing.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up blocked by browser. Allow pop-ups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized in Firebase Authentication settings yet.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not complete Firebase Google sign-in.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <h1 className="flex justify-center">
            <BrandLogo size="lg" centered />
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Free Fire Performance, Sensitivity &amp; Drag Headshot Studio
          </p>
          <div className="mt-3 flex justify-center">
            <PWAInstallButton />
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-800/90 bg-[#111622] p-6 sm:p-7">
          {isAdminRoute ? (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Administrator Sign In (`/admin`)
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  The <span className="font-mono text-slate-200">/admin</span> dashboard is accessible only to{' '}
                  <span className="font-mono text-orange-300">{ADMIN_EMAIL}</span>. Sign in with Google to verify your administrator account.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-base font-semibold text-white">
                Sign In with Google
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                New sign-ups are registered in Firestore with status{' '}
                <span className="font-mono text-amber-300">pending</span> and wait for Admin approval before unlocking the studio. Approved users enter immediately.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-300 break-words"
            >
              {error}
            </div>
          )}

          {!isAdminRoute && (
            <div className="mt-5">
              <label
                htmlFor="signup-device"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-300"
              >
                <Smartphone className="h-3.5 w-3.5 text-orange-400" />
                Preferred Device (for new sign-ups)
              </label>
              <select
                id="signup-device"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3.5 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.brand} {d.model}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            {signingIn ? 'Signing in...' : 'Continue with Google'}
          </button>

          {isAdminRoute && onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Main Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
