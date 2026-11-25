import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AdminPanelView } from './components/AdminPanelView';
import { ApprovalStatusView } from './components/ApprovalStatusView';
import { BrandLogo } from './components/BrandLogo';
import { CustomDeviceModal } from './components/CustomDeviceModal';
import { DeviceSensitivityView } from './components/DeviceSensitivityView';
import { DragHeadshotLab } from './components/DragHeadshotLab';
import { LaunchGameModal } from './components/LaunchGameModal';
import { LoginView } from './components/LoginView';
import { PerformanceBoosterView } from './components/PerformanceBoosterView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SavedProfilesView } from './components/SavedProfilesView';
import {
  ADMIN_EMAIL,
  auth,
  db,
  handleFirestoreError,
  isAdminUser,
  logUserAction,
  mapUserDoc,
  OperationType,
  signOutFirebase,
  syncUserOnSignIn,
} from './firebase';
import { DEVICE_CATALOG, PLAYSTYLE_META, mergeMasterCatalog } from './utils/devices';
import {
  CatalogOverrides,
  DeviceSpec,
  DeviceTier,
  FirebaseUserProfile,
  GripType,
  NotificationBlockSettings,
  OperatingSystem,
  PlaystyleId,
  RangeBias,
  SavedProfile,
  SensitivityValues,
  UserActionType,
} from './types';
import {
  buildOptimizationChecklist,
  calculateCalibration,
  formatSetupAsText,
} from './utils/calibration';

type ActiveTab = 'sensitivity' | 'performance' | 'drag-lab' | 'saved';

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
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  const navigateTo = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<FirebaseUserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const syncedSessionUidRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('sensitivity');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [appliedStepsCount, setAppliedStepsCount] = useState(0);
  const [autoCopied, setAutoCopied] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const pendingProfileOverrideRef = useRef<{
    sensitivity: SensitivityValues;
    fireButtonSize: number;
  } | null>(null);
  const sensitivityLogTimerRef = useRef<number | null>(null);

  const [customDevices, setCustomDevices] = useState<DeviceSpec[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.customDevices);
      return raw ? (JSON.parse(raw) as DeviceSpec[]) : [];
    } catch {
      return [];
    }
  });

  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.savedProfiles);
      return raw ? (JSON.parse(raw) as SavedProfile[]) : [];
    } catch {
      return [];
    }
  });

  const [checklistMap, setChecklistMap] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.checklistMap);
      return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  });

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

  const [catalogOverrides, setCatalogOverrides] = useState<CatalogOverrides>({
    upsertedDevices: [],
    removedIds: [],
  });

  const masterDevices = useMemo(
    () => mergeMasterCatalog(DEVICE_CATALOG, catalogOverrides),
    [catalogOverrides]
  );

  const allDevices = useMemo(
    () => [...customDevices, ...masterDevices],
    [customDevices, masterDevices]
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () =>
      allDevices.find((d) => d.id === 'samsung-a54')?.id ??
      allDevices.find((d) => d.id === 'redmi-note-12')?.id ??
      allDevices[0]?.id ??
      DEVICE_CATALOG[0].id
  );
  const [playstyle, setPlaystyle] = useState<PlaystyleId>('one-tap');
  const [grip, setGrip] = useState<GripType>('2-finger');
  const [rangeBias, setRangeBias] = useState<RangeBias>('mid');

  const selectedDevice = useMemo(
    () => allDevices.find((d) => d.id === selectedDeviceId) ?? allDevices[0] ?? DEVICE_CATALOG[0],
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

  useEffect(() => {
    if (pendingProfileOverrideRef.current) {
      const pending = pendingProfileOverrideRef.current;
      pendingProfileOverrideRef.current = null;
      setSensitivityOverrides(pending.sensitivity);
      setFireButtonOverride(pending.fireButtonSize);
      return;
    }
    setSensitivityOverrides(calibration.sensitivity);
    setFireButtonOverride(calibration.fireButtonSize);
  }, [calibration]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        syncedSessionUidRef.current = null;
        setFirebaseUser(null);
        setUserProfile(null);
        setPendingUsersCount(0);
        setAuthChecking(false);
        return;
      }

      setFirebaseUser(user);
      if (syncedSessionUidRef.current !== user.uid) {
        syncedSessionUidRef.current = user.uid;
        try {
          const synced = await syncUserOnSignIn(user, selectedDeviceId);
          setUserProfile(synced);
          if (
            synced.requestedDeviceId &&
            allDevices.some((d) => d.id === synced.requestedDeviceId)
          ) {
            setSelectedDeviceId(synced.requestedDeviceId);
          }
        } catch (err) {
          console.error('Failed syncing Firebase user profile on auth restore:', err);
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to own user profile in Firestore so pending/approved/blocked transitions happen live
  useEffect(() => {
    if (!firebaseUser) return;
    const userPath = `users/${firebaseUser.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(mapUserDoc(firebaseUser.uid, snap.data() as Record<string, unknown>));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );
    return () => unsubscribe();
  }, [firebaseUser]);

  // Subscribe to Firestore device catalog overrides once authenticated
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsubscribe = onSnapshot(
      collection(db, 'catalogDevices'),
      (snap) => {
        const upsertedDevices: DeviceSpec[] = [];
        const removedIds: string[] = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as Record<string, unknown>;
          const id = typeof data.id === 'string' ? data.id : docSnap.id;
          if (data.removed === true) {
            removedIds.push(id);
            continue;
          }
          upsertedDevices.push({
            id,
            brand: typeof data.brand === 'string' ? data.brand : 'Custom',
            model: typeof data.model === 'string' ? data.model : 'Device',
            tier: (typeof data.tier === 'string' ? data.tier : 'mid') as DeviceTier,
            os: (typeof data.os === 'string' ? data.os : 'Android') as OperatingSystem,
            ramGb: typeof data.ramGb === 'number' ? data.ramGb : 8,
            refreshHz: typeof data.refreshHz === 'number' ? data.refreshHz : 120,
            touchSamplingHz:
              typeof data.touchSamplingHz === 'number' ? data.touchSamplingHz : 240,
            ppi: typeof data.ppi === 'number' ? data.ppi : 400,
            screenInches: typeof data.screenInches === 'number' ? data.screenInches : 6.67,
            chipset:
              typeof data.chipset === 'string'
                ? data.chipset
                : 'Snapdragon / Dimensity',
            defaultDpi: typeof data.defaultDpi === 'number' ? data.defaultDpi : 392,
            recommendedDpi:
              typeof data.recommendedDpi === 'number' ? data.recommendedDpi : 510,
            thermalHeadroom: (typeof data.thermalHeadroom === 'string'
              ? data.thermalHeadroom
              : 'Moderate') as 'Tight' | 'Moderate' | 'High',
            presetSensitivity:
              data.presetSensitivity && typeof data.presetSensitivity === 'object'
                ? (data.presetSensitivity as SensitivityValues)
                : undefined,
            presetFireButton:
              typeof data.presetFireButton === 'number' ? data.presetFireButton : undefined,
          });
        }
        setCatalogOverrides({ upsertedDevices, removedIds });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'catalogDevices');
      }
    );
    return () => unsubscribe();
  }, [firebaseUser]);

  // Live pending count badge for pucuz999@gmail.com
  const isVerifiedAdmin = isAdminUser(firebaseUser);
  useEffect(() => {
    if (!firebaseUser || !isVerifiedAdmin) {
      setPendingUsersCount(0);
      return;
    }
    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setPendingUsersCount(snap.size);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    return () => unsubscribe();
  }, [firebaseUser, isVerifiedAdmin]);

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

  const recordAction = useCallback(
    (action: UserActionType, details: string) => {
      if (!firebaseUser || !userProfile) return;
      void logUserAction(firebaseUser, action, details);
    },
    [firebaseUser, userProfile]
  );

  const handleAuthComplete = (user: User, profile: FirebaseUserProfile) => {
    syncedSessionUidRef.current = user.uid;
    setFirebaseUser(user);
    setUserProfile(profile);
    if (
      profile.requestedDeviceId &&
      allDevices.some((d) => d.id === profile.requestedDeviceId)
    ) {
      setSelectedDeviceId(profile.requestedDeviceId);
    }
  };

  const handleRefreshProfile = async () => {
    if (!firebaseUser) return;
    setRefreshingStatus(true);
    try {
      const fresh = await syncUserOnSignIn(firebaseUser, selectedDeviceId);
      setUserProfile(fresh);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleLogout = async () => {
    await signOutFirebase(firebaseUser);
    syncedSessionUidRef.current = null;
    setFirebaseUser(null);
    setUserProfile(null);
    setPendingUsersCount(0);
    setActiveTab('sensitivity');
    setMobileMenuOpen(false);
    if (isAdminRoute) {
      navigateTo('/');
    }
  };

  const handleSelectDevice = (device: DeviceSpec) => {
    setSelectedDeviceId(device.id);
    recordAction('select_device', `Selected ${device.brand} ${device.model}`);
    if (firebaseUser && userProfile) {
      const path = `users/${firebaseUser.uid}`;
      void updateDoc(doc(db, 'users', firebaseUser.uid), {
        requestedDeviceId: device.id.slice(0, 64),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
    }
  };

  const handleSaveCustomDevice = (device: DeviceSpec) => {
    setCustomDevices((prev) => [device, ...prev]);
    setSelectedDeviceId(device.id);
    setActiveTab('sensitivity');
    recordAction('select_device', `Added custom device ${device.brand} ${device.model}`);
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
    recordAction(
      'save_preset',
      `Saved preset "${name}" for ${selectedDevice.brand} ${selectedDevice.model}`
    );
  };

  const handleLoadProfile = (profile: SavedProfile) => {
    const exists = allDevices.some((d) => d.id === profile.deviceId);
    const sameContext =
      (!exists || profile.deviceId === selectedDeviceId) &&
      profile.playstyle === playstyle &&
      profile.grip === grip &&
      profile.rangeBias === rangeBias;

    if (sameContext) {
      setSensitivityOverrides(profile.sensitivity);
      setFireButtonOverride(profile.fireButtonSize);
    } else {
      pendingProfileOverrideRef.current = {
        sensitivity: profile.sensitivity,
        fireButtonSize: profile.fireButtonSize,
      };
      if (exists) {
        setSelectedDeviceId(profile.deviceId);
      }
      setPlaystyle(profile.playstyle);
      setGrip(profile.grip);
      setRangeBias(profile.rangeBias);
    }
    setActiveTab('sensitivity');
    navigateTo('/');
    recordAction('view_tab', `Loaded preset "${profile.name}"`);
  };

  const handleToggleChecklistStep = (stepId: string) => {
    setChecklistMap((prev) => {
      const current = prev[selectedDevice.id] ?? [];
      const exists = current.includes(stepId);
      const next = exists
        ? current.filter((id) => id !== stepId)
        : [...current, stepId];
      recordAction(
        'toggle_optimization',
        `${exists ? 'Unchecked' : 'Enabled'} optimization step "${stepId}" on ${selectedDevice.brand} ${selectedDevice.model}`
      );
      return { ...prev, [selectedDevice.id]: next };
    });
  };

  const handleResetChecklist = () => {
    setChecklistMap((prev) => ({ ...prev, [selectedDevice.id]: [] }));
    recordAction(
      'toggle_optimization',
      `Reset FPS checklist for ${selectedDevice.brand} ${selectedDevice.model}`
    );
  };

  const handleSensitivityChange = (key: keyof SensitivityValues, value: number) => {
    setSensitivityOverrides((prev) => ({ ...prev, [key]: value }));
    if (sensitivityLogTimerRef.current) {
      window.clearTimeout(sensitivityLogTimerRef.current);
    }
    sensitivityLogTimerRef.current = window.setTimeout(() => {
      recordAction(
        'update_sensitivity',
        `Adjusted ${key} to ${value} on ${selectedDevice.brand} ${selectedDevice.model}`
      );
    }, 2000);
  };

  const activeNavLabel = isAdminRoute
    ? 'Admin Console (/admin)'
    : BASE_NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Sensitivity & DPI';

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
    recordAction(
      'apply_launch',
      `Applied & launched ${selectedDevice.brand} ${selectedDevice.model} (General ${sensitivityOverrides.general}, DPI ${calibration.dpiValue})`
    );
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="flex justify-center">
            <BrandLogo size="lg" centered />
          </h1>
          <p className="mt-2 text-xs text-slate-400">Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <LoginView
        devices={allDevices}
        isAdminRoute={isAdminRoute}
        onNavigateHome={() => navigateTo('/')}
        onAuthComplete={handleAuthComplete}
      />
    );
  }

  const effectiveProfile: FirebaseUserProfile = userProfile ?? {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || 'Player',
    photoURL: firebaseUser.photoURL || '',
    status: isVerifiedAdmin ? 'approved' : 'pending',
    role: isVerifiedAdmin ? 'admin' : 'user',
    requestedDeviceId: selectedDeviceId,
    createdAt: null,
    lastLoginAt: null,
    updatedAt: null,
  };

  // Strict /admin route guard: accessible ONLY to pucuz999@gmail.com
  if (isAdminRoute && !isVerifiedAdmin) {
    return (
      <ApprovalStatusView
        profile={effectiveProfile}
        refreshing={refreshingStatus}
        onRefresh={handleRefreshProfile}
        onSignOut={handleLogout}
        onGoHome={effectiveProfile.status === 'approved' ? () => navigateTo('/') : undefined}
        titleOverride="Access Denied"
        descriptionOverride={`The /admin dashboard is restricted exclusively to ${ADMIN_EMAIL}. You are currently signed in as ${effectiveProfile.email}.`}
      />
    );
  }

  // Gate main app: ONLY users with status 'approved' (or verified admin pucuz999@gmail.com) may enter
  if (!isAdminRoute && !isVerifiedAdmin && effectiveProfile.status !== 'approved') {
    return (
      <ApprovalStatusView
        profile={effectiveProfile}
        refreshing={refreshingStatus}
        onRefresh={handleRefreshProfile}
        onSignOut={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/90 bg-[#0E121B]">
        <div className="flex h-16 items-center px-6 border-b border-slate-800/80">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('sensitivity');
              navigateTo('/');
            }}
            className="inline-flex items-center whitespace-nowrap shrink-0"
          >
            <BrandLogo size="md" />
          </a>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary Workspace">
          {BASE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = !isAdminRoute && activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  navigateTo('/');
                  recordAction('view_tab', `Opened ${item.label}`);
                }}
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

          {isVerifiedAdmin && (
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/admin');
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isAdminRoute
                  ? 'bg-orange-500/12 text-orange-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="truncate">Admin (/admin)</span>
              </span>
              {pendingUsersCount > 0 && (
                <span className="rounded-md bg-orange-500 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-950">
                  {pendingUsersCount}
                </span>
              )}
            </a>
          )}
        </nav>

        {/* Active Hardware & Account Footer */}
        <div className="border-t border-slate-800/80 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Selected Hardware</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {selectedDevice.brand} {selectedDevice.model}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {selectedDevice.ramGb} GB · {selectedDevice.refreshHz} Hz · {activePlaystyleName}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {effectiveProfile.displayName}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-400">
                {effectiveProfile.email}
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
              <BrandLogo size="md" />
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
              {BASE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = !isAdminRoute && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      navigateTo('/');
                      setMobileMenuOpen(false);
                      recordAction('view_tab', `Opened ${item.label}`);
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

              {isVerifiedAdmin && (
                <a
                  href="/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-colors ${
                    isAdminRoute
                      ? 'bg-orange-500/12 text-orange-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Admin (/admin)</span>
                  </span>
                  {pendingUsersCount > 0 && (
                    <span className="rounded-md bg-orange-500 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-950">
                      {pendingUsersCount}
                    </span>
                  )}
                </a>
              )}
            </nav>
            <div className="border-t border-slate-800 p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {effectiveProfile.displayName}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-400">
                  {effectiveProfile.email}
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
              <span className="font-semibold text-white truncate">{activeNavLabel}</span>
              {!isAdminRoute && (
                <>
                  <span className="text-slate-600 hidden md:inline">·</span>
                  <span className="text-xs text-slate-400 hidden md:inline truncate">
                    {selectedDevice.brand} {selectedDevice.model}
                  </span>
                </>
              )}
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

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {isAdminRoute && isVerifiedAdmin ? (
            <AdminPanelView
              currentUser={firebaseUser}
              devices={allDevices}
              masterDevices={masterDevices}
              catalogOverrides={catalogOverrides}
              onPendingCountChange={setPendingUsersCount}
            />
          ) : (
            <>
              {activeTab === 'sensitivity' && (
                <DeviceSensitivityView
                  devices={allDevices}
                  selectedDevice={selectedDevice}
                  onSelectDevice={handleSelectDevice}
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
                  onUpdateSensitivity={handleSensitivityChange}
                  onUpdateFireButton={setFireButtonOverride}
                  onResetOverrides={() => {
                    setSensitivityOverrides(calibration.sensitivity);
                    setFireButtonOverride(calibration.fireButtonSize);
                    recordAction(
                      'update_sensitivity',
                      `Reset sensitivity overrides for ${selectedDevice.brand} ${selectedDevice.model}`
                    );
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
                  onDeleteProfile={(id) => {
                    setSavedProfiles((prev) => prev.filter((p) => p.id !== id));
                    recordAction('delete_preset', `Deleted preset ${id}`);
                  }}
                  onImportProfiles={(incoming) => {
                    setSavedProfiles((prev) => {
                      const existingIds = new Set(prev.map((p) => p.id));
                      const fresh = incoming.filter(
                        (p) => p && typeof p.id === 'string' && !existingIds.has(p.id)
                      );
                      return [...fresh, ...prev];
                    });
                    recordAction('save_preset', `Imported ${incoming.length} preset(s)`);
                  }}
                />
              )}
            </>
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
