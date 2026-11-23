import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Crosshair,
  Gauge,
  LogOut,
  Menu,
  Rocket,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';
import { AdminPanelView } from './components/AdminPanelView';
import { CustomDeviceModal } from './components/CustomDeviceModal';
import { DeviceSensitivityView } from './components/DeviceSensitivityView';
import { DragHeadshotLab } from './components/DragHeadshotLab';
import { LaunchGameModal } from './components/LaunchGameModal';
import { LoginView } from './components/LoginView';
import { PerformanceBoosterView } from './components/PerformanceBoosterView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SavedProfilesView } from './components/SavedProfilesView';
import { DEVICE_CATALOG, PLAYSTYLE_META } from './data/devices';
import {
  AuthUser,
  DeviceSpec,
  GripType,
  NotificationBlockSettings,
  PlaystyleId,
  RangeBias,
  SavedProfile,
  SensitivityValues,
} from './types';
import {
  buildOptimizationChecklist,
  calculateCalibration,
  formatSetupAsText,
} from './utils/calibration';

type ActiveTab = 'sensitivity' | 'performance' | 'drag-lab' | 'saved' | 'admin';

const STORAGE_KEYS = {
  customDevices: 'firetune_custom_devices_v1',
  savedProfiles: 'firetune_saved_profiles_v1',
  checklistMap: 'firetune_checklist_v1',
  notificationBlock: 'firetune_notification_block_v1',
};

const DEFAULT_NOTIFICATION_BLOCK: NotificationBlockSettings = {
  enabled: true,
  blockHeadsUp: true,
  blockCalls: true,
  blockFloatingBubbles: true,
  muteInAppAlerts: false,
};

const BASE_NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'sensitivity', label: 'Sensitivity & DPI', icon: Sliders },
  { id: 'performance', label: 'FPS & Performance', icon: Gauge },
  { id: 'drag-lab', label: 'Drag Headshot Lab', icon: Crosshair },
  { id: 'saved', label: 'Saved Presets', icon: Bookmark },
];

export default function App() {
  // Bearer session held strictly in React/JS memory (not localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('sensitivity');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [appliedStepsCount, setAppliedStepsCount] = useState(0);
  const [autoCopied, setAutoCopied] = useState(false);

  // Persisted custom devices
  const [customDevices, setCustomDevices] = useState<DeviceSpec[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.customDevices);
      return raw ? (JSON.parse(raw) as DeviceSpec[]) : [];
    } catch {
      return [];
    }
  });

  // Persisted saved profiles
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.savedProfiles);
      return raw ? (JSON.parse(raw) as SavedProfile[]) : [];
    } catch {
      return [];
    }
  });

  // Persisted optimization checklist completion by device id
  const [checklistMap, setChecklistMap] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.checklistMap);
      return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  });

  // Persisted notification block preferences
  const [notificationBlock, setNotificationBlock] = useState<NotificationBlockSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.notificationBlock);
      return raw
        ? ({ ...DEFAULT_NOTIFICATION_BLOCK, ...JSON.parse(raw) } as NotificationBlockSettings)
        : DEFAULT_NOTIFICATION_BLOCK;
    } catch {
      return DEFAULT_NOTIFICATION_BLOCK;
    }
  });

  const allDevices = useMemo(
    () => [...customDevices, ...DEVICE_CATALOG],
    [customDevices]
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => allDevices.find((d) => d.id === 'redmi-note-12')?.id ?? allDevices[0].id
  );
  const [playstyle, setPlaystyle] = useState<PlaystyleId>('one-tap');
  const [grip, setGrip] = useState<GripType>('2-finger');
  const [rangeBias, setRangeBias] = useState<RangeBias>('mid');

  const selectedDevice = useMemo(
    () => allDevices.find((d) => d.id === selectedDeviceId) ?? allDevices[0],
    [allDevices, selectedDeviceId]
  );

  const calibration = useMemo(
    () => calculateCalibration(selectedDevice, playstyle, grip, rangeBias),
    [selectedDevice, playstyle, grip, rangeBias]
  );

  const [sensitivityOverrides, setSensitivityOverrides] =
    useState<SensitivityValues>(calibration.sensitivity);
  const [fireButtonOverride, setFireButtonOverride] = useState<number>(
    calibration.fireButtonSize
  );

  // Sync slider overrides when device/playstyle/grip/range changes
  useEffect(() => {
    setSensitivityOverrides(calibration.sensitivity);
    setFireButtonOverride(calibration.fireButtonSize);
  }, [calibration]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.customDevices, JSON.stringify(customDevices));
    } catch {
      // Ignore storage quota errors
    }
  }, [customDevices]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.savedProfiles, JSON.stringify(savedProfiles));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedProfiles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.checklistMap, JSON.stringify(checklistMap));
    } catch {
      // Ignore storage quota errors
    }
  }, [checklistMap]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.notificationBlock,
        JSON.stringify(notificationBlock)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [notificationBlock]);

  const handleSaveCustomDevice = (device: DeviceSpec) => {
    setCustomDevices((prev) => [device, ...prev]);
    setSelectedDeviceId(device.id);
    setActiveTab('sensitivity');
  };

  const handleSaveProfile = (name: string) => {
    const newProfile: SavedProfile = {
      id: `prof-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      deviceId: selectedDevice.id,
      deviceLabel: `${selectedDevice.brand} ${selectedDevice.model}`,
      os: selectedDevice.os,
      ramGb: selectedDevice.ramGb,
      refreshHz: selectedDevice.refreshHz,
      playstyle,
      grip,
      rangeBias,
      sensitivity: { ...sensitivityOverrides },
      fireButtonSize: fireButtonOverride,
      dpiValue: calibration.dpiValue,
      dpiLabel: calibration.dpiLabel,
      graphicsDisplay: calibration.graphics.display,
      highFps: calibration.graphics.highFps,
      notes: '',
    };
    setSavedProfiles((prev) => [newProfile, ...prev]);
  };

  const handleLoadProfile = (profile: SavedProfile) => {
    const exists = allDevices.some((d) => d.id === profile.deviceId);
    if (exists) {
      setSelectedDeviceId(profile.deviceId);
    }
    setPlaystyle(profile.playstyle);
    setGrip(profile.grip);
    setRangeBias(profile.rangeBias);
    // Apply exact saved values after calibration effect runs
    setTimeout(() => {
      setSensitivityOverrides(profile.sensitivity);
      setFireButtonOverride(profile.fireButtonSize);
    }, 0);
    setActiveTab('sensitivity');
  };

  const handleToggleChecklistStep = (stepId: string) => {
    setChecklistMap((prev) => {
      const current = prev[selectedDevice.id] ?? [];
      const exists = current.includes(stepId);
      const next = exists
        ? current.filter((id) => id !== stepId)
        : [...current, stepId];
      return { ...prev, [selectedDevice.id]: next };
    });
  };

  const handleResetChecklist = () => {
    setChecklistMap((prev) => ({ ...prev, [selectedDevice.id]: [] }));
  };

  const navItems = useMemo(() => {
    if (authUser?.role === 'admin') {
      return [
        ...BASE_NAV_ITEMS,
        { id: 'admin' as const, label: 'Admin & Requests', icon: ShieldCheck },
      ];
    }
    return BASE_NAV_ITEMS;
  }, [authUser?.role]);

  const handleLoginSuccess = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    if (user.assignedDeviceId && allDevices.some((d) => d.id === user.assignedDeviceId)) {
      setSelectedDeviceId(user.assignedDeviceId);
    }
    setActiveTab(user.role === 'admin' ? 'admin' : 'sensitivity');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    setActiveTab('sensitivity');
    setMobileMenuOpen(false);
  };

  const activeNavLabel =
    navItems.find((n) => n.id === activeTab)?.label ?? 'Sensitivity & DPI';

  const activePlaystyleName =
    PLAYSTYLE_META.find((p) => p.id === playstyle)?.name ?? 'One-Tap Precision';

  const handleApplyAndLaunch = async () => {
    const steps = buildOptimizationChecklist(selectedDevice);
    const stepIds = steps.map((s) => s.id);

    setChecklistMap((prev) => ({
      ...prev,
      [selectedDevice.id]: stepIds,
    }));
    setAppliedStepsCount(stepIds.length);

    try {
      localStorage.setItem(
        'firetune_active_applied_v1',
        JSON.stringify({
          appliedAt: new Date().toISOString(),
          deviceId: selectedDevice.id,
          deviceLabel: `${selectedDevice.brand} ${selectedDevice.model}`,
          playstyle,
          grip,
          rangeBias,
          sensitivity: sensitivityOverrides,
          fireButtonSize: fireButtonOverride,
          dpiValue: calibration.dpiValue,
          graphics: calibration.graphics,
        })
      );
    } catch {
      // Ignore storage quota errors
    }

    let copiedOk = false;
    try {
      const mergedCal = {
        ...calibration,
        sensitivity: sensitivityOverrides,
        fireButtonSize: fireButtonOverride,
      };
      await navigator.clipboard.writeText(
        formatSetupAsText(selectedDevice, mergedCal, activePlaystyleName, grip)
      );
      copiedOk = true;
    } catch {
      copiedOk = false;
    }

    setAutoCopied(copiedOk);
    setLaunchModalOpen(true);
  };

  if (!authUser || !authToken) {
    return <LoginView devices={allDevices} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/90 bg-[#0E121B]">
        <div className="flex h-16 items-center px-6 border-b border-slate-800/80">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('sensitivity');
            }}
            className="text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Fire<span className="text-orange-500">Tune</span>
          </a>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary Workspace">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-500/12 text-orange-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'saved' && savedProfiles.length > 0 && (
                  <span className="font-mono text-xs text-slate-400">
                    {savedProfiles.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Hardware & Account Footer */}
        <div className="border-t border-slate-800/80 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-medium text-slate-400">
              Selected Hardware
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {selectedDevice.brand} {selectedDevice.model}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {selectedDevice.ramGb} GB · {selectedDevice.refreshHz} Hz · {activePlaystyleName}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-white">
                {authUser.customId}
              </p>
              <p className="text-[11px] text-slate-400">
                {authUser.role === 'admin' ? 'Administrator' : 'Customer'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-[#0E121B] border-r border-slate-800">
            <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800">
              <span className="text-xl font-bold tracking-tight text-white">
                Fire<span className="text-orange-500">Tune</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-orange-500/12 text-orange-400'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'saved' && savedProfiles.length > 0 && (
                      <span className="font-mono text-xs text-slate-400">
                        {savedProfiles.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-800 p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-white">
                  {authUser.customId}
                </p>
                <p className="text-[11px] text-slate-400">
                  {authUser.role === 'admin' ? 'Administrator' : 'Customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb Left · Single Primary Action Right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-6 border-b border-slate-800/80 bg-[#0B0E14]/90 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 lg:hidden shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Workspace
              </span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="font-semibold text-white truncate">
                {activeNavLabel}
              </span>
              <span className="text-slate-600 hidden md:inline">·</span>
              <span className="text-xs text-slate-400 hidden md:inline truncate">
                {selectedDevice.brand} {selectedDevice.model}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleApplyAndLaunch}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              <Rocket className="h-3.5 w-3.5" />
              Apply &amp; Launch
            </button>
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {activeTab === 'sensitivity' && (
            <DeviceSensitivityView
              devices={allDevices}
              selectedDevice={selectedDevice}
              onSelectDevice={(d) => setSelectedDeviceId(d.id)}
              onOpenCustomModal={() => setCustomModalOpen(true)}
              playstyle={playstyle}
              onChangePlaystyle={setPlaystyle}
              grip={grip}
              onChangeGrip={setGrip}
              rangeBias={rangeBias}
              onChangeRangeBias={setRangeBias}
              calibration={calibration}
              sensitivityOverrides={sensitivityOverrides}
              fireButtonOverride={fireButtonOverride}
              onUpdateSensitivity={(key, value) =>
                setSensitivityOverrides((prev) => ({ ...prev, [key]: value }))
              }
              onUpdateFireButton={setFireButtonOverride}
              onResetOverrides={() => {
                setSensitivityOverrides(calibration.sensitivity);
                setFireButtonOverride(calibration.fireButtonSize);
              }}
              onSaveProfile={handleSaveProfile}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceBoosterView
              device={selectedDevice}
              calibration={calibration}
              completedStepIds={checklistMap[selectedDevice.id] ?? []}
              onToggleStep={handleToggleChecklistStep}
              onResetSteps={handleResetChecklist}
              notificationBlock={notificationBlock}
              onUpdateNotificationBlock={setNotificationBlock}
            />
          )}

          {activeTab === 'drag-lab' && (
            <DragHeadshotLab
              sensitivity={sensitivityOverrides}
              fireButtonSize={fireButtonOverride}
            />
          )}

          {activeTab === 'saved' && (
            <SavedProfilesView
              profiles={savedProfiles}
              onLoadProfile={handleLoadProfile}
              onDeleteProfile={(id) =>
                setSavedProfiles((prev) => prev.filter((p) => p.id !== id))
              }
              onImportProfiles={(incoming) =>
                setSavedProfiles((prev) => {
                  const existingIds = new Set(prev.map((p) => p.id));
                  const fresh = incoming.filter(
                    (p) => p && typeof p.id === 'string' && !existingIds.has(p.id)
                  );
                  return [...fresh, ...prev];
                })
              }
            />
          )}

          {activeTab === 'admin' && authUser.role === 'admin' && (
            <AdminPanelView
              token={authToken}
              currentAdminId={authUser.customId}
              devices={allDevices}
              onAdminCredentialsUpdated={(nextToken, nextUser) => {
                setAuthToken(nextToken);
                setAuthUser(nextUser);
              }}
              onResetAdminClaim={handleLogout}
            />
          )}
        </main>
      </div>

      <CustomDeviceModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        onSave={handleSaveCustomDevice}
      />

      <LaunchGameModal
        isOpen={launchModalOpen}
        onClose={() => setLaunchModalOpen(false)}
        device={selectedDevice}
        playstyleName={activePlaystyleName}
        grip={grip}
        calibration={calibration}
        sensitivity={sensitivityOverrides}
        fireButtonSize={fireButtonOverride}
        appliedStepsCount={appliedStepsCount}
        autoCopied={autoCopied}
        notificationBlock={notificationBlock}
      />
    </div>
  );
}
