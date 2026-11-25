import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Inbox,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserX,
  X,
} from 'lucide-react';
import {
  AdminAccount,
  AuthUser,
  CatalogOverrides,
  CustomerAccount,
  CustomerRequest,
  DeviceSpec,
  DeviceTier,
  OperatingSystem,
  RequestStatus,
} from '../types';
import { DEVICE_CATALOG } from '../utils/devices';

interface AdminPanelViewProps {
  token: string;
  currentAdminId: string;
  currentUserId: string;
  devices: DeviceSpec[];
  masterDevices: DeviceSpec[];
  catalogOverrides: CatalogOverrides;
  onCatalogOverridesChange: (next: CatalogOverrides) => void;
  onAdminCredentialsUpdated: (token: string, user: AuthUser) => void;
  onResetAdminClaim: () => void;
}

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

const SAMPLE_CSV_BULK = `brand,model,ramGb,refreshHz,chipset,general,redDot,scope2x,scope4x,sniperScope,freeLook,fireButton,recommendedDpi
Xiaomi,Redmi Note 14 Pro 5G,8,120,Dimensity 7300-Ultra,182,171,153,136,88,159,46,520
Motorola,Moto Edge 50 Neo,8,120,Dimensity 7300,183,172,154,137,88,160,46,520
Vivo,Vivo V50 5G,8,120,Snapdragon 7 Gen 3,182,171,154,136,88,160,46,525`;

const SAMPLE_JSON_BULK = JSON.stringify(
  [
    {
      brand: 'Xiaomi',
      model: 'Redmi Note 14 Pro+ 5G',
      ramGb: 12,
      refreshHz: 120,
      touchSamplingHz: 240,
      chipset: 'Snapdragon 7s Gen 3',
      recommendedDpi: 525,
      thermalHeadroom: 'High',
      presetSensitivity: {
        general: 180,
        redDot: 169,
        scope2x: 152,
        scope4x: 135,
        sniperScope: 88,
        freeLook: 158,
      },
      presetFireButton: 45,
    },
    {
      brand: 'Vivo',
      model: 'Vivo T4x 5G',
      ramGb: 6,
      refreshHz: 120,
      touchSamplingHz: 240,
      chipset: 'Dimensity 7300',
      recommendedDpi: 505,
      thermalHeadroom: 'Moderate',
      presetSensitivity: {
        general: 185,
        redDot: 175,
        scope2x: 156,
        scope4x: 138,
        sniperScope: 90,
        freeLook: 162,
      },
      presetFireButton: 47,
    },
  ],
  null,
  2
);

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

  const headerFirst = lines[0].toLowerCase().includes('brand') && lines[0].toLowerCase().includes('model');
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
      [ramGb, refreshHz, general, redDot, scope2x, scope4x, sniperScope, freeLook, fireButton, recommendedDpi].some(
        (n) => !Number.isFinite(n)
      )
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

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  token,
  currentAdminId,
  currentUserId,
  devices,
  masterDevices,
  catalogOverrides,
  onCatalogOverridesChange,
  onAdminCredentialsUpdated,
  onResetAdminClaim,
}) => {
  const [envOverrideActive, setEnvOverrideActive] = useState(false);
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | RequestStatus>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create customer form state
  const [customerEmail, setCustomerEmail] = useState('');
  const [customId, setCustomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [assignedDeviceId, setAssignedDeviceId] = useState('samsung-a54');
  const [creating, setCreating] = useState(false);
  const [createdBanner, setCreatedBanner] = useState<{
    customId: string;
    email?: string;
    password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Create full-access Admin form state
  const [newAdmAccountId, setNewAdmAccountId] = useState('');
  const [newAdmAccountName, setNewAdmAccountName] = useState('');
  const [newAdmAccountPass, setNewAdmAccountPass] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminCreatedBanner, setAdminCreatedBanner] = useState<string | null>(null);

  // Inline password reset state
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Admin ID & password reset state
  const [adminCurrentPass, setAdminCurrentPass] = useState('');
  const [newAdminId, setNewAdminId] = useState(currentAdminId);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [confirmResetClaim, setConfirmResetClaim] = useState(false);

  // Master Device Sensitivity Catalog management state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBrandFilter, setCatalogBrandFilter] = useState<CatalogBrandFilter>('all');
  const [catalogShowAll, setCatalogShowAll] = useState(false);
  const [deviceEditorOpen, setDeviceEditorOpen] = useState(false);
  const [editingBuiltInId, setEditingBuiltInId] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(EMPTY_DEVICE_FORM);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogBanner, setCatalogBanner] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRes, reqRes, admRes, statusRes] = await Promise.all([
        fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/requests', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/admins', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/auth/status'),
      ]);

      const custData = await custRes.json();
      const reqData = await reqRes.json();
      const admData = await admRes.json();
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setEnvOverrideActive(Boolean(statusData?.envOverrideActive));
      }

      if (!custRes.ok) {
        setError(custData?.error || 'Could not load customer accounts.');
        return;
      }
      if (!reqRes.ok) {
        setError(reqData?.error || 'Could not load customer requests.');
        return;
      }
      if (!admRes.ok) {
        setError(admData?.error || 'Could not load admin accounts.');
        return;
      }

      setCustomers(custData.customers || []);
      setRequests(reqData.requests || []);
      setAdmins(admData.admins || []);
    } catch {
      setError('Failed to reach server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') return requests;
    return requests.filter((r) => r.status === requestFilter);
  }, [requests, requestFilter]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < arr.length; i++) {
      out += chars[arr[i] % chars.length];
    }
    setPassword(out);
  };

  const handleDecision = async (
    requestId: string,
    decision: 'accept' | 'reject',
    reason?: string
  ) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decision,
          rejectionReason: reason?.trim() || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Failed to ${decision} request.`);
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? data.request : r))
      );
      if (decision === 'accept' && data.customer) {
        setCustomers((prev) => [data.customer, ...prev]);
      }
      setRejectingId(null);
      setRejectionReason('');
    } catch {
      setError(`Network error while processing ${decision}.`);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedBanner(null);

    const trimmedEmail = customerEmail.trim().toLowerCase();
    const trimmedId = customId.trim();
    if ((!trimmedId && !trimmedEmail) || !password) {
      setError('Enter an Email ID (or User ID) and Password.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          customId: trimmedId,
          displayName: displayName.trim() || trimmedId || trimmedEmail.split('@')[0],
          password,
          assignedDeviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not create user account.');
        return;
      }

      setCustomers((prev) => [data.customer, ...prev]);
      setCreatedBanner({
        customId: data.customer?.customId || trimmedId,
        email: data.customer?.email || (trimmedEmail || undefined),
        password,
      });
      setCustomerEmail('');
      setCustomId('');
      setDisplayName('');
      setPassword('');
    } catch {
      setError('Network error while creating account.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (customer: CustomerAccount) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !customer.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to update customer status.');
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? data.customer : c))
      );
    } catch {
      setError('Network error updating customer status.');
    }
  };

  const handleSavePasswordReset = async (customerId: string) => {
    if (resetPasswordVal.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: resetPasswordVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to reset password.');
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? data.customer : c))
      );
      setResetTargetId(null);
      setResetPasswordVal('');
    } catch {
      setError('Network error resetting password.');
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || 'Failed to delete customer.');
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    } catch {
      setError('Network error deleting customer.');
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdBanner) return;
    const text = [
      'FF TUNE User Login',
      createdBanner.email ? `Email ID: ${createdBanner.email}` : null,
      `User ID: ${createdBanner.customId}`,
      `Password: ${createdBanner.password}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCreateAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAdminCreatedBanner(null);

    const trimmedId = newAdmAccountId.trim();
    if (!trimmedId || newAdmAccountPass.length < 6) {
      setError('Admin ID is required and password must be at least 6 characters.');
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customId: trimmedId,
          displayName: newAdmAccountName.trim() || `Admin (${trimmedId})`,
          password: newAdmAccountPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not create admin account.');
        return;
      }
      setAdmins((prev) => [data.admin, ...prev]);
      setAdminCreatedBanner(`Full-access Admin ID "${trimmedId}" created.`);
      setNewAdmAccountId('');
      setNewAdmAccountName('');
      setNewAdmAccountPass('');
    } catch {
      setError('Network error creating admin account.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleToggleAdminActive = async (adminAcc: AdminAccount) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminAcc.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !adminAcc.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to update admin status.');
        return;
      }
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminAcc.id ? data.admin : a))
      );
    } catch {
      setError('Network error updating admin status.');
    }
  };

  const handleDeleteAdminAccount = async (adminId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to delete admin account.');
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch {
      setError('Network error deleting admin account.');
    }
  };

  const builtInIds = useMemo(
    () => new Set(DEVICE_CATALOG.map((d) => d.id)),
    []
  );
  const upsertedIds = useMemo(
    () => new Set(catalogOverrides.upsertedDevices.map((d) => d.id)),
    [catalogOverrides.upsertedDevices]
  );

  const filteredMasterDevices = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return masterDevices.filter((d) => {
      if (catalogBrandFilter === 'samsung' && d.brand !== 'Samsung') return false;
      if (
        catalogBrandFilter === 'xiaomi' &&
        d.brand !== 'Xiaomi' &&
        d.brand !== 'POCO'
      ) {
        return false;
      }
      if (catalogBrandFilter === 'motorola' && d.brand !== 'Motorola') return false;
      if (
        catalogBrandFilter === 'vivo' &&
        d.brand !== 'Vivo' &&
        d.brand !== 'iQOO'
      ) {
        return false;
      }
      if (
        catalogBrandFilter === 'other' &&
        ['Samsung', 'Xiaomi', 'POCO', 'Motorola', 'Vivo', 'iQOO'].includes(d.brand)
      ) {
        return false;
      }
      if (!q) return true;
      return `${d.id} ${d.brand} ${d.model} ${d.chipset} ${d.ramGb}gb`
        .toLowerCase()
        .includes(q);
    });
  }, [masterDevices, catalogSearch, catalogBrandFilter]);

  const displayedCatalogDevices = useMemo(() => {
    if (catalogShowAll || catalogSearch.trim().length > 0) {
      return filteredMasterDevices;
    }
    return filteredMasterDevices.slice(0, 20);
  }, [filteredMasterDevices, catalogShowAll, catalogSearch]);

  const parsedBulkPreview = useMemo(() => {
    if (!bulkInput.trim()) return null;
    return parseBulkDevicesInput(bulkInput);
  }, [bulkInput]);

  const handleOpenAddDevice = () => {
    setEditingBuiltInId(null);
    setDeviceForm(EMPTY_DEVICE_FORM);
    setDeviceEditorOpen(true);
    setBulkPanelOpen(false);
    setError(null);
  };

  const handleOpenEditDevice = (device: DeviceSpec) => {
    setEditingBuiltInId(device.id);
    setDeviceForm(deviceToFormState(device));
    setDeviceEditorOpen(true);
    setBulkPanelOpen(false);
    setError(null);
  };

  const handleSaveMasterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCatalogBanner(null);

    if (!deviceForm.brand.trim() || !deviceForm.model.trim()) {
      setError('Brand and model are required.');
      return;
    }

    setCatalogSaving(true);
    try {
      const payload: Partial<DeviceSpec> = {
        ...(deviceForm.id.trim() ? { id: deviceForm.id.trim() } : {}),
        brand: deviceForm.brand.trim(),
        model: deviceForm.model.trim(),
        tier: deviceForm.tier,
        os: deviceForm.os,
        ramGb: Number(deviceForm.ramGb),
        refreshHz: Number(deviceForm.refreshHz),
        touchSamplingHz: Number(deviceForm.touchSamplingHz),
        ppi: Number(deviceForm.ppi),
        screenInches: Number(deviceForm.screenInches),
        chipset: deviceForm.chipset.trim(),
        defaultDpi: Number(deviceForm.defaultDpi),
        recommendedDpi: Number(deviceForm.recommendedDpi),
        thermalHeadroom: deviceForm.thermalHeadroom,
        presetSensitivity: {
          general: Number(deviceForm.general),
          redDot: Number(deviceForm.redDot),
          scope2x: Number(deviceForm.scope2x),
          scope4x: Number(deviceForm.scope4x),
          sniperScope: Number(deviceForm.sniperScope),
          freeLook: Number(deviceForm.freeLook),
        },
        presetFireButton: Number(deviceForm.fireButton),
      };

      const res = await fetch('/api/admin/catalog/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not save device entry.');
        return;
      }

      if (data.overrides) {
        onCatalogOverridesChange(data.overrides);
      }
      setCatalogBanner(
        `Saved "${data.device.brand} ${data.device.model}" to the live master catalog.`
      );
      setDeviceEditorOpen(false);
      setEditingBuiltInId(null);
    } catch {
      setError('Network error saving device to master catalog.');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleBulkImportDevices = async () => {
    setError(null);
    setCatalogBanner(null);
    const parsed = parseBulkDevicesInput(bulkInput);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setCatalogSaving(true);
    try {
      const res = await fetch('/api/admin/catalog/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ devices: parsed.devices }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Bulk import failed.');
        return;
      }

      if (data.overrides) {
        onCatalogOverridesChange(data.overrides);
      }
      setCatalogBanner(
        `Bulk imported ${data.count} device ${data.count === 1 ? 'entry' : 'entries'} into the master catalog.`
      );
      setBulkInput('');
      setBulkPanelOpen(false);
    } catch {
      setError('Network error during bulk device import.');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleRemoveMasterDevice = async (device: DeviceSpec) => {
    setError(null);
    setCatalogBanner(null);
    try {
      const res = await fetch(
        `/api/admin/catalog/devices/${encodeURIComponent(device.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not remove device.');
        return;
      }
      if (data.overrides) {
        onCatalogOverridesChange(data.overrides);
      }
      setCatalogBanner(
        `Removed "${device.brand} ${device.model}" from the active catalog.`
      );
    } catch {
      setError('Network error removing device.');
    }
  };

  const handleRestoreCatalogDefaults = async (mode: 'removed' | 'all') => {
    setError(null);
    setCatalogBanner(null);
    setCatalogSaving(true);
    try {
      const res = await fetch('/api/admin/catalog/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to restore catalog defaults.');
        return;
      }
      if (data.overrides) {
        onCatalogOverridesChange(data.overrides);
      }
      setCatalogBanner(
        mode === 'removed'
          ? 'Restored previously removed built-in devices.'
          : 'Restored master catalog to built-in factory defaults.'
      );
    } catch {
      setError('Network error restoring catalog defaults.');
    } finally {
      setCatalogSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300"
        >
          {error}
        </div>
      )}

      {/* Customer Access Requests Queue (Accept / Reject) */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Customer Requests
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'} awaiting Accept or Reject review
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
              {(
                [
                  { id: 'pending', label: `Pending (${pendingCount})` },
                  { id: 'accepted', label: 'Accepted' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: 'all', label: 'All' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRequestFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    requestFilter === tab.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchAdminData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-xs text-slate-400">
            Loading customer requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-white">
              No {requestFilter === 'all' ? '' : requestFilter} requests
            </p>
            <p className="mt-1 text-xs text-slate-400">
              New requests submitted from the Customer Login page appear here for approval.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {filteredRequests.map((reqItem) => {
              const dev = devices.find((d) => d.id === reqItem.requestedDeviceId);
              return (
                <div
                  key={reqItem.id}
                  className="px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-sm font-semibold text-white">
                        {reqItem.email || reqItem.customId}
                      </span>
                      {reqItem.email && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="font-mono text-slate-400">@{reqItem.customId}</span>
                        </>
                      )}
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">{reqItem.displayName}</span>
                      <span className="text-slate-500">·</span>
                      <span
                        className={`font-medium ${
                          reqItem.status === 'accepted'
                            ? 'text-emerald-400'
                            : reqItem.status === 'rejected'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {reqItem.status === 'accepted'
                          ? 'Access Granted'
                          : reqItem.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Device: {dev ? `${dev.brand} ${dev.model}` : reqItem.requestedDeviceId}
                      {' · '}
                      Submitted {new Date(reqItem.createdAt).toLocaleString()}
                    </p>

                    {reqItem.note && (
                      <p className="text-xs text-slate-300">
                        Note: {reqItem.note}
                      </p>
                    )}

                    {reqItem.status === 'rejected' && reqItem.rejectionReason && (
                      <p className="text-xs text-rose-300">
                        Reason: {reqItem.rejectionReason}
                      </p>
                    )}
                  </div>

                  {reqItem.status === 'pending' ? (
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecision(reqItem.id, 'accept')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Grant Access
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(rejectingId === reqItem.id ? null : reqItem.id);
                            setRejectionReason('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 transition-colors whitespace-nowrap"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>

                      {rejectingId === reqItem.id && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Optional rejection reason"
                            className="rounded-md border border-slate-700 bg-[#0B0E14] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleDecision(reqItem.id, 'reject', rejectionReason)
                            }
                            className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 transition-colors"
                          >
                            Confirm Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-right text-xs text-slate-400 shrink-0">
                      {reqItem.reviewedAt && (
                        <span>
                          Reviewed {new Date(reqItem.reviewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Master Device Sensitivity Catalog Manager */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Master Device Sensitivity Catalog
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {masterDevices.length} active models ·{' '}
              {catalogOverrides.upsertedDevices.length} customized/added ·{' '}
              {catalogOverrides.removedIds.length} removed (persists live without editing code)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(catalogOverrides.upsertedDevices.length > 0 ||
              catalogOverrides.removedIds.length > 0) && (
              <button
                type="button"
                disabled={catalogSaving}
                onClick={() => handleRestoreCatalogDefaults('all')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore Defaults
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBulkPanelOpen((prev) => !prev);
                setDeviceEditorOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#161C2B] px-3 py-2 text-xs font-medium text-slate-200 hover:border-orange-500/60 hover:text-white transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-orange-400" />
              Bulk Add (CSV / JSON)
            </button>
            <button
              type="button"
              onClick={handleOpenAddDevice}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Device
            </button>
          </div>
        </div>

        {catalogBanner && (
          <div className="mx-6 mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-4 py-2.5 text-xs text-emerald-300">
            {catalogBanner}
          </div>
        )}

        {/* Single Device Add / Edit Sensitivity Drawer */}
        {deviceEditorOpen && (
          <form
            onSubmit={handleSaveMasterDevice}
            className="mx-6 mt-5 rounded-xl border border-slate-800 bg-[#0B0E14] p-5 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {editingBuiltInId
                    ? `Edit Device Sensitivity (${deviceForm.brand} ${deviceForm.model})`
                    : 'Add New Device to Master Catalog'}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Set hardware profile and calibrated OB44+ 0–200 sensitivity baselines.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeviceEditorOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close device editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="cat-brand" className="block text-xs font-medium text-slate-300">
                  Brand
                </label>
                <input
                  id="cat-brand"
                  type="text"
                  required
                  value={deviceForm.brand}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="Xiaomi / Motorola / Vivo"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-model" className="block text-xs font-medium text-slate-300">
                  Model Name
                </label>
                <input
                  id="cat-model"
                  type="text"
                  required
                  value={deviceForm.model}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. Redmi Note 14 Pro"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-chipset" className="block text-xs font-medium text-slate-300">
                  Chipset
                </label>
                <input
                  id="cat-chipset"
                  type="text"
                  value={deviceForm.chipset}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, chipset: e.target.value }))}
                  placeholder="Snapdragon / Dimensity"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-id" className="block text-xs font-medium text-slate-300">
                  Device ID (Auto if blank)
                </label>
                <input
                  id="cat-id"
                  type="text"
                  disabled={Boolean(editingBuiltInId)}
                  value={deviceForm.id}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="auto-slug"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs font-mono text-white disabled:opacity-60 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-ram" className="block text-xs font-medium text-slate-300">
                  RAM (GB)
                </label>
                <input
                  id="cat-ram"
                  type="number"
                  min={1}
                  max={32}
                  value={deviceForm.ramGb}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, ramGb: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-hz" className="block text-xs font-medium text-slate-300">
                  Refresh Rate (Hz)
                </label>
                <input
                  id="cat-hz"
                  type="number"
                  min={30}
                  max={240}
                  value={deviceForm.refreshHz}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, refreshHz: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-dpi" className="block text-xs font-medium text-slate-300">
                  Recommended DPI
                </label>
                <input
                  id="cat-dpi"
                  type="number"
                  min={100}
                  max={650}
                  value={deviceForm.recommendedDpi}
                  onChange={(e) =>
                    setDeviceForm((f) => ({ ...f, recommendedDpi: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-3 py-2 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cat-tier" className="block text-xs font-medium text-slate-300">
                  Hardware Tier / Thermal
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <select
                    id="cat-tier"
                    value={deviceForm.tier}
                    onChange={(e) =>
                      setDeviceForm((f) => ({ ...f, tier: e.target.value as DeviceTier }))
                    }
                    className="rounded-lg border border-slate-700 bg-[#111622] px-2 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="low">Low (2-3GB)</option>
                    <option value="mid">Mid (4-6GB)</option>
                    <option value="high">Flagship</option>
                    <option value="gaming">Gaming</option>
                    <option value="ios">iOS</option>
                  </select>
                  <select
                    aria-label="Thermal headroom"
                    value={deviceForm.thermalHeadroom}
                    onChange={(e) =>
                      setDeviceForm((f) => ({
                        ...f,
                        thermalHeadroom: e.target.value as 'Tight' | 'Moderate' | 'High',
                      }))
                    }
                    className="rounded-lg border border-slate-700 bg-[#111622] px-2 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="Tight">Tight</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 0-200 Sensitivity Inputs */}
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs font-semibold text-orange-400">
                Calibrated Sensitivity Baseline (0–200 Scale) &amp; Fire Button Size
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {(
                  [
                    { key: 'general', label: 'General', min: 0, max: 200 },
                    { key: 'redDot', label: 'Red Dot', min: 0, max: 200 },
                    { key: 'scope2x', label: '2x Scope', min: 0, max: 200 },
                    { key: 'scope4x', label: '4x Scope', min: 0, max: 200 },
                    { key: 'sniperScope', label: 'Sniper', min: 0, max: 200 },
                    { key: 'freeLook', label: 'Free Look', min: 0, max: 200 },
                    { key: 'fireButton', label: 'Fire Btn %', min: 32, max: 70 },
                  ] as const
                ).map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={`cat-sens-${field.key}`}
                      className="block text-[11px] font-medium text-slate-300"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`cat-sens-${field.key}`}
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={deviceForm[field.key]}
                      onChange={(e) =>
                        setDeviceForm((f) => ({
                          ...f,
                          [field.key]: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111622] px-2.5 py-2 text-xs font-mono font-bold text-orange-400 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setDeviceEditorOpen(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={catalogSaving}
                className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
              >
                {catalogSaving ? 'Saving...' : 'Save to Master Catalog'}
              </button>
            </div>
          </form>
        )}

        {/* Bulk Add / Update Panel (CSV / JSON) */}
        {bulkPanelOpen && (
          <div className="mx-6 mt-5 rounded-xl border border-slate-800 bg-[#0B0E14] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Bulk Add or Update Devices (JSON or CSV)
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  CSV columns: brand, model, ramGb, refreshHz, chipset, general, redDot, scope2x, scope4x, sniperScope, freeLook, fireButton, recommendedDpi
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkInput(SAMPLE_CSV_BULK)}
                  className="rounded-md border border-slate-700 bg-[#111622] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-orange-500/60"
                >
                  Insert Sample CSV
                </button>
                <button
                  type="button"
                  onClick={() => setBulkInput(SAMPLE_JSON_BULK)}
                  className="rounded-md border border-slate-700 bg-[#111622] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-orange-500/60"
                >
                  Insert Sample JSON
                </button>
                <button
                  type="button"
                  onClick={() => setBulkPanelOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Close bulk import"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <textarea
              rows={7}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Paste CSV rows or a JSON array of device sensitivity objects..."
              className="w-full rounded-lg border border-slate-700 bg-[#111622] p-3 font-mono text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                {parsedBulkPreview === null ? (
                  <span className="text-slate-400">
                    Supports up to 200 devices per bulk import.
                  </span>
                ) : parsedBulkPreview.ok ? (
                  <span className="text-emerald-400 font-medium">
                    Ready to import {parsedBulkPreview.devices.length}{' '}
                    {parsedBulkPreview.devices.length === 1 ? 'device' : 'devices'}.
                  </span>
                ) : (
                  <span className="text-rose-400">{parsedBulkPreview.error}</span>
                )}
              </div>

              <button
                type="button"
                disabled={catalogSaving || !parsedBulkPreview?.ok}
                onClick={handleBulkImportDevices}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {catalogSaving ? 'Importing...' : 'Import to Master Catalog'}
              </button>
            </div>
          </div>
        )}

        {/* Search & Brand Filters */}
        <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search master catalog by brand, model, ID, or chipset..."
              className="w-full rounded-lg border border-slate-800 bg-[#0B0E14] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'samsung', label: 'Samsung' },
                { id: 'xiaomi', label: 'Xiaomi / Mi' },
                { id: 'motorola', label: 'Motorola' },
                { id: 'vivo', label: 'Vivo' },
                { id: 'other', label: 'Other' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCatalogBrandFilter(tab.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  catalogBrandFilter === tab.id
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Entries Table */}
        <div className="overflow-x-auto border-t border-slate-800/80">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0B0E14] text-[11px] font-medium text-slate-400">
                <th className="px-6 py-3">Device Model</th>
                <th className="px-4 py-3">Hardware &amp; DPI</th>
                <th className="px-4 py-3">0–200 Sensitivity Preset</th>
                <th className="px-4 py-3">Fire %</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {displayedCatalogDevices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No devices match this filter in the master catalog.
                  </td>
                </tr>
              ) : (
                displayedCatalogDevices.map((dev) => {
                  const isBuiltIn = builtInIds.has(dev.id);
                  const isEdited = upsertedIds.has(dev.id);
                  const sens = dev.presetSensitivity;
                  return (
                    <tr key={dev.id} className="hover:bg-slate-800/25 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {dev.brand} {dev.model}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              !isBuiltIn
                                ? 'text-orange-400'
                                : isEdited
                                  ? 'text-emerald-400'
                                  : 'text-slate-500'
                            }`}
                          >
                            {!isBuiltIn ? '· Added' : isEdited ? '· Edited' : '· Built-in'}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {dev.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {dev.ramGb}GB · {dev.refreshHz}Hz · DPI {dev.recommendedDpi}
                        <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {dev.chipset}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-200">
                        {sens
                          ? `G:${sens.general} · R:${sens.redDot} · 2x:${sens.scope2x} · 4x:${sens.scope4x} · S:${sens.sniperScope} · FL:${sens.freeLook}`
                          : 'Dynamic formula'}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-orange-400">
                        {dev.presetFireButton ?? 46}%
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDevice(dev)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-orange-500 hover:text-white transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMasterDevice(dev)}
                            aria-label={`Remove ${dev.brand} ${dev.model}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredMasterDevices.length > 20 && catalogSearch.trim().length === 0 && (
          <div className="border-t border-slate-800/80 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {displayedCatalogDevices.length} of {filteredMasterDevices.length} devices
            </span>
            <button
              type="button"
              onClick={() => setCatalogShowAll((prev) => !prev)}
              className="font-medium text-orange-400 hover:underline"
            >
              {catalogShowAll
                ? 'Show First 20'
                : `Show All (${filteredMasterDevices.length})`}
            </button>
          </div>
        )}
      </section>

      {/* Create Custom Customer ID & Password Card */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">
              Create Custom Customer ID &amp; Password
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Directly issue custom Customer ID credentials with a pre-assigned device profile. Passwords are salted and hashed on the server.
          </p>
        </div>

        {createdBanner && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-4 py-3">
            <div className="text-xs">
              <p className="font-semibold text-emerald-400">
                User Access Granted
              </p>
              <p className="mt-0.5 font-mono text-slate-200">
                {createdBanner.email ? `Email: ${createdBanner.email} · ` : ''}ID: {createdBanner.customId} · Password: {createdBanner.password}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              {copiedCreds ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Credentials
                </>
              )}
            </button>
          </div>
        )}

        <form onSubmit={handleCreateCustomer} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <label htmlFor="cust-email" className="block text-xs font-medium text-slate-300">
              Email ID
            </label>
            <input
              id="cust-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="player@gmail.com"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="cust-id" className="block text-xs font-medium text-slate-300">
              User ID (Opt.)
            </label>
            <input
              id="cust-id"
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Auto"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="cust-name" className="block text-xs font-medium text-slate-300">
              Player Name
            </label>
            <input
              id="cust-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional name"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="cust-pass" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-[11px] font-medium text-orange-400 hover:underline"
              >
                Generate
              </button>
            </div>
            <input
              id="cust-pass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 4 chars"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="cust-device" className="block text-xs font-medium text-slate-300">
              Assigned Device
            </label>
            <select
              id="cust-device"
              value={assignedDeviceId}
              onChange={(e) => setAssignedDeviceId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.brand} {d.model}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-12 flex justify-end pt-1">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating...' : 'Create Customer Account'}
            </button>
          </div>
        </form>
      </section>

      {/* Customer Directory Table */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Registered Customer IDs
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {customers.length} customer {customers.length === 1 ? 'account' : 'accounts'} configured
            </p>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-xs text-slate-400">
            Loading customer directory...
          </div>
        ) : customers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-white">No Customer IDs Created Yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Accept a pending customer request or use the form above to create a Customer ID and password.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                  <th className="px-6 py-3">Customer ID</th>
                  <th className="px-4 py-3">Assigned Device</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {customers.map((c) => {
                  const dev = devices.find((d) => d.id === c.assignedDeviceId);
                  return (
                    <React.Fragment key={c.id}>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-mono font-semibold text-white">
                            {c.email || c.customId}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {c.email ? `@${c.customId} · ` : ''}{c.displayName}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {dev ? `${dev.brand} ${dev.model}` : c.assignedDeviceId}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium">
                          <span className={c.active ? 'text-emerald-400' : 'text-rose-400'}>
                            {c.active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                          {c.lastLoginAt
                            ? new Date(c.lastLoginAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetId(resetTargetId === c.id ? null : c.id);
                                setResetPasswordVal('');
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-orange-500 hover:text-white transition-colors"
                            >
                              <KeyRound className="h-3 w-3" />
                              Reset Pass
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(c)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                              <UserX className="h-3 w-3" />
                              {c.active ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c.id)}
                              aria-label={`Delete ${c.customId}`}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {resetTargetId === c.id && (
                        <tr className="bg-[#0B0E14]">
                          <td colSpan={5} className="px-6 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-3">
                              <span className="text-xs text-slate-400">
                                New password for <strong className="font-mono text-white">{c.customId}</strong>:
                              </span>
                              <input
                                type="text"
                                value={resetPasswordVal}
                                onChange={(e) => setResetPasswordVal(e.target.value)}
                                placeholder="Min 4 chars"
                                className="rounded-md border border-slate-700 bg-[#111622] px-3 py-1.5 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSavePasswordReset(c.id)}
                                className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-orange-400"
                              >
                                Save Password
                              </button>
                              <button
                                type="button"
                                onClick={() => setResetTargetId(null)}
                                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Admin Accounts (Full Access) */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">
              Admin Accounts (Full Access)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Create or manage full-access administrator IDs with access to all tabs, customer requests, and credentials.
          </p>
        </div>

        {adminCreatedBanner && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-300">
            {adminCreatedBanner}
          </div>
        )}

        <form
          onSubmit={handleCreateAdminAccount}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor="new-adm-id" className="block text-xs font-medium text-slate-300">
              Admin ID
            </label>
            <input
              id="new-adm-id"
              type="text"
              value={newAdmAccountId}
              onChange={(e) => setNewAdmAccountId(e.target.value)}
              placeholder="e.g. admin_lead"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-adm-name" className="block text-xs font-medium text-slate-300">
              Display Name
            </label>
            <input
              id="new-adm-name"
              type="text"
              value={newAdmAccountName}
              onChange={(e) => setNewAdmAccountName(e.target.value)}
              placeholder="Optional label"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-adm-pass" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              id="new-adm-pass"
              type="password"
              value={newAdmAccountPass}
              onChange={(e) => setNewAdmAccountPass(e.target.value)}
              placeholder="Min 6 characters"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={creatingAdmin}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {creatingAdmin ? 'Creating...' : 'Add Admin ID'}
            </button>
          </div>
        </form>

        {admins.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-800/80">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0B0E14] text-[11px] font-medium text-slate-400">
                  <th className="px-4 py-2.5">Admin ID</th>
                  <th className="px-4 py-2.5">Permissions</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {admins.map((adm) => {
                  const isSelf = adm.customId.toLowerCase() === currentAdminId.toLowerCase();
                  return (
                    <tr key={adm.id} className="hover:bg-slate-800/25">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-semibold text-white">
                          {adm.customId}
                          {isSelf && (
                            <span className="ml-2 text-[11px] font-sans font-medium text-orange-400">
                              (Current)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">{adm.displayName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        Full Admin Access
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className={adm.active ? 'text-emerald-400' : 'text-rose-400'}>
                          {adm.active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleToggleAdminActive(adm)}
                            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                          >
                            {adm.active ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleDeleteAdminAccount(adm.id)}
                            aria-label={`Delete admin ${adm.customId}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Admin ID & Password Reset */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111622] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">
                Reset Admin ID &amp; Password
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {envOverrideActive && currentUserId === 'admin-root'
                ? 'Root admin credentials are currently controlled by ADMIN_ID / ADMIN_PASSCODE in Settings → Secrets. Create a named Admin ID above to manage a separate password in the dashboard.'
                : 'Update your Admin ID and password, or reset back to First-Run Setup.'}
            </p>
          </div>

          {!(envOverrideActive && currentUserId === 'admin-root') && (!confirmResetClaim ? (
            <button
              type="button"
              onClick={() => {
                setConfirmResetClaim(true);
                setError(null);
              }}
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-rose-500/50 hover:text-rose-300 transition-colors"
            >
              Reset to First-Run Setup
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={adminCurrentPass}
                onChange={(e) => setAdminCurrentPass(e.target.value)}
                placeholder="Confirm current password"
                className="rounded-md border border-slate-700 bg-[#0B0E14] px-3 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  try {
                    const res = await fetch('/api/admin/credentials/reset-claim', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ currentPassword: adminCurrentPass }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(data?.error || 'Could not reset admin claim.');
                      return;
                    }
                    onResetAdminClaim();
                  } catch {
                    setError('Network error resetting admin credentials.');
                  }
                }}
                className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
              >
                Confirm Reset &amp; Sign Out
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetClaim(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>

        {adminSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-300">
            {adminSuccess}
          </div>
        )}

        {envOverrideActive && currentUserId === 'admin-root' ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-[#0B0E14] px-4 py-3 text-xs text-slate-400">
            To change the root secret password, edit <span className="font-mono text-slate-200">ADMIN_ID</span> / <span className="font-mono text-slate-200">ADMIN_PASSCODE</span> in Settings → Secrets, or add a named Full-Access Admin ID in the section above.
          </div>
        ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setAdminSuccess(null);
            if (!adminCurrentPass) {
              setError('Enter your current admin password.');
              return;
            }
            if (newAdminPass.length < 6) {
              setError('New admin password must be at least 6 characters.');
              return;
            }
            if (newAdminPass !== confirmAdminPass) {
              setError('New admin passwords do not match.');
              return;
            }

            setAdminSaving(true);
            try {
              const res = await fetch('/api/admin/credentials', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  currentPassword: adminCurrentPass,
                  newAdminId: newAdminId.trim(),
                  newPassword: newAdminPass,
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data?.error || 'Could not update admin credentials.');
                return;
              }
              onAdminCredentialsUpdated(data.token, data.user);
              setAdminCurrentPass('');
              setNewAdminPass('');
              setConfirmAdminPass('');
              setAdminSuccess(`Admin credentials updated for "${data.user.customId}".`);
            } catch {
              setError('Network error updating admin credentials.');
            } finally {
              setAdminSaving(false);
            }
          }}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor="adm-cur-pass" className="block text-xs font-medium text-slate-300">
              Current Password
            </label>
            <input
              id="adm-cur-pass"
              type="password"
              value={adminCurrentPass}
              onChange={(e) => setAdminCurrentPass(e.target.value)}
              placeholder="Current admin password"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adm-new-id" className="block text-xs font-medium text-slate-300">
              New Admin ID
            </label>
            <input
              id="adm-new-id"
              type="text"
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
              placeholder="e.g. admin"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adm-new-pass" className="block text-xs font-medium text-slate-300">
              New Password
            </label>
            <input
              id="adm-new-pass"
              type="password"
              value={newAdminPass}
              onChange={(e) => setNewAdminPass(e.target.value)}
              placeholder="Min 6 characters"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="adm-conf-pass" className="block text-xs font-medium text-slate-300">
              Confirm Password
            </label>
            <input
              id="adm-conf-pass"
              type="password"
              value={confirmAdminPass}
              onChange={(e) => setConfirmAdminPass(e.target.value)}
              placeholder="Re-enter password"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={adminSaving}
              className="rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60 transition-colors"
            >
              {adminSaving ? 'Updating...' : 'Save New Admin ID & Password'}
            </button>
          </div>
        </form>
        )}
      </section>
    </div>
  );
};
