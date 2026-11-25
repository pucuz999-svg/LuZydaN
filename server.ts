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
  email?: string;
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
  email?: string;
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
  email?: string;
  displayName: string;
  assignedDeviceId?: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

interface SensitivityValuesRecord {
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  sniperScope: number;
  freeLook: number;
}

interface DeviceSpecRecord {
  id: string;
  brand: string;
  model: string;
  tier: 'low' | 'mid' | 'high' | 'gaming' | 'ios';
  os: 'Android' | 'iOS';
  ramGb: number;
  refreshHz: number;
  touchSamplingHz: number;
  ppi: number;
  screenInches: number;
  chipset: string;
  defaultDpi: number;
  recommendedDpi: number;
  thermalHeadroom: 'Tight' | 'Moderate' | 'High';
  presetSensitivity?: SensitivityValuesRecord;
  presetFireButton?: number;
}

interface CatalogStoreData {
  upsertedDevices: DeviceSpecRecord[];
  removedIds: string[];
}

const PORT = 3000;
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'auth-store.json');
const CATALOG_PATH = path.resolve(DATA_DIR, 'device-catalog.json');

if (!STORE_PATH.startsWith(DATA_DIR + path.sep) || !CATALOG_PATH.startsWith(DATA_DIR + path.sep)) {
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

function readCatalogStore(): CatalogStoreData {
  if (!fs.existsSync(CATALOG_PATH)) {
    return { upsertedDevices: [], removedIds: [] };
  }
  try {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CatalogStoreData>;
    return {
      upsertedDevices: Array.isArray(parsed.upsertedDevices) ? parsed.upsertedDevices : [],
      removedIds: Array.isArray(parsed.removedIds)
        ? parsed.removedIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return { upsertedDevices: [], removedIds: [] };
  }
}

function saveCatalogStore(data: CatalogStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = path.resolve(DATA_DIR, `device-catalog.${process.pid}.tmp`);
  if (!tempPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp catalog path');
  }
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, CATALOG_PATH);
}

const VALID_TIERS = new Set(['low', 'mid', 'high', 'gaming', 'ios']);
const VALID_OS = new Set(['Android', 'iOS']);
const VALID_THERMAL = new Set(['Tight', 'Moderate', 'High']);
const DEVICE_ID_REGEX = /^[a-zA-Z0-9._-]{2,64}$/;

function slugifyDeviceId(brand: string, model: string): string {
  const slug = `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length >= 2 ? slug : `device-${Date.now()}`;
}

function parseBoundedInt(value: unknown, min: number, max: number, fallback?: number): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback !== undefined ? fallback : null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function parseBoundedFloat(value: unknown, min: number, max: number, fallback: number): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return Math.round(num * 100) / 100;
}

function sanitizeAndValidateDeviceSpec(
  raw: unknown
): { ok: true; device: DeviceSpecRecord } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Device entry must be a JSON object.' };
  }
  const input = raw as Record<string, unknown>;
  const brand = typeof input.brand === 'string' ? input.brand.trim().slice(0, 40) : '';
  const model = typeof input.model === 'string' ? input.model.trim().slice(0, 80) : '';
  if (!brand || !model) {
    return { ok: false, error: 'Brand and model are required.' };
  }

  const rawId = typeof input.id === 'string' ? input.id.trim() : '';
  const id = rawId ? rawId : slugifyDeviceId(brand, model);
  if (!DEVICE_ID_REGEX.test(id)) {
    return {
      ok: false,
      error: `Invalid device ID "${id}". Use 2-64 letters, numbers, ".", "_", or "-".`,
    };
  }

  const ramGb = parseBoundedInt(input.ramGb, 1, 32, 8);
  if (ramGb === null) {
    return { ok: false, error: `Invalid RAM GB for ${brand} ${model} (expected 1-32).` };
  }

  const osRaw = typeof input.os === 'string' ? input.os.trim() : '';
  const os: 'Android' | 'iOS' =
    osRaw && VALID_OS.has(osRaw)
      ? (osRaw as 'Android' | 'iOS')
      : brand.toLowerCase() === 'apple'
        ? 'iOS'
        : 'Android';

  const tierRaw = typeof input.tier === 'string' ? input.tier.trim().toLowerCase() : '';
  const tier: 'low' | 'mid' | 'high' | 'gaming' | 'ios' =
    tierRaw && VALID_TIERS.has(tierRaw)
      ? (tierRaw as DeviceSpecRecord['tier'])
      : os === 'iOS'
        ? 'ios'
        : ramGb <= 3
          ? 'low'
          : ramGb <= 6
            ? 'mid'
            : 'high';

  const refreshHz = parseBoundedInt(input.refreshHz, 30, 240, 120);
  if (refreshHz === null) {
    return { ok: false, error: `Invalid refreshHz for ${brand} ${model} (expected 30-240).` };
  }

  const touchSamplingHz = parseBoundedInt(input.touchSamplingHz, 60, 1000, refreshHz >= 120 ? 240 : 120);
  if (touchSamplingHz === null) {
    return { ok: false, error: `Invalid touchSamplingHz for ${brand} ${model} (expected 60-1000).` };
  }

  const ppi = parseBoundedInt(input.ppi, 120, 700, 400);
  if (ppi === null) {
    return { ok: false, error: `Invalid PPI for ${brand} ${model} (expected 120-700).` };
  }

  const screenInches = parseBoundedFloat(input.screenInches, 4.0, 15.0, 6.67);
  if (screenInches === null) {
    return { ok: false, error: `Invalid screenInches for ${brand} ${model} (expected 4.0-15.0).` };
  }

  const chipset =
    typeof input.chipset === 'string' && input.chipset.trim()
      ? input.chipset.trim().slice(0, 80)
      : os === 'iOS'
        ? 'Apple Silicon'
        : 'Snapdragon / Dimensity';

  const defaultDpi = parseBoundedInt(input.defaultDpi, 100, 600, os === 'iOS' ? 114 : 392);
  const recommendedDpi = parseBoundedInt(input.recommendedDpi, 100, 650, os === 'iOS' ? 120 : 510);
  if (defaultDpi === null || recommendedDpi === null) {
    return { ok: false, error: `Invalid DPI values for ${brand} ${model}.` };
  }

  const thermalRaw = typeof input.thermalHeadroom === 'string' ? input.thermalHeadroom.trim() : '';
  const thermalHeadroom: 'Tight' | 'Moderate' | 'High' = VALID_THERMAL.has(thermalRaw)
    ? (thermalRaw as DeviceSpecRecord['thermalHeadroom'])
    : ramGb <= 3
      ? 'Tight'
      : ramGb >= 8
        ? 'High'
        : 'Moderate';

  let presetSensitivity: SensitivityValuesRecord | undefined;
  if (input.presetSensitivity !== undefined && input.presetSensitivity !== null) {
    if (typeof input.presetSensitivity !== 'object' || Array.isArray(input.presetSensitivity)) {
      return { ok: false, error: `presetSensitivity must be an object for ${brand} ${model}.` };
    }
    const ps = input.presetSensitivity as Record<string, unknown>;
    const general = parseBoundedInt(ps.general, 0, 200);
    const redDot = parseBoundedInt(ps.redDot, 0, 200);
    const scope2x = parseBoundedInt(ps.scope2x, 0, 200);
    const scope4x = parseBoundedInt(ps.scope4x, 0, 200);
    const sniperScope = parseBoundedInt(ps.sniperScope, 0, 200);
    const freeLook = parseBoundedInt(ps.freeLook, 0, 200);
    if (
      general === null ||
      redDot === null ||
      scope2x === null ||
      scope4x === null ||
      sniperScope === null ||
      freeLook === null
    ) {
      return {
        ok: false,
        error: `Sensitivity values for ${brand} ${model} must all be integers between 0 and 200.`,
      };
    }
    presetSensitivity = { general, redDot, scope2x, scope4x, sniperScope, freeLook };
  }

  let presetFireButton: number | undefined;
  if (input.presetFireButton !== undefined && input.presetFireButton !== null && input.presetFireButton !== '') {
    const fb = parseBoundedInt(input.presetFireButton, 32, 70);
    if (fb === null) {
      return {
        ok: false,
        error: `Fire Button size for ${brand} ${model} must be between 32 and 70.`,
      };
    }
    presetFireButton = fb;
  }

  return {
    ok: true,
    device: {
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
      ...(presetSensitivity ? { presetSensitivity } : {}),
      ...(presetFireButton !== undefined ? { presetFireButton } : {}),
    },
  };
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

function isValidEmail(value: string): boolean {
  return value.length <= 120 && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

function deriveCustomIdFromEmail(email: string, store: AuthStoreData): string {
  const local = email.split('@')[0] || 'player';
  let base = local.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 24);
  if (base.length < 3) base = `${base}_user`.slice(0, 24);
  let candidate = base;
  let suffix = 1;
  while (
    store.customers.some((c) => c.customId.toLowerCase() === candidate.toLowerCase()) ||
    store.requests.some((r) => r.status === 'pending' && r.customId.toLowerCase() === candidate.toLowerCase())
  ) {
    candidate = `${base.slice(0, 20)}_${suffix++}`;
  }
  return candidate;
}

function sanitizeCustomer(c: CustomerRecord) {
  return {
    id: c.id,
    customId: c.customId,
    email: c.email,
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
    email: r.email,
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

const SESSION_COOKIE_NAME = 'firetune_session';

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return null;
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim() === 'https';
  }
  return false;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isSecureRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    secure ? 'SameSite=None' : 'SameSite=Lax',
    ...(secure ? ['Secure', 'Partitioned'] : []),
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    ...(secure ? ['Secure', 'Partitioned'] : []),
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function isSameOriginMutation(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  const origin = req.headers.origin;
  if (!origin) return true;
  const hostHeader =
    (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host'].split(',')[0].trim()) ||
    req.headers.host ||
    '';
  if (!hostHeader) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host.toLowerCase() === hostHeader.toLowerCase();
  } catch {
    return false;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : '';
  const cookieToken = parseCookieValue(req.headers.cookie, SESSION_COOKIE_NAME) || '';
  if (!bearerToken && cookieToken && !isSameOriginMutation(req)) {
    res.status(403).json({ error: 'Cross-origin request blocked' });
    return;
  }
  const token = bearerToken || cookieToken;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
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
  app.use(express.json({ limit: '500kb' }));

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

    setSessionCookie(req, res, token);
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
        setSessionCookie(req, res, token);
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
        setSessionCookie(req, res, token);
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

        setSessionCookie(req, res, token);
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

    // Customer login (supports Email ID or Customer ID)
    const loginKey = customId.toLowerCase();
    const customer = store.customers.find(
      (c) =>
        c.customId.toLowerCase() === loginKey ||
        (c.email && c.email.toLowerCase() === loginKey)
    );
    if (!customer) {
      const matchingReq = store.requests.find(
        (r) =>
          (r.customId.toLowerCase() === loginKey ||
            (r.email && r.email.toLowerCase() === loginKey)) &&
          verifyPasswordHash(password, r.passwordHash)
      );
      if (matchingReq?.status === 'pending') {
        res.status(403).json({
          error: 'Your login request is pending Admin approval.',
        });
        return;
      }
      if (matchingReq?.status === 'rejected') {
        res.status(403).json({
          error: matchingReq.rejectionReason
            ? `Your login request was rejected: ${matchingReq.rejectionReason}`
            : 'Your login request was rejected by the administrator.',
        });
        return;
      }
      res.status(401).json({ error: 'Invalid Email / Customer ID or password.' });
      return;
    }

    if (!verifyPasswordHash(password, customer.passwordHash)) {
      res.status(401).json({ error: 'Invalid Email / Customer ID or password.' });
      return;
    }

    if (!customer.active) {
      res.status(403).json({
        error: 'This user account has been suspended by an administrator.',
      });
      return;
    }

    customer.lastLoginAt = new Date().toISOString();
    saveStore(store);

    const token = signSessionToken({
      sub: customer.id,
      role: 'customer',
      customId: customer.customId,
      email: customer.email,
      displayName: customer.displayName,
      assignedDeviceId: customer.assignedDeviceId,
    });

    setSessionCookie(req, res, token);
    res.json({
      token,
      user: {
        id: customer.id,
        role: 'customer',
        customId: customer.customId,
        email: customer.email,
        displayName: customer.displayName,
        assignedDeviceId: customer.assignedDeviceId,
      },
    });
  });

  // Public: User submits a request login with Mail ID (pending Admin accept/reject)
  app.post('/api/auth/request-access', (req, res) => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const customIdInput = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedDeviceId =
      typeof req.body?.requestedDeviceId === 'string' && req.body.requestedDeviceId.trim()
        ? req.body.requestedDeviceId.trim().slice(0, 64)
        : 'samsung-a54';
    const note =
      typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 180) : '';

    if (!isValidEmail(emailRaw)) {
      res.status(400).json({
        error: 'Please enter a valid Email ID (e.g. player@gmail.com).',
      });
      return;
    }

    if (customIdInput && !isValidCustomId(customIdInput)) {
      res.status(400).json({
        error: 'User ID must be 3-32 characters (letters, numbers, ., _, -).',
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
      store.customers.some((c) => c.email && c.email.toLowerCase() === emailRaw)
    ) {
      res.status(409).json({
        error: 'This Email ID is already approved. Sign in on User Login.',
      });
      return;
    }
    if (
      store.requests.some(
        (r) => r.status === 'pending' && r.email && r.email.toLowerCase() === emailRaw
      )
    ) {
      res.status(409).json({
        error: 'A pending login request for this Email ID already exists.',
      });
      return;
    }

    const customId = customIdInput || deriveCustomIdFromEmail(emailRaw, store);
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 48)
        : customId;

    if (
      store.customers.some((c) => c.customId.toLowerCase() === customId.toLowerCase())
    ) {
      res.status(409).json({
        error: 'This User ID is already registered. Choose a different ID.',
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
        error: 'A pending request for this User ID already exists.',
      });
      return;
    }

    const record: CustomerRequestRecord = {
      id: `req-${crypto.randomUUID()}`,
      customId,
      email: emailRaw,
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
      message: 'Request submitted. Once an Admin approves your Mail ID, you can sign in and access the app.',
    });
  });

  // Verify active Bearer or HttpOnly cookie session
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    const freshToken = signSessionToken({
      sub: u.sub,
      role: u.role,
      customId: u.customId,
      email: u.email,
      displayName: u.displayName,
      assignedDeviceId: u.assignedDeviceId,
    });
    setSessionCookie(req, res, freshToken);
    res.json({
      token: freshToken,
      user: {
        id: u.sub,
        role: u.role,
        customId: u.customId,
        email: u.email,
        displayName: u.displayName,
        assignedDeviceId: u.assignedDeviceId,
      },
    });
  });

  // Non-erroring session check for page reload / PWA launch (returns 200 even when signed out)
  app.get('/api/auth/session', (req, res) => {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
    const cookieToken = parseCookieValue(req.headers.cookie, SESSION_COOKIE_NAME) || '';
    const token = bearerToken || cookieToken;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      res.json({ authenticated: false, token: null, user: null });
      return;
    }

    const store = ensureStore();
    if (payload.role === 'customer') {
      const c = store.customers.find((item) => item.id === payload.sub);
      if (!c || !c.active) {
        clearSessionCookie(req, res);
        res.json({ authenticated: false, token: null, user: null });
        return;
      }
    } else if (payload.sub !== 'admin-root') {
      const a = store.admins.find((item) => item.id === payload.sub);
      if (!a || !a.active) {
        clearSessionCookie(req, res);
        res.json({ authenticated: false, token: null, user: null });
        return;
      }
    }

    const freshToken = signSessionToken({
      sub: payload.sub,
      role: payload.role,
      customId: payload.customId,
      email: payload.email,
      displayName: payload.displayName,
      assignedDeviceId: payload.assignedDeviceId,
    });
    setSessionCookie(req, res, freshToken);
    res.json({
      authenticated: true,
      token: freshToken,
      user: {
        id: payload.sub,
        role: payload.role,
        customId: payload.customId,
        email: payload.email,
        displayName: payload.displayName,
        assignedDeviceId: payload.assignedDeviceId,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ loggedOut: true });
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
            (c) =>
              c.customId.toLowerCase() === target.customId.toLowerCase() ||
              (target.email && c.email && c.email.toLowerCase() === target.email.toLowerCase())
          )
        ) {
          res.status(409).json({
            error: 'A user with this Email ID or Custom ID already exists.',
          });
          return;
        }

        const newCustomer: CustomerRecord = {
          id: `cust-${crypto.randomUUID()}`,
          customId: target.customId,
          email: target.email,
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

  // Admin-only: Create Customer ID/Email & Password
  app.post('/api/admin/customers', requireAuth, requireAdmin, (req, res) => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const customIdInput = typeof req.body?.customId === 'string' ? req.body.customId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const assignedDeviceId =
      typeof req.body?.assignedDeviceId === 'string' && req.body.assignedDeviceId.trim()
        ? req.body.assignedDeviceId.trim().slice(0, 64)
        : 'samsung-a54';

    if (emailRaw && !isValidEmail(emailRaw)) {
      res.status(400).json({
        error: 'Please enter a valid Email ID.',
      });
      return;
    }

    const store = ensureStore();
    const customId = customIdInput || (emailRaw ? deriveCustomIdFromEmail(emailRaw, store) : '');
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 48)
        : customId;

    if (!isValidCustomId(customId)) {
      res.status(400).json({
        error: 'User ID must be 3-32 characters (letters, numbers, ., _, -).',
      });
      return;
    }

    if (password.length < 4 || password.length > 128) {
      res.status(400).json({
        error: 'Password must be between 4 and 128 characters.',
      });
      return;
    }

    if (
      store.customers.some((c) => c.customId.toLowerCase() === customId.toLowerCase()) ||
      (emailRaw && store.customers.some((c) => c.email && c.email.toLowerCase() === emailRaw))
    ) {
      res.status(409).json({ error: 'A user with this Email ID or Custom ID already exists.' });
      return;
    }

    const record: CustomerRecord = {
      id: `cust-${crypto.randomUUID()}`,
      customId,
      email: emailRaw || undefined,
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

        setSessionCookie(req, res, token);
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

      setSessionCookie(req, res, token);
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
      clearSessionCookie(req, res);
      res.json({ reset: true });
    }
  );

  // Public read: Master Device Catalog Overrides (edited / added / removed entries)
  app.get('/api/catalog/overrides', (_req, res) => {
    const overrides = readCatalogStore();
    res.json(overrides);
  });

  // Admin-only: Add or Edit a single Device Sensitivity entry in Master Catalog
  app.post('/api/admin/catalog/devices', requireAuth, requireAdmin, (req, res) => {
    const rawDevice = req.body?.device ?? req.body;
    const validated = sanitizeAndValidateDeviceSpec(rawDevice);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const device = validated.device;
    const catalog = readCatalogStore();
    const existingIdx = catalog.upsertedDevices.findIndex((d) => d.id === device.id);
    if (existingIdx >= 0) {
      catalog.upsertedDevices[existingIdx] = device;
    } else {
      catalog.upsertedDevices.unshift(device);
    }
    catalog.removedIds = catalog.removedIds.filter((rid) => rid !== device.id);
    saveCatalogStore(catalog);

    res.status(existingIdx >= 0 ? 200 : 201).json({
      device,
      overrides: catalog,
    });
  });

  // Admin-only: Bulk Add or Update Device Sensitivity entries in Master Catalog
  app.post('/api/admin/catalog/bulk', requireAuth, requireAdmin, (req, res) => {
    const items = Array.isArray(req.body?.devices) ? req.body.devices : null;
    if (!items || items.length === 0) {
      res.status(400).json({ error: 'Provide a non-empty array of devices to bulk import.' });
      return;
    }
    if (items.length > 200) {
      res.status(400).json({ error: 'Bulk import is limited to 200 devices per request.' });
      return;
    }

    const validatedDevices: DeviceSpecRecord[] = [];
    for (let i = 0; i < items.length; i++) {
      const check = sanitizeAndValidateDeviceSpec(items[i]);
      if (!check.ok) {
        res.status(400).json({ error: `Row ${i + 1}: ${check.error}` });
        return;
      }
      validatedDevices.push(check.device);
    }

    const catalog = readCatalogStore();
    const incomingIds = new Set(validatedDevices.map((d) => d.id));
    catalog.removedIds = catalog.removedIds.filter((rid) => !incomingIds.has(rid));

    for (const dev of validatedDevices) {
      const idx = catalog.upsertedDevices.findIndex((d) => d.id === dev.id);
      if (idx >= 0) {
        catalog.upsertedDevices[idx] = dev;
      } else {
        catalog.upsertedDevices.unshift(dev);
      }
    }

    saveCatalogStore(catalog);
    res.status(201).json({
      count: validatedDevices.length,
      devices: validatedDevices,
      overrides: catalog,
    });
  });

  // Admin-only: Remove a device entry from Master Catalog (built-in or admin-added)
  app.delete('/api/admin/catalog/devices/:id', requireAuth, requireAdmin, (req, res) => {
    const rawId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!DEVICE_ID_REGEX.test(rawId)) {
      res.status(400).json({ error: 'Invalid device ID.' });
      return;
    }

    const catalog = readCatalogStore();
    catalog.upsertedDevices = catalog.upsertedDevices.filter((d) => d.id !== rawId);
    if (!catalog.removedIds.includes(rawId)) {
      catalog.removedIds.push(rawId);
    }
    saveCatalogStore(catalog);

    res.json({ removedId: rawId, overrides: catalog });
  });

  // Admin-only: Restore removed built-in devices or reset all catalog customizations
  app.post('/api/admin/catalog/restore', requireAuth, requireAdmin, (req, res) => {
    const mode = req.body?.mode === 'removed' ? 'removed' : 'all';
    const catalog = readCatalogStore();
    if (mode === 'removed') {
      catalog.removedIds = [];
    } else {
      catalog.upsertedDevices = [];
      catalog.removedIds = [];
    }
    saveCatalogStore(catalog);
    res.json({ overrides: catalog });
  });

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
