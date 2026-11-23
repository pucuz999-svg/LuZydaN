import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DeviceSpec, OperatingSystem } from '../types';

interface CustomDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (device: DeviceSpec) => void;
}

export const CustomDeviceModal: React.FC<CustomDeviceModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [brand, setBrand] = useState('Custom');
  const [model, setModel] = useState('');
  const [os, setOs] = useState<OperatingSystem>('Android');
  const [ramGb, setRamGb] = useState(6);
  const [refreshHz, setRefreshHz] = useState(90);
  const [touchSamplingHz, setTouchSamplingHz] = useState(240);
  const [screenInches, setScreenInches] = useState(6.6);
  const [defaultDpi, setDefaultDpi] = useState(392);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanModel = model.trim() || `${ramGb}GB ${refreshHz}Hz Device`;
    const tier =
      os === 'iOS'
        ? 'ios'
        : ramGb <= 3
          ? 'low'
          : ramGb <= 6
            ? 'mid'
            : refreshHz >= 144
              ? 'gaming'
              : 'high';

    const recommendedDpi =
      os === 'iOS'
        ? 116
        : Math.min(600, Math.max(430, defaultDpi + (ramGb <= 3 ? 85 : 145)));

    const newDevice: DeviceSpec = {
      id: `custom-${Date.now()}`,
      brand: brand.trim() || 'Custom',
      model: cleanModel,
      tier,
      os,
      ramGb,
      refreshHz,
      touchSamplingHz,
      ppi: screenInches >= 8 ? 300 : 400,
      screenInches,
      chipset: os === 'iOS' ? 'Apple Silicon' : `${ramGb}GB Mobile SoC`,
      defaultDpi: os === 'iOS' ? 100 : defaultDpi,
      recommendedDpi,
      thermalHeadroom: ramGb <= 3 ? 'Tight' : ramGb <= 6 ? 'Moderate' : 'High',
      isCustom: true,
    };

    onSave(newDevice);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-device-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#111622] p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 id="custom-device-title" className="text-lg font-semibold text-white">
              Add Custom Device Profile
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Enter your phone or tablet hardware specs to compute tailored sensitivity and FPS presets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="custom-brand" className="block text-xs font-medium text-slate-300">
                Brand
              </label>
              <input
                id="custom-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Tecno, Motorola, Samsung"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="custom-model" className="block text-xs font-medium text-slate-300">
                Model Name
              </label>
              <input
                id="custom-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Pova 5 Pro"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-medium text-slate-300">Operating System</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
                {(['Android', 'iOS'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setOs(item)}
                    className={`rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      os === item
                        ? 'bg-orange-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="custom-ram" className="block text-xs font-medium text-slate-300">
                RAM Capacity
              </label>
              <select
                id="custom-ram"
                value={ramGb}
                onChange={(e) => setRamGb(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {[2, 3, 4, 6, 8, 12, 16].map((gb) => (
                  <option key={gb} value={gb}>
                    {gb} GB RAM
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="custom-hz" className="block text-xs font-medium text-slate-300">
                Refresh Rate
              </label>
              <select
                id="custom-hz"
                value={refreshHz}
                onChange={(e) => setRefreshHz(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {[60, 90, 120, 144, 165].map((hz) => (
                  <option key={hz} value={hz}>
                    {hz} Hz
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="custom-touch" className="block text-xs font-medium text-slate-300">
                Touch Sampling
              </label>
              <select
                id="custom-touch"
                value={touchSamplingHz}
                onChange={(e) => setTouchSamplingHz(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {[120, 180, 240, 360, 480, 720].map((hz) => (
                  <option key={hz} value={hz}>
                    {hz} Hz
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="custom-screen" className="block text-xs font-medium text-slate-300">
                Screen Size (in)
              </label>
              <input
                id="custom-screen"
                type="number"
                step="0.1"
                min="4.7"
                max="13.0"
                value={screenInches}
                onChange={(e) => setScreenInches(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {os === 'Android' && (
            <div>
              <label htmlFor="custom-dpi" className="block text-xs font-medium text-slate-300">
                Stock Smallest Width DPI (Usually 360, 392, or 411)
              </label>
              <input
                id="custom-dpi"
                type="number"
                min="300"
                max="550"
                value={defaultDpi}
                onChange={(e) => setDefaultDpi(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
            >
              Calculate Calibration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
