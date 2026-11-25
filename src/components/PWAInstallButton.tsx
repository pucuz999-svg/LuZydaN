import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#161C2B] px-3 py-2 text-xs font-medium text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-orange-400" />
        Install App
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#111622] p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-5 w-5 text-orange-400 shrink-0" />
                <div>
                  <h2
                    id="pwa-install-title"
                    className="text-base font-semibold text-white"
                  >
                    Install FF TUNE as an App
                  </h2>
                  <p className="text-xs text-slate-400">
                    Add to your home screen or desktop for offline access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              {isIOS ? (
                <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5 space-y-1.5">
                  <p className="font-semibold text-white">iPhone / iPad (Safari)</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Tap the <strong className="text-white">Share</strong> button in Safari&apos;s toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong className="text-white">Add</strong> to launch FF TUNE standalone.
                    </li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5 space-y-1.5">
                    <p className="font-semibold text-white">Android (Chrome / Edge)</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>
                        Open the browser menu (<span className="font-mono text-slate-200">⋮</span>) in the top-right corner.
                      </li>
                      <li>
                        Tap <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.
                      </li>
                    </ol>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0B0E14] p-3.5 space-y-1.5">
                    <p className="font-semibold text-white">Desktop (Chrome / Edge)</p>
                    <p>
                      Click the <strong className="text-white">Install</strong> icon on the right side of the address bar, or open browser menu → <strong className="text-white">Cast, save, and share → Install page as app</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
