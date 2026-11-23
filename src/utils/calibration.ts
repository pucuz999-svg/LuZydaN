import {
  CalibrationOutput,
  DeviceSpec,
  GripType,
  OptimizationStep,
  PlaystyleId,
  RangeBias,
  SensitivityValues,
} from '../types';

const clamp = (value: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, value)));

/**
 * Computes Free Fire OB44+ (0-200 scale) sensitivity, DPI, fire button size,
 * and hardware-safe graphics presets tailored to the selected device specs.
 */
export function calculateCalibration(
  device: DeviceSpec,
  playstyle: PlaystyleId,
  grip: GripType,
  rangeBias: RangeBias
): CalibrationOutput {
  // Base 0-200 values scaled to screen responsiveness & hardware class
  const isIos = device.os === 'iOS';
  const lowEndBonus = device.ramGb <= 3 ? 12 : device.ramGb <= 4 ? 6 : 0;
  const highTouchDamping =
    device.touchSamplingHz >= 480 ? -8 : device.touchSamplingHz >= 240 ? -3 : 4;
  const largeScreenScale = device.screenInches >= 8.0 ? -10 : device.screenInches <= 6.2 ? 4 : 0;
  const iosOffset = isIos ? -6 : 0;

  let baseGeneral = 178;
  let baseRedDot = 166;
  let base2x = 148;
  let base4x = 132;
  let baseSniper = 88;
  let baseFreeLook = 152;
  let fireSize = 48;

  switch (playstyle) {
    case 'one-tap':
      baseGeneral = 192;
      baseRedDot = 182;
      base2x = 154;
      base4x = 136;
      baseSniper = 95;
      baseFreeLook = 165;
      fireSize = 45;
      break;
    case 'smg-drag':
      baseGeneral = 184;
      baseRedDot = 172;
      base2x = 160;
      base4x = 140;
      baseSniper = 82;
      baseFreeLook = 158;
      fireSize = 51;
      break;
    case 'balanced':
      baseGeneral = 174;
      baseRedDot = 162;
      base2x = 146;
      base4x = 130;
      baseSniper = 86;
      baseFreeLook = 148;
      fireSize = 50;
      break;
    case 'full-rush':
      baseGeneral = 198;
      baseRedDot = 186;
      base2x = 164;
      base4x = 144;
      baseSniper = 90;
      baseFreeLook = 185;
      fireSize = 44;
      break;
  }

  // Grip adjustments
  if (grip === '3-finger') {
    fireSize -= 2;
    baseGeneral += 2;
  } else if (grip === '4-finger') {
    fireSize -= 4;
    baseGeneral += 4;
    baseFreeLook += 8;
  }

  // Range adjustments
  if (rangeBias === 'close') {
    baseGeneral += 4;
    baseRedDot += 6;
    base4x -= 6;
  } else if (rangeBias === 'long') {
    baseGeneral -= 6;
    baseRedDot -= 4;
    base2x += 6;
    base4x += 10;
    baseSniper += 10;
    fireSize += 3;
  }

  let sensitivity: SensitivityValues;
  let clampedFireSize: number;

  if (device.presetSensitivity) {
    // Start from the device's verified Scribd-style baseline and apply playstyle/grip/range offsets
    const psDelta =
      playstyle === 'one-tap'
        ? { g: 8, r: 8, s2: 4, s4: 3, sn: 4, fl: 14, fb: -1 }
        : playstyle === 'smg-drag'
          ? { g: 3, r: 4, s2: 8, s4: 5, sn: -2, fl: 8, fb: 2 }
          : playstyle === 'full-rush'
            ? { g: 12, r: 10, s2: 10, s4: 6, sn: 2, fl: 28, fb: -2 }
            : { g: 0, r: 0, s2: 0, s4: 0, sn: 0, fl: 0, fb: 0 };

    const gripDelta =
      grip === '3-finger'
        ? { g: 2, fl: 4, fb: -1 }
        : grip === '4-finger'
          ? { g: 4, fl: 10, fb: -3 }
          : { g: 0, fl: 0, fb: 0 };

    const rangeDelta =
      rangeBias === 'close'
        ? { g: 4, r: 5, s2: 0, s4: -4, sn: 0, fb: 0 }
        : rangeBias === 'long'
          ? { g: -5, r: -4, s2: 5, s4: 8, sn: 8, fb: 2 }
          : { g: 0, r: 0, s2: 0, s4: 0, sn: 0, fb: 0 };

    sensitivity = {
      general: clamp(device.presetSensitivity.general + psDelta.g + gripDelta.g + rangeDelta.g, 120, 200),
      redDot: clamp(device.presetSensitivity.redDot + psDelta.r + rangeDelta.r, 110, 200),
      scope2x: clamp(device.presetSensitivity.scope2x + psDelta.s2 + rangeDelta.s2, 95, 195),
      scope4x: clamp(device.presetSensitivity.scope4x + psDelta.s4 + rangeDelta.s4, 85, 185),
      sniperScope: clamp(device.presetSensitivity.sniperScope + psDelta.sn + rangeDelta.sn, 50, 145),
      freeLook: clamp(device.presetSensitivity.freeLook + psDelta.fl + gripDelta.fl, 70, 200),
    };

    clampedFireSize = clamp(
      (device.presetFireButton ?? 46) + psDelta.fb + gripDelta.fb + rangeDelta.fb,
      38,
      62
    );
  } else {
    sensitivity = {
      general: clamp(
        baseGeneral + lowEndBonus + highTouchDamping + largeScreenScale + iosOffset,
        120,
        200
      ),
      redDot: clamp(
        baseRedDot + lowEndBonus + highTouchDamping + largeScreenScale + iosOffset,
        110,
        200
      ),
      scope2x: clamp(base2x + Math.round(lowEndBonus * 0.6) + iosOffset, 95, 195),
      scope4x: clamp(base4x + Math.round(lowEndBonus * 0.5) + iosOffset, 85, 185),
      sniperScope: clamp(baseSniper + (rangeBias === 'long' ? 8 : 0), 50, 145),
      freeLook: clamp(baseFreeLook + (grip === '4-finger' ? 10 : 0), 90, 200),
    };

    clampedFireSize = clamp(
      fireSize + (device.screenInches >= 8.0 ? -4 : device.screenInches <= 6.2 ? 3 : 0),
      38,
      62
    );
  }

  // DPI calculation
  let dpiValue = device.recommendedDpi;
  let dpiLabel = 'Android Smallest Width (DPI)';
  let dpiSafeRange = `${Math.max(360, device.defaultDpi + 40)}–${Math.min(620, device.recommendedDpi + 60)} dp`;
  let pointerSpeed = '75% (2 ticks below max)';

  if (isIos) {
    dpiLabel = 'iOS Gliding Cursor Speed';
    dpiSafeRange = '105–120 (Refined Mode)';
    dpiValue = playstyle === 'one-tap' || playstyle === 'full-rush' ? 120 : 114;
    pointerSpeed = 'Tracking Speed: 80% · AssistiveTouch Idle Opacity 15%';
  } else {
    if (playstyle === 'one-tap' || playstyle === 'full-rush') {
      dpiValue = Math.min(620, device.recommendedDpi + 25);
    } else if (playstyle === 'balanced') {
      dpiValue = Math.max(device.defaultDpi + 40, device.recommendedDpi - 15);
    }
    if (device.touchSamplingHz >= 480) {
      pointerSpeed = '65% (Balanced for high-Hz digitizer)';
    } else if (device.ramGb <= 3) {
      pointerSpeed = '100% (Max Pointer Speed to compensate 120Hz touch)';
    }
  }

  // Graphics & thermal headroom calibration
  let graphics: CalibrationOutput['graphics'];
  if (device.ramGb <= 3 || device.tier === 'low') {
    graphics = {
      display: 'Smooth',
      highFps: device.refreshHz >= 90 ? 'High' : 'Normal',
      shadow: 'Off',
      highRes: 'Normal',
      filter: 'Classic',
      autoScale: 'Off',
      targetFps: device.refreshHz >= 90 ? 60 : 45,
      thermalNote:
        'Smooth graphics eliminates shader stalls on 2-3GB RAM and keeps frame times steady during final zones.',
    };
  } else if (device.tier === 'mid' || device.ramGb <= 6) {
    graphics = {
      display: 'Standard',
      highFps: 'High',
      shadow: 'Off',
      highRes: 'Normal',
      filter: 'Bright',
      autoScale: 'Off',
      targetFps: 60,
      thermalNote:
        'Standard + High FPS delivers locked 60 FPS with shadows disabled to prevent mid-range SoC thermal throttling.',
    };
  } else {
    graphics = {
      display: device.thermalHeadroom === 'High' ? 'Ultra' : 'Standard',
      highFps: 'High',
      shadow: device.tier === 'gaming' ? 'On' : 'Off',
      highRes: device.thermalHeadroom === 'High' ? 'High' : 'Normal',
      filter: 'Bright',
      autoScale: 'Off',
      targetFps: device.refreshHz >= 90 ? 90 : 60,
      thermalNote:
        device.tier === 'gaming'
          ? 'Active cooling / vapor-chamber headroom supports Ultra + High FPS without dropping frames.'
          : 'Keeping Shadows Off prevents GPU thermal throttling after 20+ minutes of ranked matches.',
    };
  }

  const dragGuidance = {
    preferredPattern:
      playstyle === 'one-tap'
        ? 'Fast J-Drag or Straight Snap (short 35-45% upward swipe)'
        : playstyle === 'smg-drag'
          ? 'Controlled Vertical Lift (steady upward pull matching fire rate)'
          : playstyle === 'full-rush'
            ? 'Rotation Drag (wide C-arc sweep for sub-8m encounters)'
            : 'Straight Vertical Drag (aim chest-level, lift smoothly to crown)',
    swipeSpeed:
      device.touchSamplingHz >= 360
        ? 'Moderate-Fast · Avoid over-flicking on high touch-sampling glass'
        : 'Crisp & Decisive · Complete upward flick in ~140-180ms',
    fireButtonAnchor:
      grip === '2-finger'
        ? 'Lower-right quadrant with 15-18% upward drag clearance above button'
        : 'Lower-right mid zone leaving room for quick crouch-gloo thumb sweep',
  };

  return {
    sensitivity,
    fireButtonSize: clampedFireSize,
    dpiLabel,
    dpiValue,
    dpiSafeRange,
    pointerSpeed,
    graphics,
    dragGuidance,
  };
}

export function buildOptimizationChecklist(device: DeviceSpec): OptimizationStep[] {
  const isIos = device.os === 'iOS';
  const steps: OptimizationStep[] = [
    {
      id: 'ingame-fps',
      category: 'In-Game Options',
      title: 'Lock High FPS & Disable Shadows',
      settingValue: device.ramGb <= 3 ? 'Smooth + High FPS (Shadows Off)' : 'Standard/Ultra + High FPS (Shadows Off)',
      impact: 'High',
      description:
        'Dynamic shadows consume up to 22% of mobile GPU shader time. Turning Shadows Off stabilizes frame pacing when multiple Gloo Walls and smoke effects render simultaneously.',
      osScope: 'All',
    },
    {
      id: 'ingame-autoscale',
      category: 'In-Game Options',
      title: 'Turn Auto Scale Off',
      settingValue: 'Display > Auto Scale: Off',
      impact: 'Medium',
      description:
        'Auto Scale dynamically shifts internal render resolution mid-fight, causing inconsistent drag distance. Keeping it Off guarantees predictable pixel-to-angle tracking.',
      osScope: 'All',
    },
    {
      id: 'ingame-damage',
      category: 'In-Game Options',
      title: 'Switch Damage Indicator to Classic / New Minimal',
      settingValue: 'Controls > Hit Marker: Classic · Visual Effects: Dark/No Blood',
      impact: 'Medium',
      description:
        'Reduces translucent overdraw around the enemy head hitbox so you can clearly read chest-to-head crosshair elevation during rapid sprays.',
      osScope: 'All',
    },
  ];

  if (!isIos) {
    steps.push(
      {
        id: 'android-dpi',
        category: 'Display & Touch',
        title: 'Set Developer Options Smallest Width (DPI)',
        settingValue: `${device.recommendedDpi} dp (Default: ${device.defaultDpi} dp)`,
        impact: 'High',
        description:
          'Increases angular camera speed per millimeter of thumb travel for easier drag headshots. Stay below 620 dp to avoid shrinking Android system bars.',
        osScope: 'Android',
      },
      {
        id: 'android-animations',
        category: 'Display & Touch',
        title: 'Reduce System Animation Scales to 0.5x',
        settingValue: 'Window / Transition / Animator Scale: 0.5x',
        impact: 'Medium',
        description:
          'Cuts UI transition overhead when switching back into Free Fire and keeps system composer responsiveness snappy.',
        osScope: 'Android',
      },
      {
        id: 'android-refresh',
        category: 'Display & Touch',
        title: 'Lock Display Refresh Rate',
        settingValue: `${device.refreshHz} Hz Fixed (Disable Adaptive Battery Saver)`,
        impact: 'High',
        description:
          'Adaptive refresh profiles can drop screens down to 60 Hz when battery falls below 30%. Lock highest stable refresh rate before ranked sessions.',
        osScope: 'Android',
      },
      {
        id: 'android-bg',
        category: 'Memory & CPU',
        title: 'Cap Background Processes & Clear Heavy Apps',
        settingValue:
          device.ramGb <= 4
            ? 'Background Process Limit: At most 2 processes'
            : 'Lock Free Fire in Recents + Clear Social/Browser Tabs',
        impact: 'High',
        description:
          device.ramGb <= 4
            ? 'On 2–4GB RAM devices, background social apps trigger OS memory compression (zRAM) which creates 100ms+ micro-stutters during gunfights.'
            : 'Prevents background indexing or cloud backups from competing for big-core CPU scheduler time.',
        osScope: 'Android',
      },
      {
        id: 'android-thermal',
        category: 'Thermal & Battery',
        title: 'Enable Game Turbo / Bypass Charging Rules',
        settingValue: 'Disable 4x MSAA · Unplug Charger Above 80% · Remove Thick Case',
        impact: 'High',
        description:
          'Forcing 4x MSAA in Developer Options destroys frame rates. Playing while fast-charging adds battery heat, triggering SoC thermal throttling below 45 FPS.',
        osScope: 'Android',
      },
      {
        id: 'android-notification-block',
        category: 'Memory & CPU',
        title: 'Enable Notification Block & Do Not Disturb',
        settingValue: 'DND Gaming Mode: Block Heads-Up, Calls & Floating Bubbles',
        impact: 'High',
        description:
          'Heads-up WhatsApp/Messenger banners and floating chat bubbles trigger GPU compositing spikes and interrupt upward drag swipes during close-range duels.',
        osScope: 'Android',
      }
    );

    if (device.brand === 'Motorola') {
      steps.push({
        id: 'moto-gametime',
        category: 'Display & Touch',
        title: 'Activate Moto Gametime Performance & Touch Boost',
        settingValue: `Moto Gametime: Performance Mode · Refresh Rate ${device.refreshHz} Hz`,
        impact: 'High',
        description:
          'Open Moto Gametime while in Free Fire to block swipe gestures/notifications, lock display refresh rate, and prioritize digitizer touch polling.',
        osScope: 'Android',
      });
    }
  } else {
    steps.push(
      {
        id: 'ios-cursor',
        category: 'Display & Touch',
        title: 'Tune Switch Control Gliding Cursor (iOS DPI)',
        settingValue: 'Refined Mode · Speed 114–120',
        impact: 'High',
        description:
          'Settings > Accessibility > Switch Control > Gliding Cursor > Refined. Fine-tunes touch micro-tracking responsiveness without needing jailbreak tweaks.',
        osScope: 'iOS',
      },
      {
        id: 'ios-reduce-motion',
        category: 'Display & Touch',
        title: 'Enable Reduce Motion & Disable Background Refresh',
        settingValue: 'Accessibility > Motion: Reduce Motion On · Background App Refresh: Off',
        impact: 'Medium',
        description:
          'Frees GPU bandwidth and prevents background app wakes during Clash Squad rounds.',
        osScope: 'iOS',
      },
      {
        id: 'ios-lowpower',
        category: 'Thermal & Battery',
        title: 'Keep Low Power Mode Off & Enable iOS Game Mode',
        settingValue: 'Low Power Mode: Off · Game Mode: Active',
        impact: 'High',
        description:
          'Low Power Mode caps ProMotion displays at 60 Hz and throttles A-series performance cores. iOS Game Mode minimizes Bluetooth audio latency and background activity.',
        osScope: 'iOS',
      },
      {
        id: 'ios-focus-block',
        category: 'Memory & CPU',
        title: 'Activate Gaming Focus (Notification Block)',
        settingValue: 'Focus Mode: Gaming · Silence Banners & Calls',
        impact: 'High',
        description:
          'Prevents notification banners and incoming call overlays from stealing screen touches or dropping frames during ranked fights.',
        osScope: 'iOS',
      }
    );
  }

  return steps;
}

export function formatSetupAsText(
  device: DeviceSpec,
  calibration: CalibrationOutput,
  playstyleName: string,
  grip: GripType
): string {
  return [
    `FireTune Calibration — ${device.brand} ${device.model}`,
    `Hardware: ${device.ramGb}GB RAM · ${device.refreshHz}Hz · ${device.chipset}`,
    `Profile: ${playstyleName} · Grip: ${grip}`,
    ``,
    `[Sensitivity (0-200 Scale)]`,
    `General: ${calibration.sensitivity.general}`,
    `Red Dot: ${calibration.sensitivity.redDot}`,
    `2x Scope: ${calibration.sensitivity.scope2x}`,
    `4x Scope: ${calibration.sensitivity.scope4x}`,
    `Sniper Scope: ${calibration.sensitivity.sniperScope}`,
    `Free Look: ${calibration.sensitivity.freeLook}`,
    ``,
    `[Controls & Hardware]`,
    `Fire Button Size: ${calibration.fireButtonSize}%`,
    `${calibration.dpiLabel}: ${calibration.dpiValue} (${calibration.dpiSafeRange})`,
    `Pointer Speed: ${calibration.pointerSpeed}`,
    ``,
    `[In-Game Graphics]`,
    `Display: ${calibration.graphics.display} · High FPS: ${calibration.graphics.highFps} · Shadow: ${calibration.graphics.shadow} · Auto Scale: ${calibration.graphics.autoScale}`,
  ].join('\n');
}
