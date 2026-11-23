import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Info, Plus, RotateCcw, Save, Search, X } from 'lucide-react';
import { PLAYSTYLE_META } from '../data/devices';
import {
  CalibrationOutput,
  DeviceSpec,
  DeviceTier,
  GripType,
  PlaystyleId,
  RangeBias,
  SensitivityValues,
} from '../types';
import { formatSetupAsText } from '../utils/calibration';

interface DeviceSensitivityViewProps {
  devices: DeviceSpec[];
  selectedDevice: DeviceSpec;
  onSelectDevice: (device: DeviceSpec) => void;
  onOpenCustomModal: () => void;
  playstyle: PlaystyleId;
  onChangePlaystyle: (p: PlaystyleId) => void;
  grip: GripType;
  onChangeGrip: (g: GripType) => void;
  rangeBias: RangeBias;
  onChangeRangeBias: (r: RangeBias) => void;
  calibration: CalibrationOutput;
  sensitivityOverrides: SensitivityValues;
  fireButtonOverride: number;
  onUpdateSensitivity: (key: keyof SensitivityValues, value: number) => void;
  onUpdateFireButton: (size: number) => void;
  onResetOverrides: () => void;
  onSaveProfile: (name: string) => void;
}

type DeviceFilter = 'all' | 'motorola' | DeviceTier;

const TIER_FILTERS: { id: DeviceFilter; label: string }[] = [
  { id: 'all', label: 'All Devices' },
  { id: 'motorola', label: 'Motorola' },
  { id: 'low', label: '2-3GB Budget' },
  { id: 'mid', label: '4-6GB Mid' },
  { id: 'high', label: 'Flagship' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'ios', label: 'iPhone / iPad' },
];

const SENSITIVITY_ROWS: {
  key: keyof SensitivityValues;
  label: string;
  role: string;
}[] = [
  {
    key: 'general',
    label: 'General',
    role: 'Camera sweep & hipfire drag lift speed',
  },
  {
    key: 'redDot',
    label: 'Red Dot',
    role: 'Iron-sight & reflex lock onto upper head',
  },
  {
    key: 'scope2x',
    label: '2x Scope',
    role: 'Mid-range AR tracking & burst headshots',
  },
  {
    key: 'scope4x',
    label: '4x Scope',
    role: 'Long-range marksman & AR recoil pull',
  },
  {
    key: 'sniperScope',
    label: 'Sniper Scope',
    role: 'AWM / M82B quick-scope micro-flick',
  },
  {
    key: 'freeLook',
    label: 'Free Look',
    role: '360° parachute & sprint perimeter scan',
  },
];

export const DeviceSensitivityView: React.FC<DeviceSensitivityViewProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  onOpenCustomModal,
  playstyle,
  onChangePlaystyle,
  grip,
  onChangeGrip,
  rangeBias,
  onChangeRangeBias,
  calibration,
  sensitivityOverrides,
  fireButtonOverride,
  onUpdateSensitivity,
  onUpdateFireButton,
  onResetOverrides,
  onSaveProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<DeviceFilter>('all');
  const [copied, setCopied] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [dpiTooltipOpen, setDpiTooltipOpen] = useState(false);
  const dpiTooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dpiTooltipOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dpiTooltipRef.current &&
        !dpiTooltipRef.current.contains(event.target as Node)
      ) {
        setDpiTooltipOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDpiTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dpiTooltipOpen]);

  const filteredDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return devices.filter((d) => {
      if (tierFilter === 'motorola' && d.brand !== 'Motorola') return false;
      if (tierFilter !== 'all' && tierFilter !== 'motorola' && d.tier !== tierFilter) {
        return false;
      }
      if (!q) return true;
      return `${d.brand} ${d.model} ${d.chipset} ${d.ramGb}gb`
        .toLowerCase()
        .includes(q);
    });
  }, [devices, searchQuery, tierFilter]);

  const activePlaystyle =
    PLAYSTYLE_META.find((p) => p.id === playstyle) ?? PLAYSTYLE_META[0];

  const handleCopy = async () => {
    const mergedCal: CalibrationOutput = {
      ...calibration,
      sensitivity: sensitivityOverrides,
      fireButtonSize: fireButtonOverride,
    };
    const text = formatSetupAsText(
      selectedDevice,
      mergedCal,
      activePlaystyle.name,
      grip
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSave = () => {
    const label = `${selectedDevice.model} · ${activePlaystyle.name}`;
    onSaveProfile(label);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  // Compute SVG drag curve points based on General & Red Dot values
  const curvePoints = useMemo(() => {
    const gNorm = sensitivityOverrides.general / 200;
    const rNorm = sensitivityOverrides.redDot / 200;
    const x0 = 20;
    const y0 = 135;
    const cx1 = 90 - gNorm * 35;
    const cy1 = 125 - rNorm * 45;
    const cx2 = 160 - gNorm * 25;
    const cy2 = 55 - rNorm * 28;
    const xEnd = 240;
    const yEnd = 22 + (1 - gNorm) * 28;
    return `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${xEnd} ${yEnd}`;
  }, [sensitivityOverrides.general, sensitivityOverrides.redDot]);

  return (
    <div className="space-y-8">
      {/* Top Split: Device Selector + Active Hardware Summary */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Left: Searchable Device Catalog (5 cols) */}
        <div className="xl:col-span-5 rounded-xl border border-slate-800/90 bg-[#111622] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Select Target Device
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {devices.length} calibrated Android &amp; iOS models
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCustomModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#161C2B] px-3 py-2 text-xs font-medium text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5 text-orange-400" />
              Custom Device
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone, brand, chipset, or RAM..."
              aria-label="Search devices"
              className="w-full rounded-lg border border-slate-800 bg-[#0B0E14] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800/80">
            {TIER_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTierFilter(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tierFilter === tab.id
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[340px] divide-y divide-slate-800/70 overflow-y-auto pr-1">
            {filteredDevices.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-300">No matching device found.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add your exact hardware specs with the Custom Device builder.
                </p>
                <button
                  type="button"
                  onClick={onOpenCustomModal}
                  className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
                >
                  Create Custom Profile
                </button>
              </div>
            ) : (
              filteredDevices.map((device) => {
                const isSelected = device.id === selectedDevice.id;
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => onSelectDevice(device)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-orange-500/10 text-white'
                        : 'hover:bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-sm font-medium ${
                            isSelected ? 'text-orange-400' : 'text-white'
                          }`}
                        >
                          {device.brand} {device.model}
                        </span>
                        {device.isCustom && (
                          <span className="text-[11px] font-medium text-orange-400">
                            · Custom
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {device.ramGb} GB RAM · {device.refreshHz} Hz · {device.chipset}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {device.os}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Playstyle Calibration & Hardware Output (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          {/* Active Hardware Specification Strip */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <p className="text-xs font-medium text-orange-400">
                  Active Hardware Profile
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
                  {selectedDevice.brand} {selectedDevice.model}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedDevice.chipset} · {selectedDevice.ramGb} GB RAM ·{' '}
                  {selectedDevice.refreshHz} Hz Display ·{' '}
                  {selectedDevice.touchSamplingHz} Hz Touch Sampling
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#161C2B] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      Copy Setup
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap"
                >
                  {savedToast ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Preset
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 4 Key Hardware Targets */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="relative" ref={dpiTooltipRef}>
                <p className="text-xs text-slate-400">Recommended DPI</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <p className="font-mono text-xl font-bold text-white">
                    {calibration.dpiValue}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {selectedDevice.os === 'Android' ? 'dp' : 'spd'}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setDpiTooltipOpen((prev) => !prev)}
                    aria-label="How to safely change DPI settings on Android"
                    aria-expanded={dpiTooltipOpen}
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      dpiTooltipOpen
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-slate-700 bg-[#161C2B] text-slate-400 hover:border-orange-500/60 hover:text-orange-400'
                    }`}
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Safe: {calibration.dpiSafeRange}
                </p>

                {dpiTooltipOpen && (
                  <div
                    role="dialog"
                    aria-label="Safe Android DPI Guide"
                    className="absolute left-0 top-full z-40 mt-2 w-72 sm:w-80 rounded-xl border border-slate-700 bg-[#0E121B] p-4 shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          How to Safely Change Android DPI
                        </p>
                        <p className="text-[11px] text-orange-400">
                          Safe Range: {calibration.dpiSafeRange}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDpiTooltipOpen(false)}
                        aria-label="Close DPI guide"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <ol className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-300 list-decimal pl-4">
                      <li>
                        Enable <strong className="text-white">Developer options</strong> via{' '}
                        <span className="font-mono text-slate-200">
                          Settings → About phone → tap Build number 7×
                        </span>
                        .
                      </li>
                      <li>
                        Open{' '}
                        <span className="font-mono text-slate-200">
                          Developer options → Drawing → Smallest width
                        </span>
                        .
                      </li>
                      <li>
                        Note your stock value (
                        <span className="font-mono text-white">
                          {selectedDevice.defaultDpi} dp
                        </span>
                        ) before editing so you can revert anytime.
                      </li>
                      <li>
                        Step up slowly (+20 to +40 dp) and never exceed{' '}
                        <span className="font-mono text-amber-300">620 dp</span> to avoid tiny UI or SystemUI crashes.
                      </li>
                    </ol>

                    {selectedDevice.os === 'iOS' && (
                      <p className="mt-2.5 rounded-md border border-slate-800 bg-[#0B0E14] px-2.5 py-1.5 text-[11px] text-slate-400">
                        On iOS, adjust{' '}
                        <span className="font-mono text-slate-200">
                          Accessibility → Switch Control → Gliding Cursor
                        </span>{' '}
                        instead of Developer DPI.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Fire Button Size</p>
                <p className="mt-1 font-mono text-xl font-bold text-orange-400">
                  {fireButtonOverride}%
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Rec: {calibration.fireButtonSize}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Graphics Target</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {calibration.graphics.display}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  High FPS: {calibration.graphics.highFps}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thermal Headroom</p>
                <p
                  className={`mt-1 font-mono text-xl font-bold ${
                    selectedDevice.thermalHeadroom === 'High'
                      ? 'text-emerald-400'
                      : selectedDevice.thermalHeadroom === 'Moderate'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {selectedDevice.thermalHeadroom}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Target {calibration.graphics.targetFps} FPS
                </p>
              </div>
            </div>
          </div>

          {/* Playstyle, Grip & Range Controls */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] p-5 space-y-5">
            <div>
              <span className="block text-xs font-medium text-slate-300">
                Combat Playstyle
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PLAYSTYLE_META.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangePlaystyle(item.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      playstyle === item.id
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-slate-800 bg-[#0B0E14] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <p className="text-xs font-semibold whitespace-nowrap truncate">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {item.weapons.split(' · ')[0]}
                    </p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {activePlaystyle.weapons} — {activePlaystyle.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-800/80 pt-4">
              <div>
                <span className="block text-xs font-medium text-slate-300">
                  Finger Grip Layout
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
                  {(['2-finger', '3-finger', '4-finger'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onChangeGrip(g)}
                      className={`rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        grip === g
                          ? 'bg-orange-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {g === '2-finger'
                        ? '2-Finger'
                        : g === '3-finger'
                          ? '3-Finger Claw'
                          : '4-Finger Claw'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300">
                  Engagement Distance Bias
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
                  {(['close', 'mid', 'long'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onChangeRangeBias(r)}
                      className={`rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        rangeBias === r
                          ? 'bg-orange-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {r === 'close'
                        ? 'Close (<15m)'
                        : r === 'mid'
                          ? 'Mid (15-35m)'
                          : 'Long (35m+)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sensitivity Sliders + Visual Drag Curve & Fire Button Preview */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Sensitivity Matrix (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800/90 bg-[#111622] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                In-Game Sensitivity Matrix (0–200 Scale)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Calibrated for Free Fire OB44+ 200-point sensitivity range. Fine-tune any axis below.
              </p>
            </div>
            <button
              type="button"
              onClick={onResetOverrides}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Recommended
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {SENSITIVITY_ROWS.map((row) => {
              const val = sensitivityOverrides[row.key];
              const rec = calibration.sensitivity[row.key];
              const diff = val - rec;

              return (
                <div key={row.key} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <label
                        htmlFor={`slider-${row.key}`}
                        className="text-sm font-medium text-white"
                      >
                        {row.label}
                      </label>
                      <span className="ml-2 text-xs text-slate-400 hidden sm:inline">
                        · {row.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {diff !== 0 && (
                        <span className="font-mono text-xs text-slate-400">
                          (Rec {rec})
                        </span>
                      )}
                      <span className="w-11 text-right font-mono text-base font-bold text-orange-400">
                        {val}
                      </span>
                    </div>
                  </div>
                  <input
                    id={`slider-${row.key}`}
                    type="range"
                    min={0}
                    max={200}
                    value={val}
                    onChange={(e) =>
                      onUpdateSensitivity(row.key, Number(e.target.value))
                    }
                    className="tactical-slider w-full"
                  />
                </div>
              );
            })}

            {/* Fire Button Size Slider */}
            <div className="border-t border-slate-800/80 pt-5 space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <label
                    htmlFor="slider-fire-button"
                    className="text-sm font-medium text-white"
                  >
                    Fire Button Size
                  </label>
                  <span className="ml-2 text-xs text-slate-400 hidden sm:inline">
                    · Smaller size increases upward thumb drag travel
                  </span>
                </div>
                <span className="font-mono text-base font-bold text-white">
                  {fireButtonOverride}%
                </span>
              </div>
              <input
                id="slider-fire-button"
                type="range"
                min={32}
                max={70}
                value={fireButtonOverride}
                onChange={(e) => onUpdateFireButton(Number(e.target.value))}
                className="tactical-slider w-full"
              />
            </div>
          </div>
        </div>

        {/* Right: Drag Curve & Fire Button Ergonomics (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Drag Curve Response Graph */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] p-5">
            <h3 className="text-sm font-semibold text-white">
              Chest-to-Head Drag Acceleration Curve
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Visualizes angular camera lift based on your General ({sensitivityOverrides.general}) and Red Dot ({sensitivityOverrides.redDot}) settings.
            </p>

            <div className="mt-4 rounded-lg border border-slate-800 bg-[#0B0E14] p-3">
              <svg
                viewBox="0 0 260 150"
                className="w-full h-36"
                role="img"
                aria-label="Drag acceleration response curve"
              >
                {/* Grid lines */}
                <line x1="20" y1="30" x2="245" y2="30" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="245" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="20" y1="135" x2="245" y2="135" stroke="#334155" />
                <line x1="20" y1="15" x2="20" y2="135" stroke="#334155" />

                {/* Headshot Target Zone Band */}
                <rect x="20" y="18" width="225" height="24" fill="rgba(16, 185, 129, 0.08)" />
                <text x="26" y="33" fill="#34d399" fontSize="9" fontFamily="JetBrains Mono, monospace">
                  HEAD HITBOX LOCK ZONE
                </text>

                <text x="26" y="130" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono, monospace">
                  CHEST AIM
                </text>

                {/* Response Curve */}
                <path
                  d={curvePoints}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="240" cy={22 + (1 - sensitivityOverrides.general / 200) * 28} r="4" fill="#f97316" />
              </svg>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3 border-b border-slate-800/70 pb-2">
                <dt className="text-slate-400">Recommended Technique</dt>
                <dd className="text-right font-medium text-white max-w-[60%]">
                  {calibration.dragGuidance.preferredPattern}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-800/70 pb-2">
                <dt className="text-slate-400">Swipe Timing</dt>
                <dd className="text-right font-medium text-slate-200 max-w-[60%]">
                  {calibration.dragGuidance.swipeSpeed}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Pointer / Tracking</dt>
                <dd className="text-right font-mono text-slate-200 max-w-[60%]">
                  {calibration.pointerSpeed}
                </dd>
              </div>
            </dl>
          </div>

          {/* Fire Button Scale Preview */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                HUD Fire Button Scale Preview
              </h3>
              <span className="font-mono text-xs text-orange-400">
                {fireButtonOverride}% Size
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {calibration.dragGuidance.fireButtonAnchor}
            </p>

            <div className="mt-4 relative h-36 rounded-lg border border-slate-800 bg-[#0B0E14] overflow-hidden flex items-end justify-end p-5">
              {/* Upward drag arrow indicator */}
              <div className="absolute right-12 top-3 bottom-16 flex flex-col items-center justify-between text-slate-600">
                <span className="text-[10px] font-mono text-orange-400/80">DRAG PATH</span>
                <div className="w-px flex-1 bg-gradient-to-t from-orange-500/70 to-transparent my-1" />
              </div>

              {/* Fire Button circle scaled accurately */}
              <div
                style={{
                  width: `${Math.round(fireButtonOverride * 1.15)}px`,
                  height: `${Math.round(fireButtonOverride * 1.15)}px`,
                }}
                className="relative flex items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/15 transition-all duration-150"
              >
                <div className="h-3 w-3 rounded-full bg-orange-400" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
