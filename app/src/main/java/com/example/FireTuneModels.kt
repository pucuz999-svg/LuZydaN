package com.example

import android.app.ActivityManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

enum class DeviceTier(val label: String) {
  LOW("2-3GB Budget"),
  MID("4-6GB Mid"),
  HIGH("Flagship"),
  GAMING("Gaming"),
  IOS("iPhone / iPad"),
}

enum class OperatingSystem(val label: String) {
  ANDROID("Android"),
  IOS("iOS"),
}

enum class PlaystyleId(val title: String, val weapons: String, val summary: String) {
  ONE_TAP(
    "One-Tap Precision",
    "Desert Eagle · M1887 · Woodpecker",
    "High General & Red Dot velocity with a compact fire button for crisp upward J-drag and straight snap headshots.",
  ),
  SMG_DRAG(
    "SMG Drag Spray",
    "MP40 · UMP · Thompson",
    "Controlled chest-to-head vertical tracking tuned for rapid SMG fire rates without overshooting the head hitbox.",
  ),
  BALANCED(
    "Balanced All-Rounder",
    "SCAR · AK47 · MP5 · M1014",
    "Consistent sensitivity curve across close and mid-range engagements for reliable ranked BR & Clash Squad stability.",
  ),
  FULL_RUSH(
    "Full Rush & 360° Gloo",
    "M1887 · MP40 · MAC10",
    "Maximum camera sweep and Free Look speed for aggressive close-quarters rotation drags and fast sit-up gloo walls.",
  ),
}

enum class GripType(val label: String) {
  TWO_FINGER("2-Finger"),
  THREE_FINGER("3-Finger Claw"),
  FOUR_FINGER("4-Finger Claw"),
}

enum class RangeBias(val label: String) {
  CLOSE("Close (<15m)"),
  MID("Mid (15-35m)"),
  LONG("Long (35m+)"),
}

data class SensitivityValues(
  val general: Int,
  val redDot: Int,
  val scope2x: Int,
  val scope4x: Int,
  val sniperScope: Int,
  val freeLook: Int,
)

data class DeviceSpec(
  val id: String,
  val brand: String,
  val model: String,
  val tier: DeviceTier,
  val os: OperatingSystem,
  val ramGb: Int,
  val refreshHz: Int,
  val touchSamplingHz: Int,
  val screenInches: Double,
  val chipset: String,
  val defaultDpi: Int,
  val recommendedDpi: Int,
  val thermalHeadroom: String,
  val presetSensitivity: SensitivityValues? = null,
  val presetFireButton: Int? = null,
  val isCustom: Boolean = false,
)

data class GraphicsTarget(
  val display: String,
  val highFps: String,
  val shadow: String,
  val highRes: String,
  val filter: String,
  val autoScale: String,
  val targetFps: Int,
  val thermalNote: String,
)

data class DragGuidance(
  val preferredPattern: String,
  val swipeSpeed: String,
  val fireButtonAnchor: String,
)

data class CalibrationOutput(
  val sensitivity: SensitivityValues,
  val fireButtonSize: Int,
  val dpiLabel: String,
  val dpiValue: Int,
  val dpiSafeRange: String,
  val pointerSpeed: String,
  val graphics: GraphicsTarget,
  val dragGuidance: DragGuidance,
)

data class OptimizationStep(
  val id: String,
  val category: String,
  val title: String,
  val settingValue: String,
  val impact: String,
  val description: String,
)

data class SavedProfile(
  val id: String,
  val name: String,
  val createdAt: String,
  val deviceId: String,
  val deviceLabel: String,
  val os: OperatingSystem,
  val ramGb: Int,
  val refreshHz: Int,
  val playstyle: PlaystyleId,
  val grip: GripType,
  val rangeBias: RangeBias,
  val sensitivity: SensitivityValues,
  val fireButtonSize: Int,
  val dpiValue: Int,
  val dpiLabel: String,
  val graphicsDisplay: String,
  val highFps: String,
)

data class NotificationBlockSettings(
  val enabled: Boolean = true,
  val blockHeadsUp: Boolean = true,
  val blockCalls: Boolean = true,
  val blockFloatingBubbles: Boolean = true,
  val muteInAppAlerts: Boolean = false,
)

val DEVICE_CATALOG: List<DeviceSpec> = listOf(
  DeviceSpec(
    id = "moto-g54",
    brand = "Motorola",
    model = "Moto G54 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "MediaTek Dimensity 7020",
    defaultDpi = 411,
    recommendedDpi = 510,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 174, 156, 138, 90, 162),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "moto-g84",
    brand = "Motorola",
    model = "Moto G84 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Snapdragon 695 5G",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 172, 154, 136, 88, 160),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "moto-edge-40-neo",
    brand = "Motorola",
    model = "Edge 40 Neo",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.55,
    chipset = "MediaTek Dimensity 7030",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(180, 168, 152, 134, 88, 158),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "moto-g34",
    brand = "Motorola",
    model = "Moto G34 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Snapdragon 695 5G",
    defaultDpi = 392,
    recommendedDpi = 490,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "moto-g14",
    brand = "Motorola",
    model = "Moto G14",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.5,
    chipset = "Unisoc T616",
    defaultDpi = 384,
    recommendedDpi = 480,
    thermalHeadroom = "Tight",
  ),
  DeviceSpec(
    id = "redmi-note-12",
    brand = "Xiaomi",
    model = "Redmi Note 12",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 685",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(185, 175, 155, 138, 88, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "redmi-note-13-pro",
    brand = "Xiaomi",
    model = "Redmi Note 13 Pro 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 7s Gen 2",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "poco-x6-pro",
    brand = "POCO",
    model = "POCO X6 Pro 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 480,
    screenInches = 6.67,
    chipset = "Dimensity 8300-Ultra",
    defaultDpi = 392,
    recommendedDpi = 540,
    thermalHeadroom = "High",
  ),
  DeviceSpec(
    id = "samsung-a54",
    brand = "Samsung",
    model = "Galaxy A54 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.4,
    chipset = "Exynos 1380",
    defaultDpi = 384,
    recommendedDpi = 490,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "samsung-a34",
    brand = "Samsung",
    model = "Galaxy A34 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.6,
    chipset = "Dimensity 1080",
    defaultDpi = 384,
    recommendedDpi = 485,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "realme-narzo-60",
    brand = "Realme",
    model = "Narzo 60 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.43,
    chipset = "Dimensity 6020",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "samsung-a04e",
    brand = "Samsung",
    model = "Galaxy A04e",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 3,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.5,
    chipset = "Helio P35",
    defaultDpi = 360,
    recommendedDpi = 460,
    thermalHeadroom = "Tight",
  ),
  DeviceSpec(
    id = "redmi-a2",
    brand = "Xiaomi",
    model = "Redmi A2",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 2,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.52,
    chipset = "Helio G36",
    defaultDpi = 360,
    recommendedDpi = 455,
    thermalHeadroom = "Tight",
  ),
  DeviceSpec(
    id = "infinix-smart-7",
    brand = "Infinix",
    model = "Smart 7",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 3,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.6,
    chipset = "Unisoc SC9863A1",
    defaultDpi = 360,
    recommendedDpi = 465,
    thermalHeadroom = "Tight",
  ),
  DeviceSpec(
    id = "samsung-s24-ultra",
    brand = "Samsung",
    model = "Galaxy S24 Ultra",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.8,
    chipset = "Snapdragon 8 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 550,
    thermalHeadroom = "High",
  ),
  DeviceSpec(
    id = "oneplus-12r",
    brand = "OnePlus",
    model = "OnePlus 12R",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 360,
    screenInches = 6.78,
    chipset = "Snapdragon 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
  ),
  DeviceSpec(
    id = "asus-rog-8",
    brand = "ASUS",
    model = "ROG Phone 8",
    tier = DeviceTier.GAMING,
    os = OperatingSystem.ANDROID,
    ramGb = 16,
    refreshHz = 165,
    touchSamplingHz = 720,
    screenInches = 6.78,
    chipset = "Snapdragon 8 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 560,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(176, 164, 148, 132, 86, 156),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "redmagic-9-pro",
    brand = "Nubia",
    model = "RedMagic 9 Pro",
    tier = DeviceTier.GAMING,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 960,
    screenInches = 6.8,
    chipset = "Snapdragon 8 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 555,
    thermalHeadroom = "High",
  ),
  DeviceSpec(
    id = "iqoo-neo-9-pro",
    brand = "iQOO",
    model = "Neo 9 Pro",
    tier = DeviceTier.GAMING,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 144,
    touchSamplingHz = 480,
    screenInches = 6.78,
    chipset = "Snapdragon 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
  ),
  DeviceSpec(
    id = "iphone-15-pro-max",
    brand = "Apple",
    model = "iPhone 15 Pro Max",
    tier = DeviceTier.IOS,
    os = OperatingSystem.IOS,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.7,
    chipset = "Apple A17 Pro",
    defaultDpi = 114,
    recommendedDpi = 120,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(178, 168, 150, 134, 88, 155),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "iphone-13",
    brand = "Apple",
    model = "iPhone 13",
    tier = DeviceTier.IOS,
    os = OperatingSystem.IOS,
    ramGb = 4,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.1,
    chipset = "Apple A15 Bionic",
    defaultDpi = 114,
    recommendedDpi = 120,
    thermalHeadroom = "Moderate",
  ),
  DeviceSpec(
    id = "ipad-pro-m2-11",
    brand = "Apple",
    model = "iPad Pro 11\" (M2)",
    tier = DeviceTier.IOS,
    os = OperatingSystem.IOS,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 11.0,
    chipset = "Apple M2",
    defaultDpi = 110,
    recommendedDpi = 118,
    thermalHeadroom = "High",
  ),
)

fun detectCurrentAndroidDevice(context: Context): DeviceSpec {
  val brand = Build.MANUFACTURER.replaceFirstChar { it.uppercaseChar() }.ifBlank { "Android" }
  val model = Build.MODEL.ifBlank { "This Phone" }
  val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
  val memInfo = ActivityManager.MemoryInfo()
  am?.getMemoryInfo(memInfo)
  val ramGb =
    if (memInfo.totalMem > 0L) {
      ceil(memInfo.totalMem / (1024.0 * 1024.0 * 1024.0)).toInt().coerceIn(2, 24)
    } else {
      6
    }

  val dm = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
  val rawHz = dm?.getDisplay(Display.DEFAULT_DISPLAY)?.refreshRate?.roundToInt() ?: 60
  val refreshHz =
    when {
      rawHz >= 150 -> 165
      rawHz >= 132 -> 144
      rawHz >= 105 -> 120
      rawHz >= 80 -> 90
      else -> 60
    }

  val metrics = context.resources.displayMetrics
  val xInches = if (metrics.xdpi > 0f) metrics.widthPixels / metrics.xdpi else 3.0f
  val yInches = if (metrics.ydpi > 0f) metrics.heightPixels / metrics.ydpi else 5.8f
  val diagInches = ((sqrt((xInches * xInches + yInches * yInches).toDouble()) * 10.0).roundToInt() / 10.0).coerceIn(4.7, 13.0)

  val swDp = context.resources.configuration.smallestScreenWidthDp.coerceIn(320, 600)
  val recommendedDpi = min(600, max(440, swDp + if (ramGb <= 3) 85 else 125))
  val touchHz = if (refreshHz >= 144) 360 else if (refreshHz >= 90) 240 else 120

  val tier =
    when {
      ramGb <= 3 -> DeviceTier.LOW
      ramGb <= 6 -> DeviceTier.MID
      refreshHz >= 144 -> DeviceTier.GAMING
      else -> DeviceTier.HIGH
    }

  val thermal =
    when {
      ramGb <= 3 -> "Tight"
      ramGb <= 6 -> "Moderate"
      else -> "High"
    }

  return DeviceSpec(
    id = "detected-this-phone",
    brand = brand,
    model = "$model (This Device)",
    tier = tier,
    os = OperatingSystem.ANDROID,
    ramGb = ramGb,
    refreshHz = refreshHz,
    touchSamplingHz = touchHz,
    screenInches = diagInches,
    chipset = Build.HARDWARE.ifBlank { "Android SoC" },
    defaultDpi = swDp,
    recommendedDpi = recommendedDpi,
    thermalHeadroom = thermal,
    isCustom = true,
  )
}

private fun clampInt(value: Int, minVal: Int, maxVal: Int): Int =
  min(maxVal, max(minVal, value))

fun calculateCalibration(
  device: DeviceSpec,
  playstyle: PlaystyleId,
  grip: GripType,
  rangeBias: RangeBias,
): CalibrationOutput {
  val isIos = device.os == OperatingSystem.IOS
  val lowEndBonus = if (device.ramGb <= 3) 12 else if (device.ramGb <= 4) 6 else 0
  val highTouchDamping = if (device.touchSamplingHz >= 480) -8 else if (device.touchSamplingHz >= 240) -3 else 4
  val largeScreenScale = if (device.screenInches >= 8.0) -10 else if (device.screenInches <= 6.2) 4 else 0
  val iosOffset = if (isIos) -6 else 0

  var baseGeneral = 178
  var baseRedDot = 166
  var base2x = 148
  var base4x = 132
  var baseSniper = 88
  var baseFreeLook = 152
  var fireSize = 48

  when (playstyle) {
    PlaystyleId.ONE_TAP -> {
      baseGeneral = 192; baseRedDot = 182; base2x = 154; base4x = 136; baseSniper = 95; baseFreeLook = 165; fireSize = 45
    }
    PlaystyleId.SMG_DRAG -> {
      baseGeneral = 184; baseRedDot = 172; base2x = 160; base4x = 140; baseSniper = 82; baseFreeLook = 158; fireSize = 51
    }
    PlaystyleId.BALANCED -> {
      baseGeneral = 174; baseRedDot = 162; base2x = 146; base4x = 130; baseSniper = 86; baseFreeLook = 148; fireSize = 50
    }
    PlaystyleId.FULL_RUSH -> {
      baseGeneral = 198; baseRedDot = 186; base2x = 164; base4x = 144; baseSniper = 90; baseFreeLook = 185; fireSize = 44
    }
  }

  when (grip) {
    GripType.THREE_FINGER -> { fireSize -= 2; baseGeneral += 2 }
    GripType.FOUR_FINGER -> { fireSize -= 4; baseGeneral += 4; baseFreeLook += 8 }
    GripType.TWO_FINGER -> Unit
  }

  when (rangeBias) {
    RangeBias.CLOSE -> { baseGeneral += 4; baseRedDot += 6; base4x -= 6 }
    RangeBias.LONG -> { baseGeneral -= 6; baseRedDot -= 4; base2x += 6; base4x += 10; baseSniper += 10; fireSize += 3 }
    RangeBias.MID -> Unit
  }

  val sensitivity: SensitivityValues
  val clampedFireSize: Int

  val preset = device.presetSensitivity
  if (preset != null) {
    val gPs = when (playstyle) { PlaystyleId.ONE_TAP -> 8; PlaystyleId.SMG_DRAG -> 3; PlaystyleId.FULL_RUSH -> 12; PlaystyleId.BALANCED -> 0 }
    val rPs = when (playstyle) { PlaystyleId.ONE_TAP -> 8; PlaystyleId.SMG_DRAG -> 4; PlaystyleId.FULL_RUSH -> 10; PlaystyleId.BALANCED -> 0 }
    val s2Ps = when (playstyle) { PlaystyleId.ONE_TAP -> 4; PlaystyleId.SMG_DRAG -> 8; PlaystyleId.FULL_RUSH -> 10; PlaystyleId.BALANCED -> 0 }
    val s4Ps = when (playstyle) { PlaystyleId.ONE_TAP -> 3; PlaystyleId.SMG_DRAG -> 5; PlaystyleId.FULL_RUSH -> 6; PlaystyleId.BALANCED -> 0 }
    val snPs = when (playstyle) { PlaystyleId.ONE_TAP -> 4; PlaystyleId.SMG_DRAG -> -2; PlaystyleId.FULL_RUSH -> 2; PlaystyleId.BALANCED -> 0 }
    val flPs = when (playstyle) { PlaystyleId.ONE_TAP -> 14; PlaystyleId.SMG_DRAG -> 8; PlaystyleId.FULL_RUSH -> 28; PlaystyleId.BALANCED -> 0 }
    val fbPs = when (playstyle) { PlaystyleId.ONE_TAP -> -1; PlaystyleId.SMG_DRAG -> 2; PlaystyleId.FULL_RUSH -> -2; PlaystyleId.BALANCED -> 0 }

    val gGrip = when (grip) { GripType.THREE_FINGER -> 2; GripType.FOUR_FINGER -> 4; GripType.TWO_FINGER -> 0 }
    val flGrip = when (grip) { GripType.THREE_FINGER -> 4; GripType.FOUR_FINGER -> 10; GripType.TWO_FINGER -> 0 }
    val fbGrip = when (grip) { GripType.THREE_FINGER -> -1; GripType.FOUR_FINGER -> -3; GripType.TWO_FINGER -> 0 }

    val gRange = when (rangeBias) { RangeBias.CLOSE -> 4; RangeBias.LONG -> -5; RangeBias.MID -> 0 }
    val rRange = when (rangeBias) { RangeBias.CLOSE -> 5; RangeBias.LONG -> -4; RangeBias.MID -> 0 }
    val s2Range = if (rangeBias == RangeBias.LONG) 5 else 0
    val s4Range = when (rangeBias) { RangeBias.CLOSE -> -4; RangeBias.LONG -> 8; RangeBias.MID -> 0 }
    val snRange = if (rangeBias == RangeBias.LONG) 8 else 0
    val fbRange = if (rangeBias == RangeBias.LONG) 2 else 0

    sensitivity = SensitivityValues(
      general = clampInt(preset.general + gPs + gGrip + gRange, 120, 200),
      redDot = clampInt(preset.redDot + rPs + rRange, 110, 200),
      scope2x = clampInt(preset.scope2x + s2Ps + s2Range, 95, 195),
      scope4x = clampInt(preset.scope4x + s4Ps + s4Range, 85, 185),
      sniperScope = clampInt(preset.sniperScope + snPs + snRange, 50, 145),
      freeLook = clampInt(preset.freeLook + flPs + flGrip, 70, 200),
    )
    clampedFireSize = clampInt((device.presetFireButton ?: 46) + fbPs + fbGrip + fbRange, 38, 62)
  } else {
    sensitivity = SensitivityValues(
      general = clampInt(baseGeneral + lowEndBonus + highTouchDamping + largeScreenScale + iosOffset, 120, 200),
      redDot = clampInt(baseRedDot + lowEndBonus + highTouchDamping + largeScreenScale + iosOffset, 110, 200),
      scope2x = clampInt(base2x + (lowEndBonus * 0.6).roundToInt() + iosOffset, 95, 195),
      scope4x = clampInt(base4x + (lowEndBonus * 0.5).roundToInt() + iosOffset, 85, 185),
      sniperScope = clampInt(baseSniper + if (rangeBias == RangeBias.LONG) 8 else 0, 50, 145),
      freeLook = clampInt(baseFreeLook + if (grip == GripType.FOUR_FINGER) 10 else 0, 90, 200),
    )
    val screenAdj = if (device.screenInches >= 8.0) -4 else if (device.screenInches <= 6.2) 3 else 0
    clampedFireSize = clampInt(fireSize + screenAdj, 38, 62)
  }

  val dpiValue: Int
  val dpiLabel: String
  val dpiSafeRange: String
  val pointerSpeed: String

  if (isIos) {
    dpiLabel = "iOS Gliding Cursor Speed"
    dpiSafeRange = "105–120 (Refined Mode)"
    dpiValue = if (playstyle == PlaystyleId.ONE_TAP || playstyle == PlaystyleId.FULL_RUSH) 120 else 114
    pointerSpeed = "Tracking Speed: 80% · AssistiveTouch Idle Opacity 15%"
  } else {
    dpiLabel = "Android Smallest Width (DPI)"
    dpiSafeRange = "${max(360, device.defaultDpi + 40)}–${min(620, device.recommendedDpi + 60)} dp"
    dpiValue =
      when (playstyle) {
        PlaystyleId.ONE_TAP, PlaystyleId.FULL_RUSH -> min(620, device.recommendedDpi + 25)
        PlaystyleId.BALANCED -> max(device.defaultDpi + 40, device.recommendedDpi - 15)
        PlaystyleId.SMG_DRAG -> device.recommendedDpi
      }
    pointerSpeed =
      if (device.touchSamplingHz >= 480) "65% (Balanced for high-Hz digitizer)"
      else if (device.ramGb <= 3) "100% (Max Pointer Speed for 120Hz touch)"
      else "75% (2 ticks below max)"
  }

  val graphics =
    if (device.ramGb <= 3 || device.tier == DeviceTier.LOW) {
      GraphicsTarget(
        display = "Smooth",
        highFps = if (device.refreshHz >= 90) "High" else "Normal",
        shadow = "Off",
        highRes = "Normal",
        filter = "Classic",
        autoScale = "Off",
        targetFps = if (device.refreshHz >= 90) 60 else 45,
        thermalNote = "Smooth graphics eliminates shader stalls on 2-3GB RAM and keeps frame times steady during final zones.",
      )
    } else if (device.tier == DeviceTier.MID || device.ramGb <= 6) {
      GraphicsTarget(
        display = "Standard",
        highFps = "High",
        shadow = "Off",
        highRes = "Normal",
        filter = "Bright",
        autoScale = "Off",
        targetFps = 60,
        thermalNote = "Standard + High FPS delivers locked 60 FPS with shadows disabled to prevent mid-range SoC thermal throttling.",
      )
    } else {
      GraphicsTarget(
        display = if (device.thermalHeadroom == "High") "Ultra" else "Standard",
        highFps = "High",
        shadow = if (device.tier == DeviceTier.GAMING) "On" else "Off",
        highRes = if (device.thermalHeadroom == "High") "High" else "Normal",
        filter = "Bright",
        autoScale = "Off",
        targetFps = if (device.refreshHz >= 90) 90 else 60,
        thermalNote =
          if (device.tier == DeviceTier.GAMING)
            "Active cooling / vapor-chamber headroom supports Ultra + High FPS without dropping frames."
          else
            "Keeping Shadows Off prevents GPU thermal throttling after 20+ minutes of ranked matches.",
      )
    }

  val dragGuidance = DragGuidance(
    preferredPattern =
      when (playstyle) {
        PlaystyleId.ONE_TAP -> "Fast J-Drag or Straight Snap (short 35-45% upward swipe)"
        PlaystyleId.SMG_DRAG -> "Controlled Vertical Lift (steady upward pull matching fire rate)"
        PlaystyleId.FULL_RUSH -> "Rotation Drag (wide C-arc sweep for sub-8m encounters)"
        PlaystyleId.BALANCED -> "Straight Vertical Drag (aim chest-level, lift smoothly to crown)"
      },
    swipeSpeed =
      if (device.touchSamplingHz >= 360) "Moderate-Fast · Avoid over-flicking on high touch-sampling glass"
      else "Crisp & Decisive · Complete upward flick in ~140-180ms",
    fireButtonAnchor =
      if (grip == GripType.TWO_FINGER) "Lower-right quadrant with 15-18% upward drag clearance"
      else "Lower-right mid zone leaving room for quick crouch-gloo thumb sweep",
  )

  return CalibrationOutput(
    sensitivity = sensitivity,
    fireButtonSize = clampedFireSize,
    dpiLabel = dpiLabel,
    dpiValue = dpiValue,
    dpiSafeRange = dpiSafeRange,
    pointerSpeed = pointerSpeed,
    graphics = graphics,
    dragGuidance = dragGuidance,
  )
}

fun buildOptimizationChecklist(device: DeviceSpec): List<OptimizationStep> {
  val list = mutableListOf(
    OptimizationStep(
      id = "ingame-fps",
      category = "In-Game Options",
      title = "Lock High FPS & Disable Shadows",
      settingValue = if (device.ramGb <= 3) "Smooth + High FPS (Shadows Off)" else "Standard/Ultra + High FPS (Shadows Off)",
      impact = "High",
      description = "Dynamic shadows consume up to 22% of mobile GPU shader time. Turning Shadows Off stabilizes frame pacing in final circles.",
    ),
    OptimizationStep(
      id = "ingame-autoscale",
      category = "In-Game Options",
      title = "Turn Auto Scale Off",
      settingValue = "Display > Auto Scale: Off",
      impact = "Medium",
      description = "Auto Scale dynamically shifts render resolution mid-fight, causing inconsistent drag distance.",
    ),
    OptimizationStep(
      id = "ingame-damage",
      category = "In-Game Options",
      title = "Classic Damage Indicator",
      settingValue = "Controls > Hit Marker: Classic · No Blood",
      impact = "Medium",
      description = "Reduces translucent overdraw around the enemy head hitbox during rapid sprays.",
    ),
  )

  if (device.os == OperatingSystem.ANDROID) {
    list.addAll(
      listOf(
        OptimizationStep(
          id = "android-dpi",
          category = "Display & Touch",
          title = "Set Developer Smallest Width (DPI)",
          settingValue = "${device.recommendedDpi} dp (Default: ${device.defaultDpi} dp)",
          impact = "High",
          description = "Increases angular camera speed per millimeter of thumb travel. Stay below 620 dp.",
        ),
        OptimizationStep(
          id = "android-animations",
          category = "Display & Touch",
          title = "Reduce Animation Scales to 0.5x",
          settingValue = "Window / Transition / Animator: 0.5x",
          impact = "Medium",
          description = "Cuts UI transition overhead when switching back into Free Fire.",
        ),
        OptimizationStep(
          id = "android-refresh",
          category = "Display & Touch",
          title = "Lock Display Refresh Rate",
          settingValue = "${device.refreshHz} Hz Fixed · Battery Saver Off",
          impact = "High",
          description = "Battery Saver caps screens down to 60 Hz. Disable it before ranked matches.",
        ),
        OptimizationStep(
          id = "android-bg",
          category = "Memory & CPU",
          title = "Cap Background Processes",
          settingValue = if (device.ramGb <= 4) "At most 2 processes" else "Lock Free Fire in Recents",
          impact = "High",
          description = "Prevents background social/sync apps from triggering memory stalls mid-gunfight.",
        ),
        OptimizationStep(
          id = "android-thermal",
          category = "Thermal & Battery",
          title = "Thermal & Game Turbo Rules",
          settingValue = "4x MSAA Off · Unplug Above 80%",
          impact = "High",
          description = "Playing while fast-charging adds battery heat and triggers SoC throttling.",
        ),
        OptimizationStep(
          id = "android-dnd",
          category = "Memory & CPU",
          title = "Enable Notification Block & DND",
          settingValue = "Block Heads-Up, Calls & Chat Bubbles",
          impact = "High",
          description = "Stops floating pop-ups from stealing screen touches or interrupting upward drag swipes.",
        ),
      )
    )
    if (device.brand == "Motorola") {
      list.add(
        OptimizationStep(
          id = "moto-gametime",
          category = "Display & Touch",
          title = "Activate Moto Gametime Performance",
          settingValue = "Performance Mode · ${device.refreshHz} Hz Lock",
          impact = "High",
          description = "Use Moto Gametime sidebar to block notifications and lock touch polling.",
        )
      )
    }
  } else {
    list.addAll(
      listOf(
        OptimizationStep(
          id = "ios-cursor",
          category = "Display & Touch",
          title = "Tune Switch Control Gliding Cursor",
          settingValue = "Refined Mode · Speed 114–120",
          impact = "High",
          description = "Settings > Accessibility > Switch Control > Gliding Cursor > Refined.",
        ),
        OptimizationStep(
          id = "ios-lowpower",
          category = "Thermal & Battery",
          title = "Keep Low Power Mode Off",
          settingValue = "Low Power Mode: Off · Game Mode: On",
          impact = "High",
          description = "Low Power Mode caps ProMotion displays at 60 Hz and throttles performance cores.",
        ),
      )
    )
  }

  return list
}

fun formatSetupAsText(
  device: DeviceSpec,
  sensitivity: SensitivityValues,
  fireButtonSize: Int,
  calibration: CalibrationOutput,
  playstyle: PlaystyleId,
  grip: GripType,
): String {
  return buildString {
    appendLine("FireTune Calibration — ${device.brand} ${device.model}")
    appendLine("Hardware: ${device.ramGb}GB RAM · ${device.refreshHz}Hz · ${device.chipset}")
    appendLine("Profile: ${playstyle.title} · Grip: ${grip.label}")
    appendLine()
    appendLine("[Sensitivity (0-200 Scale)]")
    appendLine("General: ${sensitivity.general}")
    appendLine("Red Dot: ${sensitivity.redDot}")
    appendLine("2x Scope: ${sensitivity.scope2x}")
    appendLine("4x Scope: ${sensitivity.scope4x}")
    appendLine("Sniper Scope: ${sensitivity.sniperScope}")
    appendLine("Free Look: ${sensitivity.freeLook}")
    appendLine()
    appendLine("[Controls & Hardware]")
    appendLine("Fire Button Size: $fireButtonSize%")
    appendLine("${calibration.dpiLabel}: ${calibration.dpiValue} (${calibration.dpiSafeRange})")
    appendLine("Pointer Speed: ${calibration.pointerSpeed}")
    appendLine()
    appendLine("[In-Game Graphics]")
    appendLine("Display: ${calibration.graphics.display} · High FPS: ${calibration.graphics.highFps} · Shadow: ${calibration.graphics.shadow} · Auto Scale: ${calibration.graphics.autoScale}")
  }
}
