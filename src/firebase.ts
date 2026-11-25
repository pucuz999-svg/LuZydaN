import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  FirebaseUserProfile,
  UserActionType,
  UserApprovalStatus,
} from './types';

export const ADMIN_EMAIL = 'pucuz999@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function formatTimestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === 'function') {
      return fn().toISOString();
    }
  }
  if (typeof value === 'string') return value;
  return null;
}

export function mapUserDoc(
  uid: string,
  data: Record<string, unknown>
): FirebaseUserProfile {
  const rawStatus = data.status;
  const status: UserApprovalStatus =
    rawStatus === 'approved' || rawStatus === 'blocked' || rawStatus === 'pending'
      ? rawStatus
      : 'pending';
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Player',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
    status,
    role: data.role === 'admin' ? 'admin' : 'user',
    requestedDeviceId:
      typeof data.requestedDeviceId === 'string' && data.requestedDeviceId
        ? data.requestedDeviceId
        : 'samsung-a54',
    createdAt: formatTimestampToIso(data.createdAt),
    lastLoginAt: formatTimestampToIso(data.lastLoginAt),
    updatedAt: formatTimestampToIso(data.updatedAt),
  };
}

function buildSafeDisplayName(user: User): string {
  const candidate =
    (user.displayName || '').trim() ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Player';
  return candidate.slice(0, 100);
}

function generateLogId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 12);
  return `log_${Date.now()}_${rand}`;
}

export async function logUserAction(
  user: User,
  action: UserActionType,
  details: string
): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const logId = generateLogId();
  const path = `activityLogs/${logId}`;
  try {
    await setDoc(doc(db, 'activityLogs', logId), {
      userId: user.uid,
      userEmail: user.email,
      userDisplayName: buildSafeDisplayName(user),
      action,
      details: details.trim().slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncUserOnSignIn(
  user: User,
  preferredDeviceId = 'samsung-a54'
): Promise<FirebaseUserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeName = buildSafeDisplayName(user);
  const safePhoto = (user.photoURL || '').trim().slice(0, 500);
  const safeDevice = (preferredDeviceId || 'samsung-a54').trim().slice(0, 64) || 'samsung-a54';
  const admin = isAdminUser(user);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!existingSnap.exists()) {
    const initialStatus: UserApprovalStatus = admin ? 'approved' : 'pending';
    const initialRole = admin ? 'admin' : 'user';
    try {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: safeName,
        photoURL: safePhoto,
        status: initialStatus,
        role: initialRole,
        requestedDeviceId: safeDevice,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    await logUserAction(
      user,
      'signup',
      admin
        ? `Admin account registered (${user.email})`
        : `Signed up with status 'pending' (device: ${safeDevice})`
    );

    try {
      const freshSnap = await getDoc(userRef);
      if (freshSnap.exists()) {
        return mapUserDoc(user.uid, freshSnap.data() as Record<string, unknown>);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: safeName,
      photoURL: safePhoto,
      status: initialStatus,
      role: initialRole,
      requestedDeviceId: safeDevice,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const current = mapUserDoc(user.uid, existingSnap.data() as Record<string, unknown>);

  try {
    await updateDoc(userRef, {
      displayName: safeName,
      photoURL: safePhoto,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(admin && (current.status !== 'approved' || current.role !== 'admin')
        ? { status: 'approved', role: 'admin' }
        : {}),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  await logUserAction(
    user,
    'login',
    `Signed in (${admin ? 'admin' : current.status})`
  );

  try {
    const updatedSnap = await getDoc(userRef);
    if (updatedSnap.exists()) {
      return mapUserDoc(user.uid, updatedSnap.data() as Record<string, unknown>);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  return current;
}

export async function signInWithGoogle(
  preferredDeviceId = 'samsung-a54'
): Promise<{ user: User; profile: FirebaseUserProfile }> {
  const credential = await signInWithPopup(auth, googleProvider);
  const profile = await syncUserOnSignIn(credential.user, preferredDeviceId);
  return { user: credential.user, profile };
}

export async function signOutFirebase(user: User | null): Promise<void> {
  if (user) {
    try {
      await logUserAction(user, 'logout', 'Signed out of FF TUNE');
    } catch {
      // Do not block sign out if user profile is missing or offline
    }
  }
  await signOut(auth);
}
