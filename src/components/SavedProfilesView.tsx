import React, { useState } from 'react';
import { Check, Copy, Download, Trash2, Upload } from 'lucide-react';
import { SavedProfile } from '../types';

interface SavedProfilesViewProps {
  profiles: SavedProfile[];
  onLoadProfile: (profile: SavedProfile) => void;
  onDeleteProfile: (id: string) => void;
  onImportProfiles: (incoming: SavedProfile[]) => void;
}

export const SavedProfilesView: React.FC<SavedProfilesViewProps> = ({
  profiles,
  onLoadProfile,
  onDeleteProfile,
  onImportProfiles,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCopyProfile = async (p: SavedProfile) => {
    const text = [
      `FireTune Preset: ${p.name}`,
      `Device: ${p.deviceLabel} (${p.ramGb}GB · ${p.refreshHz}Hz · ${p.os})`,
      `General: ${p.sensitivity.general} | Red Dot: ${p.sensitivity.redDot} | 2x: ${p.sensitivity.scope2x} | 4x: ${p.sensitivity.scope4x} | Sniper: ${p.sensitivity.sniperScope} | Free Look: ${p.sensitivity.freeLook}`,
      `Fire Button: ${p.fireButtonSize}% | ${p.dpiLabel}: ${p.dpiValue} | Graphics: ${p.graphicsDisplay} (${p.highFps} FPS)`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(profiles, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firetune-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          setImportError('Invalid profile backup format.');
          return;
        }
        onImportProfiles(parsed as SavedProfile[]);
      } catch {
        setImportError('Could not read JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#111622] p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Saved Sensitivity &amp; Device Presets
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Compare calibrated profiles side by side or export a backup JSON across devices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#161C2B] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap">
            <Upload className="h-3.5 w-3.5 text-slate-400" />
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Export All
            </button>
          )}
        </div>
      </div>

      {importError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {importError}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-slate-800/90 bg-[#111622] px-6 py-16 text-center">
          <h3 className="text-base font-semibold text-white">
            No Saved Presets Yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
            Select your phone or tablet in the Device &amp; Sensitivity tab, tune your sliders, and click <strong className="text-slate-200">Save Preset</strong> to store and compare configurations here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-[#111622]">
          <table className="w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                <th className="px-5 py-3.5">Preset &amp; Device</th>
                <th className="px-3 py-3.5 text-right">General</th>
                <th className="px-3 py-3.5 text-right">Red Dot</th>
                <th className="px-3 py-3.5 text-right">2x</th>
                <th className="px-3 py-3.5 text-right">4x</th>
                <th className="px-3 py-3.5 text-right">Fire %</th>
                <th className="px-3 py-3.5 text-right">DPI / Speed</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {p.deviceLabel} · {p.ramGb} GB · {p.refreshHz} Hz · {p.graphicsDisplay}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono font-semibold text-orange-400">
                    {p.sensitivity.general}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-200">
                    {p.sensitivity.redDot}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-200">
                    {p.sensitivity.scope2x}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-200">
                    {p.sensitivity.scope4x}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-200">
                    {p.fireButtonSize}%
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-200">
                    {p.dpiValue}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadProfile(p)}
                        className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-orange-500 hover:text-white transition-colors"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyProfile(p)}
                        aria-label={`Copy ${p.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        {copiedId === p.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProfile(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
