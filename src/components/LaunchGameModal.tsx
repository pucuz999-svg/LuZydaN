import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Rocket, X } from 'lucide-react';
import {
  CalibrationOutput,
  DeviceSpec,
  GripType,
  NotificationBlockSettings,
  SensitivityValues,
} from '../types';
import { formatSetupAsText } from '../utils/calibration';

interface LaunchGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceSpec;
  playstyleName: string;
  grip: GripType;
  calibration: CalibrationOutput;
  sensitivity: SensitivityValues;
  fireButtonSize: number;
  appliedStepsCount: number;
  autoCopied: boolean;
  notificationBlock: NotificationBlockSettings;
}

export const LaunchGameModal: React.FC<LaunchGameModalProps> = ({
  isOpen,
  onClose,
  device,
  playstyleName,
  grip,
  calibration,
  sensitivity,
  fireButtonSize,
  appliedStepsCount,
  autoCopied,
  notificationBlock,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isAndroid = device.os === 'Android';

  const ffStandardHref = isAndroid
    ? 'intent://launch#Intent;package=com.dts.freefireth;scheme=freefire;end'
    : 'freefire://';
  const ffMaxHref = isAndroid
    ? 'intent://launch#Intent;package=com.dts.freefiremax;scheme=freefiremax;end'
    : 'freefire://';

  const handleCopy = async () => {
    const mergedCal: CalibrationOutput = {
      ...calibration,
      sensitivity,
      fireButtonSize,
    };
    const text = formatSetupAsText(device, mergedCal, playstyleName, grip);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-[#111622] p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium text-emerald-400">
              All Settings Applied &amp; Saved
            </p>
            <h2
              id="launch-modal-title"
              className="mt-1 text-lg font-semibold text-white"
            >
              Ready to Launch Free Fire
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {device.brand} {device.model} · {playstyleName} · {appliedStepsCount} optimization steps marked active
              {autoCopied && ' · Setup copied to clipboard'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close launch modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Applied Settings Snapshot */}
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5 text-center">
            <div>
              <p className="text-[11px] text-slate-400">General</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-orange-400">
                {sensitivity.general}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Red Dot</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {sensitivity.redDot}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">2x Scope</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {sensitivity.scope2x}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">4x Scope</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {sensitivity.scope4x}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Sniper</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {sensitivity.sniperScope}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Free Look</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {sensitivity.freeLook}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg border border-slate-800 bg-[#0B0E14] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Fire Button</span>
              <span className="font-mono font-semibold text-white">
                {fireButtonSize}%
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B0E14] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400">
                {isAndroid ? 'DPI Target' : 'Cursor Speed'}
              </span>
              <span className="font-mono font-semibold text-white">
                {calibration.dpiValue}
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B0E14] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Display / FPS</span>
              <span className="font-mono font-semibold text-emerald-400">
                {calibration.graphics.display} · {calibration.graphics.highFps}
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B0E14] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Notifications</span>
              <span
                className={`font-mono font-semibold ${
                  notificationBlock.enabled ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {notificationBlock.enabled ? 'Blocked' : 'Standard'}
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            Your active sensitivity, DPI, and performance profile has been saved to this browser and marked ready. Select your installed game edition below to launch on mobile, or copy the values to enter in Free Fire&apos;s Settings menu.
          </p>
        </div>

        {/* Launch Edition Links + Copy Action */}
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#161C2B] px-4 py-2.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap"
          >
            {copied || autoCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {copied ? 'Copied Setup' : 'Copied to Clipboard'}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                Copy Setup
              </>
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2.5 justify-end">
            <a
              href={ffStandardHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Launch Free Fire
            </a>
            <a
              href={ffMaxHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap"
            >
              <Rocket className="h-3.5 w-3.5" />
              Launch Free Fire MAX
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
