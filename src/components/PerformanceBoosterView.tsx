import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BatteryCharging, BellOff, Check, Copy, Cpu, Flame, Gauge, Play, RotateCcw } from 'lucide-react';
import {
  CalibrationOutput,
  DeviceSpec,
  NotificationBlockSettings,
  OptimizationStep,
} from '../types';
import { buildOptimizationChecklist } from '../utils/calibration';

interface PerformanceBoosterViewProps {
  device: DeviceSpec;
  calibration: CalibrationOutput;
  completedStepIds: string[];
  onToggleStep: (stepId: string) => void;
  onResetSteps: () => void;
  notificationBlock: NotificationBlockSettings;
  onUpdateNotificationBlock: (next: NotificationBlockSettings) => void;
}

interface BenchmarkResult {
  measuredFps: number;
  avgFrameMs: number;
  worstFrameMs: number;
  stabilityPct: number;
  sampleCount: number;
}

type ResourceMode = 'max-fps' | 'balanced-heat' | 'low-ram';

export const PerformanceBoosterView: React.FC<PerformanceBoosterViewProps> = ({
  device,
  calibration,
  completedStepIds,
  onToggleStep,
  onResetSteps,
  notificationBlock,
  onUpdateNotificationBlock,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | OptimizationStep['category']>('All');
  const [resourceMode, setResourceMode] = useState<ResourceMode>(() =>
    device.ramGb <= 3 ? 'low-ram' : 'max-fps'
  );
  const [copiedBattery, setCopiedBattery] = useState(false);
  const [copiedDnd, setCopiedDnd] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const rafRef = useRef<number | null>(null);

  const checklist = useMemo(() => buildOptimizationChecklist(device), [device]);

  const filteredSteps = useMemo(() => {
    if (categoryFilter === 'All') return checklist;
    return checklist.filter((s) => s.category === categoryFilter);
  }, [checklist, categoryFilter]);

  const completedCount = useMemo(
    () => checklist.filter((s) => completedStepIds.includes(s.id)).length,
    [checklist, completedStepIds]
  );

  // Real browser capability readouts (never fabricated)
  const browserTelemetry = useMemo(() => {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || null : null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mem = typeof navigator !== 'undefined' && nav.deviceMemory ? nav.deviceMemory : null;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const screenRes =
      typeof window !== 'undefined'
        ? `${window.screen.width} × ${window.screen.height}`
        : '—';
    return { cores, mem, dpr, screenRes };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runFrameBenchmark = () => {
    if (isBenchmarking) return;
    setIsBenchmarking(true);
    setBenchmarkProgress(0);
    setBenchmarkResult(null);

    const deltas: number[] = [];
    let startTime = 0;
    let lastTime = 0;
    const DURATION_MS = 2800;

    const tick = (now: number) => {
      if (startTime === 0) {
        startTime = now;
        lastTime = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = now - lastTime;
      lastTime = now;
      if (dt > 0 && dt < 250) {
        deltas.push(dt);
      }

      const elapsed = now - startTime;
      setBenchmarkProgress(Math.min(100, Math.round((elapsed / DURATION_MS) * 100)));

      if (elapsed < DURATION_MS) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsBenchmarking(false);
        setBenchmarkProgress(100);
        if (deltas.length > 0) {
          const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const sorted = [...deltas].sort((a, b) => a - b);
          const worstMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
          const measuredFps = Math.round(1000 / avgMs);
          // Stability measures how many frames stayed within 1.5x of median frame time
          const medianMs = sorted[Math.floor(sorted.length / 2)];
          const smoothFrames = deltas.filter((d) => d <= medianMs * 1.45).length;
          const stabilityPct = Math.round((smoothFrames / deltas.length) * 100);
          setBenchmarkResult({
            measuredFps,
            avgFrameMs: Number(avgMs.toFixed(2)),
            worstFrameMs: Number(worstMs.toFixed(2)),
            stabilityPct,
            sampleCount: deltas.length,
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const progressPct =
    checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const batteryResourceSettings = useMemo(() => {
    const isLowRam = resourceMode === 'low-ram' || device.ramGb <= 3;
    const isMaxFps = resourceMode === 'max-fps';

    const bgProcessLimit = isLowRam
      ? 'At most 1 process'
      : isMaxFps
        ? device.ramGb <= 6
          ? 'At most 2 processes'
          : 'At most 3 processes'
        : 'At most 2 processes';

    const batteryProfile = isMaxFps
      ? 'High Performance / Game Mode · Battery Saver Off'
      : isLowRam
        ? 'Performance Mode (Plugged In Off) · Adaptive Battery Off'
        : 'Balanced Power · Charge Limit 80% / Bypass Charging';

    const cachedAppsExecution = isLowRam || isMaxFps ? 'Enabled (Freeze Cached)' : 'Device Default';

    const virtualRamSetting =
      device.ramGb <= 3
        ? 'RAM Expansion: +2 GB On (reduces hard crashes)'
        : 'RAM Plus / Virtual RAM: Off (avoids slow storage swap)';

    return [
      {
        id: 'bg-process',
        label: 'Background Process Limit',
        recommended: bgProcessLimit,
        path: 'Settings > Developer options > Apps > Background process limit',
        detail: isLowRam
          ? 'Prevents messaging, browser, and cloud sync services from stealing scarce RAM and causing zRAM stutters during final circles.'
          : 'Leaves headroom for voice chat and screen recording while keeping heavy background updaters capped.',
      },
      {
        id: 'battery-saver',
        label: 'Battery Saver & Power Mode',
        recommended: batteryProfile,
        path: 'Settings > Battery > Power mode & Adaptive Battery',
        detail:
          'Standard Battery Saver downclocks big CPU cores and caps 90–165 Hz screens to 60 Hz. Turn Battery Saver and Adaptive Battery Off before launching Free Fire.',
      },
      {
        id: 'app-battery',
        label: 'Free Fire App Battery & Cached Execution',
        recommended: `App Battery: Unrestricted · Suspend Cached Apps: ${cachedAppsExecution}`,
        path: 'App Info (Free Fire) > Battery > Unrestricted · Developer options > Suspend execution for cached apps',
        detail:
          'Marking Free Fire Unrestricted prevents Android Doze from throttling background network sockets, while suspending cached apps halts idle background CPU wakeups.',
      },
      {
        id: 'ram-storage',
        label: 'Virtual RAM & Free Storage Guard',
        recommended: `${virtualRamSetting} · Don’t keep activities: Off`,
        path: 'Settings > Device care / About phone > RAM Expansion & Storage',
        detail:
          device.ramGb <= 3
            ? '2–3 GB devices benefit from modest 2 GB swap to stay alive, while keeping at least 20% internal flash free for shader cache writes.'
            : 'Virtual RAM writes to slower UFS/eMMC flash and introduces frame-time spikes on 4 GB+ phones. Disabling it keeps texture streaming in fast LPDDR RAM.',
      },
    ];
  }, [device.ramGb, resourceMode]);

  const handleCopyBatterySettings = async () => {
    const lines = [
      `FireTune Android Battery & Resource Profile (${device.brand} ${device.model})`,
      ...batteryResourceSettings.map(
        (item) => `- ${item.label}: ${item.recommended}\n  Path: ${item.path}`
      ),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedBattery(true);
      setTimeout(() => setCopiedBattery(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCopyNotificationBlockGuide = async () => {
    const rules = [
      notificationBlock.blockHeadsUp ? 'Block Heads-Up Popups: ON' : 'Block Heads-Up Popups: OFF',
      notificationBlock.blockCalls ? 'Block Incoming Call Overlay: ON' : 'Block Incoming Call Overlay: OFF',
      notificationBlock.blockFloatingBubbles
        ? 'Block Floating Chat Bubbles: ON'
        : 'Block Floating Chat Bubbles: OFF',
      notificationBlock.muteInAppAlerts ? 'Mute In-App Alerts: ON' : 'Mute In-App Alerts: OFF',
    ];
    const text = [
      `FireTune Notification Block Profile (${device.brand} ${device.model})`,
      `Master Status: ${notificationBlock.enabled ? 'ACTIVE' : 'OFF'}`,
      ...rules.map((r) => `- ${r}`),
      device.os === 'Android'
        ? device.brand === 'Motorola'
          ? 'Apply on Moto: Open Moto Gametime > Block Notifications & Calls + Settings > Notifications > Do Not Disturb'
          : 'Apply on Android: Settings > Notifications > Do Not Disturb (Enable) + Game Space / Game Turbo > Block Pop-ups & Floating Windows'
        : 'Apply on iOS: Settings > Focus > Gaming (Silence Notifications & Calls while Free Fire is open)',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedDnd(true);
      setTimeout(() => setCopiedDnd(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Row: In-Game Graphics Matrix + Live Device Refresh & Frame-Pacing Test */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-stretch">
        {/* Recommended Free Fire Display & FPS Settings (7 cols) */}
        <div className="xl:col-span-7 rounded-xl border border-slate-800/90 bg-[#111622] p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recommended In-Game Graphics &amp; FPS
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {device.brand} {device.model} · {device.ramGb} GB RAM · {device.chipset}
                </p>
              </div>
              <span className="font-mono text-xs font-medium text-emerald-400">
                Target {calibration.graphics.targetFps} FPS Locked
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">Graphics</p>
                <p className="mt-1 font-mono text-lg font-bold text-orange-400">
                  {calibration.graphics.display}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">High FPS</p>
                <p className="mt-1 font-mono text-lg font-bold text-white">
                  {calibration.graphics.highFps}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">Shadow</p>
                <p className="mt-1 font-mono text-lg font-bold text-white">
                  {calibration.graphics.shadow}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">High Res</p>
                <p className="mt-1 font-mono text-lg font-bold text-white">
                  {calibration.graphics.highRes}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">Filter</p>
                <p className="mt-1 font-mono text-lg font-bold text-white">
                  {calibration.graphics.filter}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5">
                <p className="text-xs text-slate-400">Auto Scale</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-400">
                  {calibration.graphics.autoScale}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 border-t border-slate-800/80 pt-4">
            <Flame className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-xs leading-relaxed text-slate-300">
              <strong className="font-semibold text-white">Thermal Rationale: </strong>
              {calibration.graphics.thermalNote}
            </p>
          </div>
        </div>

        {/* Live Browser Frame-Time & Hardware Benchmark (5 cols) */}
        <div className="xl:col-span-5 rounded-xl border border-slate-800/90 bg-[#111622] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Live Frame-Pacing Check
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Measures actual refresh rate and frame-time jitter on this device
                </p>
              </div>
              <Gauge className="h-5 w-5 text-orange-400 shrink-0" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-[#0B0E14] px-3 py-2.5 border border-slate-800/80">
                <span className="text-slate-400">CPU Threads</span>
                <span className="font-mono font-semibold text-white">
                  {browserTelemetry.cores ?? 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#0B0E14] px-3 py-2.5 border border-slate-800/80">
                <span className="text-slate-400">Browser RAM Hint</span>
                <span className="font-mono font-semibold text-white">
                  {browserTelemetry.mem ? `${browserTelemetry.mem} GB` : 'Hidden'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#0B0E14] px-3 py-2.5 border border-slate-800/80">
                <span className="text-slate-400">Screen Viewport</span>
                <span className="font-mono font-semibold text-white">
                  {browserTelemetry.screenRes}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#0B0E14] px-3 py-2.5 border border-slate-800/80">
                <span className="text-slate-400">Pixel Ratio</span>
                <span className="font-mono font-semibold text-white">
                  {browserTelemetry.dpr}x
                </span>
              </div>
            </div>

            {benchmarkResult ? (
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-[#0B0E14] p-4">
                <div>
                  <p className="text-[11px] text-slate-400">Measured Rate</p>
                  <p className="mt-1 font-mono text-xl font-bold text-orange-400">
                    {benchmarkResult.measuredFps}
                    <span className="ml-1 text-xs font-normal text-slate-400">Hz</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Avg Frame Time</p>
                  <p className="mt-1 font-mono text-xl font-bold text-white">
                    {benchmarkResult.avgFrameMs}
                    <span className="ml-0.5 text-xs font-normal text-slate-400">ms</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Pacing Stability</p>
                  <p
                    className={`mt-1 font-mono text-xl font-bold ${
                      benchmarkResult.stabilityPct >= 90
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {benchmarkResult.stabilityPct}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-800/80 bg-[#0B0E14] p-4">
                <p className="text-xs text-slate-400">
                  {isBenchmarking
                    ? `Sampling live requestAnimationFrame timings... ${benchmarkProgress}%`
                    : 'Run a 3-second frame-time test to verify if Battery Saver or adaptive refresh is capping your screen below its native Hz.'}
                </p>
                {isBenchmarking && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-orange-500 transition-all duration-100"
                      style={{ width: `${benchmarkProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={runFrameBenchmark}
            disabled={isBenchmarking}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
          >
            <Play className="h-4 w-4" />
            {isBenchmarking ? 'Measuring Frame Pacing...' : 'Run Live FPS & Jitter Test'}
          </button>
        </div>
      </section>

      {/* Battery & Resource: Android System Settings for Max Game-Time FPS */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <BatteryCharging className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Battery &amp; Resource
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Android system power, background process, and memory settings calibrated for {device.ramGb} GB RAM · {device.thermalHeadroom} thermal headroom.
              {device.os === 'iOS' && ' Shown for Android optimization parity while an iOS device is selected.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800/80">
              {(
                [
                  { id: 'max-fps', label: 'Max FPS Push' },
                  { id: 'balanced-heat', label: 'Low-Heat Grind' },
                  { id: 'low-ram', label: 'Aggressive RAM' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setResourceMode(mode.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    resourceMode === mode.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyBatterySettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#161C2B] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap"
            >
              {copiedBattery ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  Copy Android Guide
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {batteryResourceSettings.map((setting) => (
            <div
              key={setting.id}
              className="rounded-lg border border-slate-800 bg-[#0B0E14] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">
                    {setting.label}
                  </h3>
                </div>
                <p className="mt-1.5 font-mono text-xs font-semibold text-orange-400">
                  {setting.recommended}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {setting.detail}
                </p>
              </div>
              <p className="border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-500">
                {setting.path}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Notification Block & Game Focus Mode */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <BellOff className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Notification Block &amp; Game Focus
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Silence heads-up banners, floating chat bubbles, and incoming call pop-ups that cause frame drops or break upward drag swipes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyNotificationBlockGuide}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#161C2B] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap"
            >
              {copiedDnd ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  Copy DND Steps
                </>
              )}
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={notificationBlock.enabled}
              onClick={() =>
                onUpdateNotificationBlock({
                  ...notificationBlock,
                  enabled: !notificationBlock.enabled,
                })
              }
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                notificationBlock.enabled
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'border border-slate-700 bg-[#0B0E14] text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <BellOff className="h-3.5 w-3.5" />
              {notificationBlock.enabled ? 'Notification Block: ON' : 'Notification Block: OFF'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                key: 'blockHeadsUp',
                title: 'Block Heads-Up Banners',
                desc: 'Stops WhatsApp, SMS, and social banners from dropping over the top HUD.',
              },
              {
                key: 'blockCalls',
                title: 'Block Call Pop-Up Overlay',
                desc: 'Keeps incoming voice/video calls from stealing focus mid-gunfight.',
              },
              {
                key: 'blockFloatingBubbles',
                title: 'Block Floating Bubbles',
                desc: 'Disables Messenger chat heads and mini split-screen popups.',
              },
              {
                key: 'muteInAppAlerts',
                title: 'Silence In-App Alerts',
                desc: 'Keeps FireTune prompts quiet once settings are applied before launch.',
              },
            ] as const
          ).map((item) => {
            const active = notificationBlock.enabled && notificationBlock[item.key];
            return (
              <button
                key={item.key}
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() =>
                  onUpdateNotificationBlock({
                    ...notificationBlock,
                    enabled: true,
                    [item.key]: !notificationBlock[item.key],
                  })
                }
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-orange-500/60 bg-orange-500/8'
                    : 'border-slate-800 bg-[#0B0E14] opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">{item.title}</span>
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      active ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {active ? 'BLOCKED' : 'ALLOW'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>

        <p className="mt-4 border-t border-slate-800/80 pt-3 font-mono text-[11px] text-slate-400">
          {device.os === 'Android'
            ? device.brand === 'Motorola'
              ? 'Moto Path: Open Moto Gametime sidebar → Toggle Block Notifications & Block Calls + Settings → Notifications → Do Not Disturb.'
              : 'Android Path: Settings → Notifications → Do Not Disturb (On) · Game Space / Game Turbo → Block Heads-Up & Floating Windows.'
            : 'iOS Path: Settings → Focus → Gaming → Silence Notifications & Calls while Free Fire is active.'}
        </p>
      </section>

      {/* Actionable System & In-Game Optimization Checklist */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                {device.os} Performance Boost Checklist
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Apply these verified {device.os} system and Free Fire settings to eliminate micro-stutter, reduce touch latency, and prevent thermal frame drops.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-sm font-bold text-white">
                {completedCount} / {checklist.length} Applied ({progressPct}%)
              </p>
              <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={onResetSteps}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800/80 w-fit">
          {(
            [
              'All',
              'In-Game Options',
              'Display & Touch',
              'Memory & CPU',
              'Thermal & Battery',
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Checklist Table / Rows */}
        <div className="mt-5 divide-y divide-slate-800/70">
          {filteredSteps.map((step) => {
            const isDone = completedStepIds.includes(step.id);
            return (
              <div
                key={step.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => onToggleStep(step.id)}
                    aria-pressed={isDone}
                    aria-label={`Mark ${step.title} as ${isDone ? 'incomplete' : 'complete'}`}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                        : 'border-slate-600 bg-[#0B0E14] text-transparent hover:border-orange-400'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{step.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          step.impact === 'High'
                            ? 'font-medium text-orange-400'
                            : 'text-slate-400'
                        }
                      >
                        {step.impact} Impact
                      </span>
                    </div>
                    <h3
                      className={`mt-1 text-sm font-semibold ${
                        isDone ? 'text-slate-400 line-through' : 'text-white'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 pl-9 sm:pl-4">
                  <span className="font-mono text-xs font-medium text-slate-200">
                    {step.settingValue}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
