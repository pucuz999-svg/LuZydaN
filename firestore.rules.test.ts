/**
 * Phase 0 Payload-First Security Test Cases for Firestore Security Rules.
 * Run against Firebase Firestore Emulator with @firebase/rules-unit-testing when available.
 */
export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: {
    uid: string;
    email: string;
    emailVerified: boolean;
  };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Self-Approval on Signup',
    collection: '/users/user_1',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { uid: 'user_1', email: 'player@gmail.com', status: 'approved', role: 'user' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Admin Role Escalation',
    collection: '/users/user_1',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { uid: 'user_1', email: 'player@gmail.com', status: 'pending', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'UID Spoofing on Create',
    collection: '/users/user_2',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { uid: 'user_2', email: 'player@gmail.com', status: 'pending', role: 'user' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Admin Email Spoof',
    collection: '/users',
    operation: 'list',
    actor: { uid: 'attacker_1', email: 'pucuz999@gmail.com', emailVerified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Status Escalation Update',
    collection: '/users/user_1',
    operation: 'update',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    collection: '/users/user_1',
    operation: 'update',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { isSuperAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client Timestamp Backdating',
    collection: '/users/user_1',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { uid: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-User PII Read',
    collection: '/users/user_2',
    operation: 'get',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Cross-User Activity Forgery',
    collection: '/activityLogs/log_1',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { userId: 'user_2', action: 'login', details: 'Forged login' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Admin Action Log Spoofing',
    collection: '/activityLogs/log_2',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { userId: 'user_1', action: 'admin_approve_user', details: 'Fake approve' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Activity Log Tampering',
    collection: '/activityLogs/log_1',
    operation: 'delete',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-Admin Catalog Poisoning',
    collection: '/catalogDevices/samsung_a54',
    operation: 'create',
    actor: { uid: 'user_1', email: 'player@gmail.com', emailVerified: true },
    payload: { id: 'samsung_a54', brand: 'Fake', model: 'Hack' },
    expected: 'PERMISSION_DENIED',
  },
];
