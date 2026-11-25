import React from 'react';
import { Clock, LogOut, RefreshCw, ShieldAlert, ShieldOff } from 'lucide-react';
import { FirebaseUserProfile } from '../types';
import { BrandLogo } from './BrandLogo';

interface ApprovalStatusViewProps {
  profile: FirebaseUserProfile;
  refreshing: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  onGoHome?: () => void;
  titleOverride?: string;
  descriptionOverride?: string;
}

export const ApprovalStatusView: React.FC<ApprovalStatusViewProps> = ({
  profile,
  refreshing,
  onRefresh,
  onSignOut,
  onGoHome,
  titleOverride,
  descriptionOverride,
}) => {
  const isBlocked = profile.status === 'blocked' && !titleOverride;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <h1 className="flex justify-center">
            <BrandLogo size="lg" centered />
          </h1>
        </div>

        <div className="mt-8 rounded-xl border border-slate-800/90 bg-[#111622] p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                titleOverride
                  ? 'bg-rose-500/15 text-rose-400'
                  : isBlocked
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {titleOverride ? (
                <ShieldAlert className="h-5 w-5" />
              ) : isBlocked ? (
                <ShieldOff className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {titleOverride
                  ? titleOverride
                  : isBlocked
                    ? 'Access Blocked'
                    : 'Waiting for Admin Approval'}
              </h2>
              <p className="text-xs text-slate-400">
                Status:{' '}
                <span
                  className={`font-mono font-semibold uppercase ${
                    isBlocked || titleOverride ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {titleOverride ? 'restricted' : profile.status}
                </span>
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {descriptionOverride
              ? descriptionOverride
              : isBlocked
                ? 'Your account has been blocked by the administrator. You cannot access the FF TUNE workspace while blocked.'
                : 'Your account has been registered and set to pending in Firestore. An administrator must approve your account before you can enter the main app. This screen updates automatically once approved.'}
          </p>

          <div className="mt-5 rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Signed in as</span>
              <span className="font-mono text-slate-200 truncate">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Name</span>
              <span className="text-slate-200 truncate">{profile.displayName}</span>
            </div>
            {profile.lastLoginAt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Last login</span>
                <span className="font-mono text-slate-300">
                  {new Date(profile.lastLoginAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {onGoHome ? (
              <button
                type="button"
                onClick={onGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
              >
                Return to App
              </button>
            ) : (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0B0E14] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Checking...' : 'Check Status'}
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
