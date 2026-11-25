import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  db,
  formatTimestampToIso,
  handleFirestoreError,
  logUserAction,
  mapUserDoc,
  OperationType,
} from '../firebase';
import {
  ActivityLogEntry,
  CatalogOverrides,
  DeviceSpec,
  DeviceTier,
  FirebaseUserProfile,
  OperatingSystem,
  UserActionType,
  UserApprovalStatus,
} from '../types';
import { DEVICE_CATALOG } from '../utils/devices';

interface AdminPanelViewProps {
  currentUser: User;
  devices: DeviceSpec[];
  masterDevices: DeviceSpec[];
  catalogOverrides: CatalogOverrides;
  onPendingCountChange?: (count: number) => void;
}

type AdminSectionTab = 'users' | 'activity' | 'catalog';
type UserStatusFilter = 'all' | UserApprovalStatus;
type CatalogBrandFilter = 'all' | 'samsung' | 'xiaomi' | 'motorola' | 'vivo' | 'other';

interface DeviceFormState {
  id: string;
  brand: string;
  model: string;
  tier: DeviceTier;
  os: OperatingSystem;
  ramGb: number;
  refreshHz: number;
  touchSamplingHz: number;
  ppi: number;
  screenInches: number;
  chipset: string;
  defaultDpi: number;
  recommendedDpi: number;
  thermalHeadroom: 'Tight' | 'Moderate' | 'High';
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  sniperScope: number;
  freeLook: number;
  fireButton: number;
}

const EMPTY_DEVICE_FORM: DeviceFormState = {
  id: '',
  brand: 'Xiaomi',
  model: '',
  tier: 'mid',
  os: 'Android',
  ramGb: 8,
  refreshHz: 120,
  touchSamplingHz: 240,
  ppi: 400,
  screenInches: 6.67,
  chipset: 'Snapdragon 7s Gen 2',
  defaultDpi: 392,
  recommendedDpi: 515,
  thermalHeadroom: 'Moderate',
  general: 184,
  redDot: 173,
  scope2x: 155,
  scope4x: 137,
  sniperScope: 89,
  freeLook: 161,
  fireButton: 46,
};

function deviceToFormState(device: DeviceSpec): DeviceFormState {
  return {
    id: device.id,
    brand: device.brand,
    model: device.model,
    tier: device.tier,
    os: device.os,
    ramGb: device.ramGb,
    refreshHz: device.refreshHz,
    touchSamplingHz: device.touchSamplingHz,
    ppi: device.ppi,
    screenInches: device.screenInches,
    chipset: device.chipset,
    defaultDpi: device.defaultDpi,
    recommendedDpi: device.recommendedDpi,
    thermalHeadroom: device.thermalHeadroom,
    general: device.presetSensitivity?.general ?? 184,
    redDot: device.presetSensitivity?.redDot ?? 173,
    scope2x: device.presetSensitivity?.scope2x ?? 155,
    scope4x: device.presetSensitivity?.scope4x ?? 137,
    sniperScope: device.presetSensitivity?.sniperScope ?? 89,
    freeLook: device.presetSensitivity?.freeLook ?? 161,
    fireButton: device.presetFireButton ?? 46,
  };
}

function sanitizeFirestoreDeviceId(raw: string, brand: string, model: string): string {
  const base = (raw.trim() || `${brand}-${model}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base.length >= 2 ? base : `device-${Date.now()}`;
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function clampFloat(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.max(min, Math.min(max, num));
  return Math.round(clamped * 100) / 100;
}

const VALID_TIERS = new Set<DeviceTier>(['low', 'mid', 'high', 'gaming', 'ios']);
const VALID_OS = new Set<OperatingSystem>(['Android', 'iOS']);
const VALID_THERMAL = new Set<'Tight' | 'Moderate' | 'High'>(['Tight', 'Moderate', 'High']);

function buildCatalogDocPayload(
  input: Partial<DeviceSpec>,
  adminUid: string,
  removed: boolean
): Record<string, unknown> {
  const brand = (input.brand || 'Custom').trim().slice(0, 40) || 'Custom';
  const model = (input.model || 'Device').trim().slice(0, 80) || 'Device';
  const id = sanitizeFirestoreDeviceId(input.id || '', brand, model);
  const ramGb = clampInt(input.ramGb, 1, 32, 8);
  const os: OperatingSystem =
    input.os && VALID_OS.has(input.os)
      ? input.os
      : brand.toLowerCase() === 'apple'
        ? 'iOS'
        : 'Android';
  const tier: DeviceTier =
    input.tier && VALID_TIERS.has(input.tier)
      ? input.tier
      : os === 'iOS'
        ? 'ios'
        : ramGb <= 3
          ? 'low'
          : ramGb <= 6
            ? 'mid'
            : 'high';
  const refreshHz = clampInt(input.refreshHz, 30, 240, 120);
  const touchSamplingHz = clampInt(
    input.touchSamplingHz,
    60,
    1000,
    refreshHz >= 120 ? 240 : 120
  );
  const ppi = clampInt(input.ppi, 120, 700, 400);
  const screenInches = clampFloat(input.screenInches, 4, 15, 6.67);
  const chipset =
    (input.chipset || '').trim().slice(0, 80) ||
    (os === 'iOS' ? 'Apple Silicon' : 'Snapdragon / Dimensity');
  const defaultDpi = clampInt(input.defaultDpi, 100, 600, os === 'iOS' ? 114 : 392);
  const recommendedDpi = clampInt(input.recommendedDpi, 100, 650, os === 'iOS' ? 120 : 510);
  const thermalHeadroom: 'Tight' | 'Moderate' | 'High' =
    input.thermalHeadroom && VALID_THERMAL.has(input.thermalHeadroom)
      ? input.thermalHeadroom
      : ramGb <= 3
        ? 'Tight'
        : ramGb >= 8
          ? 'High'
          : 'Moderate';

  const payload: Record<string, unknown> = {
    id,
    brand,
    model,
    tier,
    os,
    ramGb,
    refreshHz,
    touchSamplingHz,
    ppi,
    screenInches,
    chipset,
    defaultDpi,
    recommendedDpi,
    thermalHeadroom,
    removed,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  };

  if (input.presetSensitivity) {
    payload.presetSensitivity = {
      general: clampInt(input.presetSensitivity.general, 0, 200, 184),
      redDot: clampInt(input.presetSensitivity.redDot, 0, 200, 173),
      scope2x: clampInt(input.presetSensitivity.scope2x, 0, 200, 155),
      scope4x: clampInt(input.presetSensitivity.scope4x, 0, 200, 137),
      sniperScope: clampInt(input.presetSensitivity.sniperScope, 0, 200, 89),
      freeLook: clampInt(input.presetSensitivity.freeLook, 0, 200, 161),
    };
  }
  if (input.presetFireButton !== undefined) {
    payload.presetFireButton = clampInt(input.presetFireButton, 32, 70, 46);
  }
  return payload;
}

const SAMPLE_CSV_BULK = `brand,model,ramGb,refreshHz,chipset,general,redDot,scope2x,scope4x,sniperScope,freeLook,fireButton,recommendedDpi
Xiaomi,Redmi Note 14 Pro 5G,8,120,Dimensity 7300-Ultra,182,171,153,136,88,159,46,520
Motorola,Moto Edge 50 Neo,8,120,Dimensity 7300,183,172,154,137,88,160,46,520
Vivo,Vivo V50 5G,8,120,Snapdragon 7 Gen 3,182,171,154,136,88,160,46,525`;

function parseBulkDevicesInput(
  rawText: string
): { ok: true; devices: Partial<DeviceSpec>[] } | { ok: false; error: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste JSON array or CSV lines first.' };
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.devices)
          ? parsed.devices
          : [parsed];
      if (list.length === 0) {
        return { ok: false, error: 'JSON array is empty.' };
      }
      return { ok: true, devices: list };
    } catch {
      return { ok: false, error: 'Invalid JSON syntax. Check commas, quotes, and brackets.' };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { ok: false, error: 'No device rows detected.' };
  }

  const headerFirst =
    lines[0].toLowerCase().includes('brand') && lines[0].toLowerCase().includes('model');
  const dataLines = headerFirst ? lines.slice(1) : lines;
  if (dataLines.length === 0) {
    return { ok: false, error: 'Header found without any device rows underneath.' };
  }

  const out: Partial<DeviceSpec>[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const separator = dataLines[i].includes('\t') ? '\t' : ',';
    const cols = dataLines[i].split(separator).map((c) => c.trim());
    if (cols.length < 11) {
      return {
        ok: false,
        error: `Line ${i + (headerFirst ? 2 : 1)} has ${cols.length} columns; expected at least 11 (brand,model,ramGb,refreshHz,chipset,general,redDot,scope2x,scope4x,sniperScope,freeLook[,fireButton,recommendedDpi]).`,
      };
    }

    const [
      brand,
      model,
      ramRaw,
      hzRaw,
      chipset,
      genRaw,
      redRaw,
      s2Raw,
      s4Raw,
      snRaw,
      flRaw,
      fbRaw,
      dpiRaw,
    ] = cols;

    const ramGb = Number(ramRaw);
    const refreshHz = Number(hzRaw);
    const general = Number(genRaw);
    const redDot = Number(redRaw);
    const scope2x = Number(s2Raw);
    const scope4x = Number(s4Raw);
    const sniperScope = Number(snRaw);
    const freeLook = Number(flRaw);
    const fireButton = fbRaw ? Number(fbRaw) : 46;
    const recommendedDpi = dpiRaw ? Number(dpiRaw) : 510;

    if (
      !brand ||
      !model ||
      [
        ramGb,
        refreshHz,
        general,
        redDot,
        scope2x,
        scope4x,
        sniperScope,
        freeLook,
        fireButton,
        recommendedDpi,
      ].some((n) => !Number.isFinite(n))
    ) {
      return {
        ok: false,
        error: `Line ${i + (headerFirst ? 2 : 1)} contains invalid numeric values or missing brand/model.`,
      };
    }

    out.push({
      brand,
      model,
      ramGb,
      refreshHz,
      touchSamplingHz: refreshHz >= 120 ? 240 : 120,
      chipset: chipset || 'Snapdragon / Dimensity',
      os: brand.toLowerCase() === 'apple' ? 'iOS' : 'Android',
      tier:
        brand.toLowerCase() === 'apple'
          ? 'ios'
          : ramGb <= 3
            ? 'low'
            : ramGb <= 6
              ? 'mid'
              : 'high',
      defaultDpi: 392,
      recommendedDpi,
      thermalHeadroom: ramGb <= 3 ? 'Tight' : ramGb >= 8 ? 'High' : 'Moderate',
      presetSensitivity: {
        general,
        redDot,
        scope2x,
        scope4x,
        sniperScope,
        freeLook,
      },
      presetFireButton: fireButton,
    });
  }

  return { ok: true, devices: out };
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'Just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatActionLabel(action: UserActionType): string {
  switch (action) {
    case 'signup':
      return 'Signed Up';
    case 'login':
      return 'Logged In';
    case 'logout':
      return 'Signed Out';
    case 'view_tab':
      return 'Opened Section';
    case 'select_device':
      return 'Selected Device';
    case 'update_sensitivity':
      return 'Adjusted Sensitivity';
    case 'save_preset':
      return 'Saved Preset';
    case 'delete_preset':
      return 'Deleted Preset';
    case 'apply_launch':
      return 'Applied & Launched';
    case 'toggle_optimization':
      return 'Toggled FPS Step';
    case 'practice_drag':
      return 'Drag Lab Practice';
    case 'admin_approve_user':
      return 'Admin Approved';
    case 'admin_block_user':
      return 'Admin Blocked';
    default:
      return action;
  }
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  devices,
  masterDevices,
  catalogOverrides,
  onPendingCountChange,
}) => {
  const [sectionTab, setSectionTab] = useState<AdminSectionTab>('users');
  const [users, setUsers] = useState<FirebaseUserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const [activitySearch, setActivitySearch] = useState('');

  // Master Device Sensitivity Catalog state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBrandFilter, setCatalogBrandFilter] = useState<CatalogBrandFilter>('all');
  const [catalogShowAll, setCatalogShowAll] = useState(false);
  const [deviceEditorOpen, setDeviceEditorOpen] = useState(false);
  const [editingBuiltInId, setEditingBuiltInId] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(EMPTY_DEVICE_FORM);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);

  // Real-time Firestore listener: all users
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) =>
          mapUserDoc(d.id, d.data() as Record<string, unknown>)
        );
        setUsers(list);
        setLoading(false);
        const pendingCount = list.filter((u) => u.status === 'pending').length;
        onPendingCountChange?.(pendingCount);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    return () => unsubscribe();
  }, [onPendingCountChange]);

  // Real-time Firestore listener: user & admin actions
  useEffect(() => {
    const logsQuery = query(
      collection(db, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(250)
    );
    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const entries: ActivityLogEntry[] = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            userId: typeof data.userId === 'string' ? data.userId : '',
            userEmail: typeof data.userEmail === 'string' ? data.userEmail : '',
            userDisplayName:
              typeof data.userDisplayName === 'string' ? data.userDisplayName : 'User',
            action: (typeof data.action === 'string'
              ? data.action
              : 'login') as UserActionType,
            details: typeof data.details === 'string' ? data.details : '',
            createdAt: formatTimestampToIso(data.createdAt),
          };
        });
        setLogs(entries);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'activityLogs');
      }
    );
    return () => unsubscribe();
  }, []);

  const logsByUserId = useMemo(() => {
    const map: Record<string, ActivityLogEntry[]> = {};
    for (const entry of logs) {
      if (!map[entry.userId]) {
        map[entry.userId] = [];
      }
      map[entry.userId].push(entry);
    }
    return map;
  }, [logs]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let blocked = 0;
    for (const u of users) {
      if (u.status === 'pending') pending++;
      else if (u.status === 'approved') approved++;
      else if (u.status === 'blocked') blocked++;
    }
    return {
      total: users.length,
      pending,
      approved,
      blocked,
      logs: logs.length,
    };
  }, [users, logs.length]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, statusFilter]);

  const filteredLogs = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.userEmail.toLowerCase().includes(q) ||
        l.userDisplayName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
    );
  }, [logs, activitySearch]);

  const handleSetUserStatus = async (
    target: FirebaseUserProfile,
    nextStatus: UserApprovalStatus
  ) => {
    setError(null);
    setBanner(null);
    setUpdatingUid(target.uid);
    const path = `users/${target.uid}`;
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await logUserAction(
        currentUser,
        nextStatus === 'approved' ? 'admin_approve_user' : 'admin_block_user',
        `${nextStatus === 'approved' ? 'Approved' : 'Blocked'} ${target.email || target.uid}`
      );
      setBanner(
        `${target.email || target.displayName} is now ${nextStatus.toUpperCase()}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Catalog override helpers
  const overriddenIdSet = useMemo(
    () => new Set(catalogOverrides.upsertedDevices.map((d) => d.id)),
    [catalogOverrides.upsertedDevices]
  );

  const builtInIdSet = useMemo(() => new Set(DEVICE_CATALOG.map((d) => d.id)), []);

  const filteredMasterCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return masterDevices.filter((d) => {
      const b = d.brand.toLowerCase();
      if (catalogBrandFilter === 'samsung' && b !== 'samsung') return false;
      if (catalogBrandFilter === 'xiaomi' && b !== 'xiaomi') return false;
      if (catalogBrandFilter === 'motorola' && b !== 'motorola') return false;
      if (catalogBrandFilter === 'vivo' && b !== 'vivo') return false;
      if (
        catalogBrandFilter === 'other' &&
        (b === 'samsung' || b === 'xiaomi' || b === 'motorola' || b === 'vivo')
      ) {
        return false;
      }
      if (!q) return true;
      return `${d.brand} ${d.model} ${d.chipset} ${d.id}`.toLowerCase().includes(q);
    });
  }, [masterDevices, catalogSearch, catalogBrandFilter]);

  const visibleCatalogRows = useMemo(
    () =>
      catalogShowAll || catalogSearch.trim()
        ? filteredMasterCatalog
        : filteredMasterCatalog.slice(0, 20),
    [filteredMasterCatalog, catalogShowAll, catalogSearch]
  );

  const handleSaveCatalogDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBanner(null);
    if (!deviceForm.brand.trim() || !deviceForm.model.trim()) {
      setError('Brand and Model are required.');
      return;
    }
    setCatalogSaving(true);
    const id = sanitizeFirestoreDeviceId(
      editingBuiltInId || deviceForm.id,
      deviceForm.brand,
      deviceForm.model
    );
    const payload = buildCatalogDocPayload(
      {
        id,
        brand: deviceForm.brand,
        model: deviceForm.model,
        tier: deviceForm.tier,
        os: deviceForm.os,
        ramGb: deviceForm.ramGb,
        refreshHz: deviceForm.refreshHz,
        touchSamplingHz: deviceForm.touchSamplingHz,
        ppi: deviceForm.ppi,
        screenInches: deviceForm.screenInches,
        chipset: deviceForm.chipset,
        defaultDpi: deviceForm.defaultDpi,
        recommendedDpi: deviceForm.recommendedDpi,
        thermalHeadroom: deviceForm.thermalHeadroom,
        presetSensitivity: {
          general: deviceForm.general,
          redDot: deviceForm.redDot,
          scope2x: deviceForm.scope2x,
          scope4x: deviceForm.scope4x,
          sniperScope: deviceForm.sniperScope,
          freeLook: deviceForm.freeLook,
        },
        presetFireButton: deviceForm.fireButton,
      },
      currentUser.uid,
      false
    );
    try {
      await setDoc(doc(db, 'catalogDevices', id), payload);
      setBanner(`Saved ${deviceForm.brand} ${deviceForm.model} to Firestore catalog.`);
      setDeviceEditorOpen(false);
      setEditingBuiltInId(null);
      setDeviceForm(EMPTY_DEVICE_FORM);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `catalogDevices/${id}`);
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleBulkImportDevices = async () => {
    setError(null);
    setBanner(null);
    const parsed = parseBulkDevicesInput(bulkInput);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.devices.length > 200) {
      setError('Bulk import supports up to 200 devices per batch.');
      return;
    }
    setCatalogSaving(true);
    try {
      const batch = writeBatch(db);
      for (const item of parsed.devices) {
        const payload = buildCatalogDocPayload(item, currentUser.uid, false);
        const id = String(payload.id);
        batch.set(doc(db, 'catalogDevices', id), payload);
      }
      await batch.commit();
      setBanner(`Imported ${parsed.devices.length} devices into Firestore catalog.`);
      setBulkInput('');
      setBulkPanelOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'catalogDevices');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleRemoveCatalogDevice = async (device: DeviceSpec) => {
    setError(null);
    setBanner(null);
    const docId = sanitizeFirestoreDeviceId(device.id, device.brand, device.model);
    try {
      if (builtInIdSet.has(device.id)) {
        await setDoc(
          doc(db, 'catalogDevices', docId),
          buildCatalogDocPayload(device, currentUser.uid, true)
        );
      } else {
        await deleteDoc(doc(db, 'catalogDevices', docId));
      }
      setBanner(`Removed ${device.brand} ${device.model} from catalog.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `catalogDevices/${docId}`);
    }
  };

  const handleRestoreCatalog = async () => {
    setError(null);
    setBanner(null);
    try {
      const batch = writeBatch(db);
      for (const d of catalogOverrides.upsertedDevices) {
        batch.delete(doc(db, 'catalogDevices', d.id));
      }
      for (const id of catalogOverrides.removedIds) {
        batch.delete(doc(db, 'catalogDevices', id));
      }
      await batch.commit();
      setBanner('Restored built-in device catalog defaults.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'catalogDevices');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/90 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            /admin · Restricted to {ADMIN_EMAIL}
          </div>
          <h1 className="mt-2 font-['Outfit'] text-2xl font-bold tracking-tight text-white">
            Admin User Approval &amp; Activity Console
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Review every user&apos;s approval status, last login timestamp, and recorded actions in real time.
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-[#111622] p-4">
          <p className="text-[11px] font-medium text-slate-400">Total Users</p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
          <p className="text-[11px] font-medium text-amber-300">Pending Approval</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-400">{counts.pending}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4">
          <p className="text-[11px] font-medium text-emerald-300">Approved</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">{counts.approved}</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4">
          <p className="text-[11px] font-medium text-rose-300">Blocked</p>
          <p className="mt-1 font-mono text-2xl font-bold text-rose-400">{counts.blocked}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-800 bg-[#111622] p-4">
          <p className="text-[11px] font-medium text-slate-400">Logged Actions</p>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-400">{counts.logs}</p>
        </div>
      </div>

      {/* Section Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSectionTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            sectionTab === 'users'
              ? 'bg-orange-500 text-slate-950'
              : 'border border-slate-800 bg-[#111622] text-slate-300 hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          All Users ({counts.total})
          {counts.pending > 0 && (
            <span className="rounded bg-slate-950/20 px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {counts.pending} pending
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSectionTab('activity')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            sectionTab === 'activity'
              ? 'bg-orange-500 text-slate-950'
              : 'border border-slate-800 bg-[#111622] text-slate-300 hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          All Activity Feed ({counts.logs})
        </button>
        <button
          type="button"
          onClick={() => setSectionTab('catalog')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            sectionTab === 'catalog'
              ? 'bg-orange-500 text-slate-950'
              : 'border border-slate-800 bg-[#111622] text-slate-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Device Catalog ({masterDevices.length})
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300"
        >
          {error}
        </div>
      )}

      {banner && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 text-xs text-emerald-300"
        >
          {banner}
        </div>
      )}

      {/* TAB 1: USERS LIST */}
      {sectionTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by email, name, or UID..."
                className="w-full rounded-lg border border-slate-700 bg-[#111622] py-2 pl-9 pr-3.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'approved', 'blocked'] as UserStatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    statusFilter === f
                      ? 'bg-orange-500 text-slate-950'
                      : 'border border-slate-800 bg-[#111622] text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-800 bg-[#111622] p-8 text-center text-sm text-slate-400">
              Loading users from Firestore...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#111622] p-8 text-center text-sm text-slate-400">
              No users match the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const userActions = logsByUserId[u.uid] || [];
                const isExpanded = Boolean(expandedUserIds[u.uid]);
                const isSelfAdmin = u.email.toLowerCase() === ADMIN_EMAIL;
                const deviceObj = devices.find((d) => d.id === u.requestedDeviceId);

                return (
                  <div
                    key={u.uid}
                    className="rounded-xl border border-slate-800/90 bg-[#111622] p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Identity & Timestamps */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-full border border-slate-700 object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-[#0B0E14] font-semibold text-sm text-orange-400">
                            {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">
                              {u.displayName}
                            </p>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                u.status === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : u.status === 'blocked'
                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {u.status}
                            </span>
                            {u.role === 'admin' && (
                              <span className="rounded bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-orange-300">
                                ADMIN
                              </span>
                            )}
                          </div>

                          <p className="font-mono text-xs text-slate-300 break-all">
                            {u.email}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-orange-400" />
                              Last login:{' '}
                              <span className="text-slate-200 font-medium">
                                {u.lastLoginAt
                                  ? `${formatRelativeTime(u.lastLoginAt)} (${new Date(u.lastLoginAt).toLocaleString()})`
                                  : 'Never'}
                              </span>
                            </span>
                            <span>
                              Joined:{' '}
                              <span className="text-slate-300">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                              </span>
                            </span>
                            <span>
                              Device:{' '}
                              <span className="text-slate-300">
                                {deviceObj
                                  ? `${deviceObj.brand} ${deviceObj.model}`
                                  : u.requestedDeviceId}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Approve / Block Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedUserIds((prev) => ({
                              ...prev,
                              [u.uid]: !prev[u.uid],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Activity className="h-3.5 w-3.5 text-orange-400" />
                          Actions ({userActions.length})
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {!isSelfAdmin && (
                          <>
                            <button
                              type="button"
                              disabled={updatingUid === u.uid || u.status === 'approved'}
                              onClick={() => handleSetUserStatus(u, 'approved')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {u.status === 'approved' ? 'Approved' : 'Approve'}
                            </button>

                            <button
                              type="button"
                              disabled={updatingUid === u.uid || u.status === 'blocked'}
                              onClick={() => handleSetUserStatus(u, 'blocked')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/90 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              {u.status === 'blocked' ? 'Blocked' : 'Block'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Recent Actions Preview (always visible) */}
                    <div className="rounded-lg border border-slate-800/80 bg-[#0B0E14] px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                        <span className="font-semibold text-slate-300">
                          Recent Actions Taken
                        </span>
                        <span className="font-mono text-slate-500">UID: {u.uid}</span>
                      </div>
                      {userActions.length === 0 ? (
                        <p className="text-xs text-slate-500">No actions recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(isExpanded ? userActions : userActions.slice(0, 3)).map((act) => (
                            <div
                              key={act.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-b border-slate-800/50 last:border-b-0 pb-1.5 last:pb-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-300 shrink-0">
                                  {formatActionLabel(act.action)}
                                </span>
                                <span className="text-slate-200 truncate">{act.details}</span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                {act.createdAt
                                  ? `${formatRelativeTime(act.createdAt)} · ${new Date(act.createdAt).toLocaleTimeString()}`
                                  : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GLOBAL ACTIVITY FEED */}
      {sectionTab === 'activity' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              placeholder="Filter logs by email, action, or details..."
              className="w-full rounded-lg border border-slate-700 bg-[#111622] py-2 pl-9 pr-3.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#111622] divide-y divide-slate-800/80">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No activity logs recorded yet.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-orange-300">
                        {formatActionLabel(log.action)}
                      </span>
                      <span className="font-semibold text-white">{log.userDisplayName}</span>
                      <span className="font-mono text-slate-400">{log.userEmail}</span>
                    </div>
                    <p className="text-slate-300">{log.details}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIRESTORE DEVICE CATALOG MANAGEMENT */}
      {sectionTab === 'catalog' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Master Device Sensitivity Catalog
              </h2>
              <p className="text-xs text-slate-400">
                Add, bulk-import, edit, or remove device sensitivity presets stored in Firestore.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBuiltInId(null);
                  setDeviceForm(EMPTY_DEVICE_FORM);
                  setDeviceEditorOpen((v) => !v);
                  setBulkPanelOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Device
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkPanelOpen((v) => !v);
                  setDeviceEditorOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Bulk Import
              </button>
              {(catalogOverrides.upsertedDevices.length > 0 ||
                catalogOverrides.removedIds.length > 0) && (
                <button
                  type="button"
                  onClick={handleRestoreCatalog}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Defaults
                </button>
              )}
            </div>
          </div>

          {deviceEditorOpen && (
            <form
              onSubmit={handleSaveCatalogDevice}
              className="rounded-xl border border-slate-800 bg-[#111622] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {editingBuiltInId ? `Edit ${deviceForm.brand} ${deviceForm.model}` : 'New Device Entry'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDeviceEditorOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Brand (e.g. Samsung)"
                  value={deviceForm.brand}
                  onChange={(e) => setDeviceForm({ ...deviceForm, brand: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. Galaxy A55)"
                  value={deviceForm.model}
                  onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Chipset"
                  value={deviceForm.chipset}
                  onChange={(e) => setDeviceForm({ ...deviceForm, chipset: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="RAM GB"
                  value={deviceForm.ramGb}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, ramGb: Number(e.target.value) })
                  }
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="Refresh Hz"
                  value={deviceForm.refreshHz}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, refreshHz: Number(e.target.value) })
                  }
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="Recommended DPI"
                  value={deviceForm.recommendedDpi}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, recommendedDpi: Number(e.target.value) })
                  }
                  className="rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
                {(
                  [
                    ['general', 'General'],
                    ['redDot', 'Red Dot'],
                    ['scope2x', '2x Scope'],
                    ['scope4x', '4x Scope'],
                    ['sniperScope', 'Sniper'],
                    ['freeLook', 'Free Look'],
                    ['fireButton', 'Fire Btn'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-[11px] text-slate-400">
                    {label}
                    <input
                      type="number"
                      value={deviceForm[key]}
                      onChange={(e) =>
                        setDeviceForm({ ...deviceForm, [key]: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-2.5 py-1.5 text-xs text-white"
                    />
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={catalogSaving}
                className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              >
                {catalogSaving ? 'Saving...' : 'Save Device to Firestore'}
              </button>
            </form>
          )}

          {bulkPanelOpen && (
            <div className="rounded-xl border border-slate-800 bg-[#111622] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Bulk Import (CSV or JSON)</h3>
                <button
                  type="button"
                  onClick={() => setBulkInput(SAMPLE_CSV_BULK)}
                  className="text-xs text-orange-400 hover:underline"
                >
                  Load Sample CSV
                </button>
              </div>
              <textarea
                rows={6}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={SAMPLE_CSV_BULK}
                className="w-full rounded-lg border border-slate-700 bg-[#0B0E14] p-3 font-mono text-xs text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={catalogSaving}
                  onClick={handleBulkImportDevices}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
                >
                  {catalogSaving ? 'Importing...' : 'Import Devices'}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkPanelOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search master catalog..."
                className="w-full rounded-lg border border-slate-700 bg-[#111622] py-2 pl-9 pr-3.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'samsung', 'xiaomi', 'motorola', 'vivo', 'other'] as CatalogBrandFilter[]).map(
                (b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCatalogBrandFilter(b)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${
                      catalogBrandFilter === b
                        ? 'bg-orange-500 text-slate-950'
                        : 'border border-slate-800 bg-[#111622] text-slate-400 hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#111622] divide-y divide-slate-800/80">
            {visibleCatalogRows.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {d.brand} {d.model}
                    </span>
                    {overriddenIdSet.has(d.id) && (
                      <span className="rounded bg-orange-500/15 px-1.5 py-0.5 font-mono text-[10px] text-orange-300">
                        CUSTOMIZED
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-slate-400">
                    {d.ramGb} GB · {d.refreshHz} Hz · DPI {d.recommendedDpi} · {d.chipset}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBuiltInId(d.id);
                      setDeviceForm(deviceToFormState(d));
                      setDeviceEditorOpen(true);
                      setBulkPanelOpen(false);
                    }}
                    className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                    aria-label={`Edit ${d.brand} ${d.model}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCatalogDevice(d)}
                    className="rounded-md border border-slate-700 p-1.5 text-rose-400 hover:bg-rose-950/40"
                    aria-label={`Remove ${d.brand} ${d.model}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!catalogShowAll && filteredMasterCatalog.length > 20 && (
            <button
              type="button"
              onClick={() => setCatalogShowAll(true)}
              className="w-full rounded-lg border border-slate-800 bg-[#111622] py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Show All {filteredMasterCatalog.length} Devices
            </button>
          )}
        </div>
      )}
    </div>
  );
};
