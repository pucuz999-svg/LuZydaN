export type DeviceTier = 'low' | 'mid' | 'high' | 'gaming' | 'ios';
export type OperatingSystem = 'Android' | 'iOS';
export type PlaystyleId = 'one-tap' | 'smg-drag' | 'balanced' | 'full-rush';
export type GripType = '2-finger' | '3-finger' | '4-finger';
export type RangeBias = 'close' | 'mid' | 'long';

export interface DeviceSpec {
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
  presetSensitivity?: SensitivityValues;
  presetFireButton?: number;
  isCustom?: boolean;
}

export interface SensitivityValues {
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  sniperScope: number;
  freeLook: number;
}

export interface CalibrationOutput {
  sensitivity: SensitivityValues;
  fireButtonSize: number;
  dpiLabel: string;
  dpiValue: number;
  dpiSafeRange: string;
  pointerSpeed: string;
  graphics: {
    display: 'Smooth' | 'Standard' | 'Ultra' | 'Max';
    highFps: 'Normal' | 'High';
    shadow: 'Off' | 'On';
    highRes: 'Normal' | 'High';
    filter: 'Classic' | 'Bright' | 'Vivid';
    autoScale: 'Off' | 'On';
    targetFps: number;
    thermalNote: string;
  };
  dragGuidance: {
    preferredPattern: string;
    swipeSpeed: string;
    fireButtonAnchor: string;
  };
}

export interface OptimizationStep {
  id: string;
  category: 'Display & Touch' | 'Memory & CPU' | 'Thermal & Battery' | 'In-Game Options';
  title: string;
  settingValue: string;
  impact: 'High' | 'Medium';
  description: string;
  osScope: 'All' | 'Android' | 'iOS';
}

export interface SavedProfile {
  id: string;
  name: string;
  createdAt: string;
  deviceId: string;
  deviceLabel: string;
  os: OperatingSystem;
  ramGb: number;
  refreshHz: number;
  playstyle: PlaystyleId;
  grip: GripType;
  rangeBias: RangeBias;
  sensitivity: SensitivityValues;
  fireButtonSize: number;
  dpiValue: number;
  dpiLabel: string;
  graphicsDisplay: string;
  highFps: string;
  notes: string;
}

export type UserRole = 'admin' | 'customer';

export interface AuthUser {
  id: string;
  role: UserRole;
  customId: string;
  email?: string;
  displayName: string;
  assignedDeviceId?: string;
}

export interface CustomerAccount {
  id: string;
  customId: string;
  email?: string;
  displayName: string;
  assignedDeviceId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminAccount {
  id: string;
  customId: string;
  displayName: string;
  active: boolean;
  fullAccess: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthStatus {
  adminConfigured: boolean;
  envOverrideActive: boolean;
  customerCount: number;
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface CustomerRequest {
  id: string;
  customId: string;
  email?: string;
  displayName: string;
  requestedDeviceId: string;
  note: string;
  status: RequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason?: string;
}

export interface NotificationBlockSettings {
  enabled: boolean;
  blockHeadsUp: boolean;
  blockCalls: boolean;
  blockFloatingBubbles: boolean;
  muteInAppAlerts: boolean;
}

export interface CatalogOverrides {
  upsertedDevices: DeviceSpec[];
  removedIds: string[];
}

export type UserApprovalStatus = 'pending' | 'approved' | 'blocked';

export type UserActionType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'view_tab'
  | 'select_device'
  | 'update_sensitivity'
  | 'save_preset'
  | 'delete_preset'
  | 'apply_launch'
  | 'toggle_optimization'
  | 'practice_drag'
  | 'admin_approve_user'
  | 'admin_block_user';

export interface FirebaseUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: UserApprovalStatus;
  role: UserRole | 'user';
  requestedDeviceId: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  updatedAt: string | null;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  action: UserActionType;
  details: string;
  createdAt: string | null;
}
