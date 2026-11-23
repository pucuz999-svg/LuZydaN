import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

dotenv.config();

interface CustomerRecord {
  id: string;
  customId: string;
  displayName: string;
  passwordHash: string;
  assignedDeviceId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminClaimRecord {
  adminId: string;
  passwordHash: string;
  claimedAt: string;
}

interface AdminRecord {
  id: string;
  customId: string;
  displayName: string;
  passwordHash: string;
  active: boolean;
  fullAccess: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface CustomerRequestRecord {
  id: string;
  customId: string;
  displayName: string;
  passwordHash: string;
  requestedDeviceId: string;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason?: string;
}

interface AuthStoreData {
  adminClaim: AdminClaimRecord | null;
  admins: AdminRecord[];
  customers: CustomerRecord[];
  requests: CustomerRequestRecord[];
}

interface SessionPayload {
  sub: string;
  role: 'admin' | 'customer';
  customId: string;
  displayName: string;
  assignedDeviceId?: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

const PORT = 3000;
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'auth-store.json');

if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store path configuration');
}

function ensureStore(): AuthStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: AuthStoreData = {
      adminClaim: null,
      admins: [],
      customers: [],
      requests: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), { mode: 0o600 });
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthStoreData>;
    return {
      adminClaim: parsed.adminClaim ?? null,
      admins: Array.isArray(parsed.admins) ? parsed.admins : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    };
  } catch {
    return { adminClaim: null, admins: [], customers: [], requests: [] };
  }
}

function saveStore(data: AuthStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = path.resolve(DATA_DIR, `auth-store.${process.pid}.tmp`);
  if (!tempPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp store path');
  }
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, STORE_PATH);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  if (!safeCompareStrings(providedSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.role !== 'admin' && parsed.role !== 'customer') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isValidCustomId(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(value);
}

function sanitizeCustomer(c: CustomerRecord) {
  return {
    id: c.id,
    customId: c.customId,
    displayName: c.displayName,
    assignedDeviceId: c.assignedDeviceId,
    active: c.active,
    createdAt: c.createdAt,
    lastLoginAt: c.lastLoginAt,
  };
}

function sanitizeAdmin(a: AdminRecord) {
  return {
    id: a.id,
    customId: a.customId,
    displayName: a.displayName,
    active: a.active,
    fullAccess: a.fullAccess,
    createdAt: a.createdAt,
    lastLoginAt: a.lastLoginAt,
  };
}

function sanitizeRequest(r: CustomerRequestRecord) {
  return {
    id: r.id,
    customId: r.customId,
    displayName: r.displayName,
    requestedDeviceId: r.requestedDeviceId,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewedBy: r.reviewedBy,
    rejectionReason: r.rejectionReason,
  };
}

function getEnvAdminConfig(): { adminId: string; passcode: string } | null {
  const passcode = (process.env.ADMIN_PASSCODE || '').trim();
  if (!passcode) return null;
  const adminId = (process.env.ADMIN_ID || '').trim() || 'admin';
  return { adminId, passcode };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Auth status: checks if Admin credentials are configured (env, claimed, or named admins)
  app.get('/api/auth/status', (_req, res) => {
    const envAdmin = getEnvAdminConfig();
    const store = ensureStore();
    const adminConfigured = Boolean(
      envAdmin || store.adminClaim || store.admins.some((a) => a.active)
    );
    res.json({
      adminConfigured,
      envOverrideActive: Boolean(envAdmin),
      customerCount: store.customers.length,
    });
  });

  // One-time first-run Admin Claim (locks automatically once claimed or when ADMIN_PASSCODE env is set)
  app.post('/api/auth/admin/claim', (req, res) => {
    const envAdmin = getEnvAdminConfig();
    const store = ensureStore();

    if (envAdmin || store.adminClaim) {
      res.status(409).json({
        error: 'Admin credentials are already configured. Sign in using Admin Login.',
      });
      return;
    }

    const customId = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidCustomId(customId)) {
      res.status(400).json({
        error: 'Admin ID must be 3-32 characters (letters, numbers, ., _, -).',
      });
      return;
    }

    if (password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'Password must be between 6 and 128 characters.',
      });
      return;
    }

    const claim: AdminClaimRecord = {
      adminId: customId,
      passwordHash: hashPassword(password),
      claimedAt: new Date().toISOString(),
    };

    store.adminClaim = claim;
    saveStore(store);

    const token = signSessionToken({
      sub: 'admin-root',
      role: 'admin',
      customId: claim.adminId,
      displayName: 'Administrator',
    });

    res.status(201).json({
      token,
      user: {
        id: 'admin-root',
        role: 'admin',
        customId: claim.adminId,
        displayName: 'Administrator',
      },
    });
  });

  // Unified Login for Admin & Customer
  app.post('/api/auth/login', (req, res) => {
    const role = req.body?.role === 'admin' ? 'admin' : 'customer';
    const customId = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!customId || !password) {
      res.status(400).json({ error: 'ID and password are required.' });
      return;
    }

    const store = ensureStore();

    if (role === 'admin') {
      const envAdmin = getEnvAdminConfig();

      // If envAdmin is configured and the login ID matches envAdmin.adminId, enforce env passcode strictly
      if (
        envAdmin &&
        safeCompareStrings(customId.toLowerCase(), envAdmin.adminId.toLowerCase())
      ) {
        if (!safeCompareStrings(password, envAdmin.passcode)) {
          res.status(401).json({ error: 'Invalid Admin ID or password.' });
          return;
        }
        const token = signSessionToken({
          sub: 'admin-root',
          role: 'admin',
          customId: envAdmin.adminId,
          displayName: 'Administrator',
        });
        res.json({
          token,
          user: {
            id: 'admin-root',
            role: 'admin',
            customId: envAdmin.adminId,
            displayName: 'Administrator',
          },
        });
        return;
      }

      // Check named Admin accounts (salted scrypt hashes in store)
      const namedAdmin = store.admins.find(
        (a) => a.customId.toLowerCase() === customId.toLowerCase()
      );
      if (namedAdmin) {
        if (!verifyPasswordHash(password, namedAdmin.passwordHash)) {
          res.status(401).json({ error: 'Invalid Admin ID or password.' });
          return;
        }
        if (!namedAdmin.active) {
          res.status(403).json({ error: 'This Admin account has been suspended.' });
          return;
        }

        namedAdmin.lastLoginAt = new Date().toISOString();
        saveStore(store);

        const token = signSessionToken({
          sub: namedAdmin.id,
          role: 'admin',
          customId: namedAdmin.customId,
          displayName: namedAdmin.displayName,
        });
        res.json({
          token,
          user: {
            id: namedAdmin.id,
            role: 'admin',
            customId: namedAdmin.customId,
            displayName: namedAdmin.displayName,
          },
        });
        return;
      }

      // Fallback to claimed root admin only when envAdmin is not overriding it
      if (!envAdmin && store.adminClaim) {
        const idOk = safeCompareStrings(
          customId.toLowerCase(),
          store.adminClaim.adminId.toLowerCase()
        );
        const passOk = verifyPasswordHash(password, store.adminClaim.passwordHash);
        if (!idOk || !passOk) {
          res.status(401).json({ error: 'Invalid Admin ID or password.' });
          return;
        }

        const token = signSessionToken({
          sub: 'admin-root',
          role: 'admin',
          customId: store.adminClaim.adminId,
          displayName: 'Administrator',
        });

        res.json({
          token,
          user: {
            id: 'admin-root',
            role: 'admin',
            customId: store.adminClaim.adminId,
            displayName: 'Administrator',
          },
        });
        return;
      }

      if (!envAdmin && !store.adminClaim && store.admins.length === 0) {
        res.status(400).json({
          error: 'No admin account has been set up yet. Complete first-run Admin Setup.',
        });
        return;
      }

      res.status(401).json({ error: 'Invalid Admin ID or password.' });
      return;
    }

    // Customer login
    const customer = store.customers.find(
      (c) => c.customId.toLowerCase() === customId.toLowerCase()
    );
    if (!customer) {
      const matchingReq = store.requests.find(
        (r) =>
          r.customId.toLowerCase() === customId.toLowerCase() &&
          verifyPasswordHash(password, r.passwordHash)
      );
      if (matchingReq?.status === 'pending') {
        res.status(403).json({
          error: 'Your Customer ID request is pending Admin approval.',
        });
        return;
      }
      if (matchingReq?.status === 'rejected') {
        res.status(403).json({
          error: matchingReq.rejectionReason
            ? `Your Customer ID request was rejected: ${matchingReq.rejectionReason}`
            : 'Your Customer ID request was rejected by the administrator.',
        });
        return;
      }
      res.status(401).json({ error: 'Invalid Customer ID or password.' });
      return;
    }

    if (!verifyPasswordHash(password, customer.passwordHash)) {
      res.status(401).json({ error: 'Invalid Customer ID or password.' });
      return;
    }

    if (!customer.active) {
      res.status(403).json({
        error: 'This Customer ID has been suspended by an administrator.',
      });
      return;
    }

    customer.lastLoginAt = new Date().toISOString();
    saveStore(store);

    const token = signSessionToken({
      sub: customer.id,
      role: 'customer',
      customId: customer.customId,
      displayName: customer.displayName,
      assignedDeviceId: customer.assignedDeviceId,
    });

    res.json({
      token,
      user: {
        id: customer.id,
        role: 'customer',
        customId: customer.customId,
        displayName: customer.displayName,
        assignedDeviceId: customer.assignedDeviceId,
      },
    });
  });

  // Public: Customer submits a request for a custom ID & password (pending Admin accept/reject)
  app.post('/api/auth/request-access', (req, res) => {
    const customId = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 48)
        : customId;
    const requestedDeviceId =
      typeof req.body?.requestedDeviceId === 'string' && req.body.requestedDeviceId.trim()
        ? req.body.requestedDeviceId.trim().slice(0, 64)
        : 'moto-g54';
    const note =
      typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 180) : '';

    if (!isValidCustomId(customId)) {
      res.status(400).json({
        error: 'Customer ID must be 3-32 characters (letters, numbers, ., _, -).',
      });
      return;
    }

    if (password.length < 4 || password.length > 128) {
      res.status(400).json({
        error: 'Password must be between 4 and 128 characters.',
      });
      return;
    }

    const store = ensureStore();
    if (
      store.customers.some((c) => c.customId.toLowerCase() === customId.toLowerCase())
    ) {
      res.status(409).json({
        error: 'This Customer ID is already registered. Choose a different ID.',
      });
      return;
    }
    if (
      store.requests.some(
        (r) =>
          r.status === 'pending' &&
          r.customId.toLowerCase() === customId.toLowerCase()
      )
    ) {
      res.status(409).json({
        error: 'A pending request for this Customer ID already exists.',
      });
      return;
    }

    const record: CustomerRequestRecord = {
      id: `req-${crypto.randomUUID()}`,
      customId,
      displayName,
      passwordHash: hashPassword(password),
      requestedDeviceId,
      note,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
    };

    store.requests.unshift(record);
    saveStore(store);

    res.status(201).json({
      request: sanitizeRequest(record),
      message: 'Request submitted. An administrator will accept or reject your ID shortly.',
    });
  });

  // Verify active Bearer session
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    res.json({
      user: {
        id: u.sub,
        role: u.role,
        customId: u.customId,
        displayName: u.displayName,
        assignedDeviceId: u.assignedDeviceId,
      },
    });
  });

  // Admin-only: List Customer Requests
  app.get('/api/admin/requests', requireAuth, requireAdmin, (_req, res) => {
    const store = ensureStore();
    res.json({ requests: store.requests.map(sanitizeRequest) });
  });

  // Admin-only: Accept or Reject Customer Request
  app.post(
    '/api/admin/requests/:id/decide',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const id = req.params.id;
      const decision = req.body?.decision === 'accept' ? 'accept' : req.body?.decision === 'reject' ? 'reject' : null;
      if (!decision) {
        res.status(400).json({ error: 'Decision must be "accept" or "reject".' });
        return;
      }

      const store = ensureStore();
      const target = store.requests.find((r) => r.id === id);
      if (!target) {
        res.status(404).json({ error: 'Customer request not found.' });
        return;
      }
      if (target.status !== 'pending') {
        res.status(409).json({ error: 'This request has already been reviewed.' });
        return;
      }

      const now = new Date().toISOString();
      const reviewer = req.authUser?.customId || 'admin';

      if (decision === 'accept') {
        if (
          store.customers.some(
            (c) => c.customId.toLowerCase() === target.customId.toLowerCase()
          )
        ) {
          res.status(409).json({
            error: 'A customer with this Custom ID already exists.',
          });
          return;
        }

        const newCustomer: CustomerRecord = {
          id: `cust-${crypto.randomUUID()}`,
          customId: target.customId,
          displayName: target.displayName,
          passwordHash: target.passwordHash,
          assignedDeviceId: target.requestedDeviceId,
          active: true,
          createdAt: now,
          lastLoginAt: null,
        };

        store.customers.unshift(newCustomer);
        target.status = 'accepted';
        target.reviewedAt = now;
        target.reviewedBy = reviewer;
        saveStore(store);

        res.json({
          request: sanitizeRequest(target),
          customer: sanitizeCustomer(newCustomer),
        });
        return;
      }

      const reason =
        typeof req.body?.rejectionReason === 'string'
          ? req.body.rejectionReason.trim().slice(0, 140)
          : '';

      target.status = 'rejected';
      target.reviewedAt = now;
      target.reviewedBy = reviewer;
      if (reason) {
        target.rejectionReason = reason;
      }
      saveStore(store);

      res.json({ request: sanitizeRequest(target) });
    }
  );

  // Admin-only: List Customer ID/Password accounts
  app.get('/api/admin/customers', requireAuth, requireAdmin, (_req, res) => {
    const store = ensureStore();
    res.json({ customers: store.customers.map(sanitizeCustomer) });
  });

  // Admin-only: Create Customer ID & Password
  app.post('/api/admin/customers', requireAuth, requireAdmin, (req, res) => {
    const customId = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 48)
        : customId;
    const assignedDeviceId =
      typeof req.body?.assignedDeviceId === 'string' && req.body.assignedDeviceId.trim()
        ? req.body.assignedDeviceId.trim().slice(0, 64)
        : 'moto-g54';

    if (!isValidCustomId(customId)) {
      res.status(400).json({
        error: 'Customer ID must be 3-32 characters (letters, numbers, ., _, -).',
      });
      return;
    }

    if (password.length < 4 || password.length > 128) {
      res.status(400).json({
        error: 'Customer password must be between 4 and 128 characters.',
      });
      return;
    }

    const store = ensureStore();
    if (
      store.customers.some((c) => c.customId.toLowerCase() === customId.toLowerCase())
    ) {
      res.status(409).json({ error: 'A customer with this Custom ID already exists.' });
      return;
    }

    const record: CustomerRecord = {
      id: `cust-${crypto.randomUUID()}`,
      customId,
      displayName,
      passwordHash: hashPassword(password),
      assignedDeviceId,
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    store.customers.unshift(record);
    saveStore(store);

    res.status(201).json({ customer: sanitizeCustomer(record) });
  });

  // Admin-only: Update Customer (toggle active, reset password, update device/name)
  app.patch('/api/admin/customers/:id', requireAuth, requireAdmin, (req, res) => {
    const id = req.params.id;
    const store = ensureStore();
    const target = store.customers.find((c) => c.id === id);
    if (!target) {
      res.status(404).json({ error: 'Customer account not found.' });
      return;
    }

    if (typeof req.body?.active === 'boolean') {
      target.active = req.body.active;
    }
    if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
      target.displayName = req.body.displayName.trim().slice(0, 48);
    }
    if (
      typeof req.body?.assignedDeviceId === 'string' &&
      req.body.assignedDeviceId.trim()
    ) {
      target.assignedDeviceId = req.body.assignedDeviceId.trim().slice(0, 64);
    }
    if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
      if (req.body.password.length < 4 || req.body.password.length > 128) {
        res.status(400).json({
          error: 'New password must be between 4 and 128 characters.',
        });
        return;
      }
      target.passwordHash = hashPassword(req.body.password);
    }

    saveStore(store);
    res.json({ customer: sanitizeCustomer(target) });
  });

  // Admin-only: Delete Customer account
  app.delete('/api/admin/customers/:id', requireAuth, requireAdmin, (req, res) => {
    const id = req.params.id;
    const store = ensureStore();
    const idx = store.customers.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Customer account not found.' });
      return;
    }
    store.customers.splice(idx, 1);
    saveStore(store);
    res.json({ deleted: true });
  });

  // Admin-only: List named Admin accounts
  app.get('/api/admin/admins', requireAuth, requireAdmin, (_req, res) => {
    const store = ensureStore();
    res.json({ admins: store.admins.map(sanitizeAdmin) });
  });

  // Admin-only: Create a full-access Admin account
  app.post('/api/admin/admins', requireAuth, requireAdmin, (req, res) => {
    const customId = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 48)
        : `Admin (${customId})`;

    if (!isValidCustomId(customId)) {
      res.status(400).json({
        error: 'Admin ID must be 3-32 characters (letters, numbers, ., _, -).',
      });
      return;
    }

    if (password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'Admin password must be between 6 and 128 characters.',
      });
      return;
    }

    const envAdmin = getEnvAdminConfig();
    const store = ensureStore();

    if (
      (envAdmin && envAdmin.adminId.toLowerCase() === customId.toLowerCase()) ||
      (store.adminClaim && store.adminClaim.adminId.toLowerCase() === customId.toLowerCase()) ||
      store.admins.some((a) => a.customId.toLowerCase() === customId.toLowerCase())
    ) {
      res.status(409).json({ error: 'An admin with this ID already exists.' });
      return;
    }

    const record: AdminRecord = {
      id: `adm-${crypto.randomUUID()}`,
      customId,
      displayName,
      passwordHash: hashPassword(password),
      active: true,
      fullAccess: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    store.admins.unshift(record);
    saveStore(store);

    res.status(201).json({ admin: sanitizeAdmin(record) });
  });

  // Admin-only: Update named Admin account (toggle active or reset password)
  app.patch(
    '/api/admin/admins/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const id = req.params.id;
      const store = ensureStore();
      const target = store.admins.find((a) => a.id === id);
      if (!target) {
        res.status(404).json({ error: 'Admin account not found.' });
        return;
      }

      if (typeof req.body?.active === 'boolean') {
        if (!req.body.active && req.authUser?.sub === target.id) {
          res.status(400).json({ error: 'You cannot suspend your own active session.' });
          return;
        }
        target.active = req.body.active;
      }
      if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
        target.displayName = req.body.displayName.trim().slice(0, 48);
      }
      if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
        if (req.body.password.length < 6 || req.body.password.length > 128) {
          res.status(400).json({
            error: 'New admin password must be between 6 and 128 characters.',
          });
          return;
        }
        target.passwordHash = hashPassword(req.body.password);
      }

      saveStore(store);
      res.json({ admin: sanitizeAdmin(target) });
    }
  );

  // Admin-only: Delete named Admin account
  app.delete(
    '/api/admin/admins/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const id = req.params.id;
      if (req.authUser?.sub === id) {
        res.status(400).json({ error: 'You cannot delete the currently signed-in admin account.' });
        return;
      }
      const store = ensureStore();
      const idx = store.admins.findIndex((a) => a.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Admin account not found.' });
        return;
      }
      store.admins.splice(idx, 1);
      saveStore(store);
      res.json({ deleted: true });
    }
  );

  // Admin-only: Update / Reset Admin ID and Password for the signed-in admin
  app.post(
    '/api/admin/credentials',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newAdminId =
        typeof req.body?.newAdminId === 'string' ? req.body.newAdminId.trim() : '';
      const newPassword =
        typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!isValidCustomId(newAdminId)) {
        res.status(400).json({
          error: 'New Admin ID must be 3-32 characters (letters, numbers, ., _, -).',
        });
        return;
      }

      if (newPassword.length < 6 || newPassword.length > 128) {
        res.status(400).json({
          error: 'New admin password must be between 6 and 128 characters.',
        });
        return;
      }

      const store = ensureStore();
      const envAdmin = getEnvAdminConfig();

      // Signed in as a named Admin account in store.admins
      if (req.authUser?.sub && req.authUser.sub !== 'admin-root') {
        const target = store.admins.find((a) => a.id === req.authUser?.sub);
        if (!target) {
          res.status(404).json({ error: 'Admin account record not found.' });
          return;
        }
        if (!verifyPasswordHash(currentPassword, target.passwordHash)) {
          res.status(401).json({ error: 'Current admin password is incorrect.' });
          return;
        }
        if (
          (envAdmin && envAdmin.adminId.toLowerCase() === newAdminId.toLowerCase()) ||
          (store.adminClaim &&
            store.adminClaim.adminId.toLowerCase() === newAdminId.toLowerCase()) ||
          store.admins.some(
            (a) => a.id !== target.id && a.customId.toLowerCase() === newAdminId.toLowerCase()
          )
        ) {
          res.status(409).json({ error: 'Another admin already uses this ID.' });
          return;
        }

        target.customId = newAdminId;
        target.passwordHash = hashPassword(newPassword);
        saveStore(store);

        const token = signSessionToken({
          sub: target.id,
          role: 'admin',
          customId: target.customId,
          displayName: target.displayName,
        });

        res.json({
          token,
          user: {
            id: target.id,
            role: 'admin',
            customId: target.customId,
            displayName: target.displayName,
          },
        });
        return;
      }

      // Signed in as root admin
      if (envAdmin) {
        res.status(409).json({
          error:
            'Root admin credentials are set via ADMIN_ID / ADMIN_PASSCODE environment secrets. Update them in Settings -> Secrets.',
        });
        return;
      }

      if (!store.adminClaim) {
        res.status(400).json({ error: 'No claimed admin credentials exist yet.' });
        return;
      }

      if (!verifyPasswordHash(currentPassword, store.adminClaim.passwordHash)) {
        res.status(401).json({ error: 'Current admin password is incorrect.' });
        return;
      }

      store.adminClaim = {
        adminId: newAdminId,
        passwordHash: hashPassword(newPassword),
        claimedAt: new Date().toISOString(),
      };
      saveStore(store);

      const token = signSessionToken({
        sub: 'admin-root',
        role: 'admin',
        customId: newAdminId,
        displayName: 'Administrator',
      });

      res.json({
        token,
        user: {
          id: 'admin-root',
          role: 'admin',
          customId: newAdminId,
          displayName: 'Administrator',
        },
      });
    }
  );

  // Admin-only: Reset claimed admin back to First-Run Setup
  app.post(
    '/api/admin/credentials/reset-claim',
    requireAuth,
    requireAdmin,
    (req, res) => {
      const envAdmin = getEnvAdminConfig();
      if (envAdmin) {
        res.status(409).json({
          error:
            'ADMIN_PASSCODE environment secret is set. Remove or edit it in Settings -> Secrets.',
        });
        return;
      }

      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const store = ensureStore();

      if (
        store.adminClaim &&
        !verifyPasswordHash(currentPassword, store.adminClaim.passwordHash)
      ) {
        res.status(401).json({ error: 'Current admin password is required to reset.' });
        return;
      }

      store.adminClaim = null;
      saveStore(store);
      res.json({ reset: true });
    }
  );

  // Vite middleware in dev, static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FireTune server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
