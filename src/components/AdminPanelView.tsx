import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Inbox,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import {
  AdminAccount,
  AuthUser,
  CustomerAccount,
  CustomerRequest,
  DeviceSpec,
  RequestStatus,
} from '../types';

interface AdminPanelViewProps {
  token: string;
  currentAdminId: string;
  devices: DeviceSpec[];
  onAdminCredentialsUpdated: (token: string, user: AuthUser) => void;
  onResetAdminClaim: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  token,
  currentAdminId,
  devices,
  onAdminCredentialsUpdated,
  onResetAdminClaim,
}) => {
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | RequestStatus>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create customer form state
  const [customId, setCustomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [assignedDeviceId, setAssignedDeviceId] = useState('moto-g54');
  const [creating, setCreating] = useState(false);
  const [createdBanner, setCreatedBanner] = useState<{
    customId: string;
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

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRes, reqRes, admRes] = await Promise.all([
        fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/requests', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/admins', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const custData = await custRes.json();
      const reqData = await reqRes.json();
      const admData = await admRes.json();

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

    const trimmedId = customId.trim();
    if (!trimmedId || !password) {
      setError('Enter both a Customer ID and Password.');
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
          customId: trimmedId,
          displayName: displayName.trim() || trimmedId,
          password,
          assignedDeviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not create customer account.');
        return;
      }

      setCustomers((prev) => [data.customer, ...prev]);
      setCreatedBanner({ customId: trimmedId, password });
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
    const text = `FireTune Customer Login\nCustomer ID: ${createdBanner.customId}\nPassword: ${createdBanner.password}`;
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
                        {reqItem.customId}
                      </span>
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
                          ? 'Accepted'
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
                          Accept
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
                Customer Account Created
              </p>
              <p className="mt-0.5 font-mono text-slate-200">
                ID: {createdBanner.customId} · Password: {createdBanner.password}
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
            <label htmlFor="cust-id" className="block text-xs font-medium text-slate-300">
              Custom Customer ID
            </label>
            <input
              id="cust-id"
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g. moto_player01"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="cust-name" className="block text-xs font-medium text-slate-300">
              Player Name
            </label>
            <input
              id="cust-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional display name"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0E14] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center justify-between">
              <label htmlFor="cust-pass" className="block text-xs font-medium text-slate-300">
                Custom Password
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
              placeholder="Min 4 characters"
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
                          <p className="font-mono font-semibold text-white">{c.customId}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{c.displayName}</p>
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
              Update your claimed Admin ID and password, or reset back to First-Run Setup.
            </p>
          </div>

          {!confirmResetClaim ? (
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
          )}
        </div>

        {adminSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-300">
            {adminSuccess}
          </div>
        )}

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
      </section>
    </div>
  );
};
