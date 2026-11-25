package com.example

import android.app.ActivityManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import java.security.MessageDigest
import java.security.SecureRandom
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

enum class AuthRole {
  ADMIN,
  USER,
}

enum class RequestStatus(val label: String) {
  PENDING("Pending"),
  APPROVED("Approved"),
  REJECTED("Rejected"),
}

data class LocalAuthUser(
  val id: String,
  val email: String,
  val customId: String,
  val displayName: String,
  val role: AuthRole,
  val passwordHash: String,
  val passwordSalt: String,
  val assignedDeviceId: String,
  val suspended: Boolean = false,
  val createdAt: String,
)

data class LocalAccessRequest(
  val id: String,
  val email: String,
  val customId: String,
  val displayName: String,
  val passwordHash: String,
  val passwordSalt: String,
  val requestedDeviceId: String,
  val note: String,
  val status: RequestStatus,
  val createdAt: String,
  val decidedAt: String? = null,
)

data class LocalAdminConfig(
  val adminId: String,
  val passwordHash: String,
  val passwordSalt: String,
)

object LocalAuthCrypto {
  private val emailRegex = Regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")

  fun isValidEmail(email: String): Boolean {
    val clean = email.trim()
    return clean.length in 5..120 && emailRegex.matches(clean)
  }

  fun deriveCustomIdFromEmail(email: String): String {
    val localPart = email.trim().lowercase().substringBefore("@")
    val cleaned = localPart.replace(Regex("[^a-z0-9._-]"), "").take(24)
    return if (cleaned.length >= 3) cleaned else "player${cleaned}"
  }

  fun generateSalt(): String {
    val bytes = ByteArray(16)
    SecureRandom().nextBytes(bytes)
    return bytes.joinToString("") { "%02x".format(it) }
  }

  fun hashPassword(password: String, saltHex: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val input = "$saltHex:$password".toByteArray(Charsets.UTF_8)
    val hashed = digest.digest(input)
    return hashed.joinToString("") { "%02x".format(it) }
  }

  fun verifyPassword(password: String, saltHex: String, expectedHash: String): Boolean {
    val actual = hashPassword(password, saltHex).toByteArray(Charsets.UTF_8)
    val expected = expectedHash.toByteArray(Charsets.UTF_8)
    return MessageDigest.isEqual(actual, expected)
  }
}

val DEVICE_CATALOG: List<DeviceSpec> = listOf(
  // Motorola Devices (Edge, G & E Series — Device-Calibrated OB44+ Presets)
  DeviceSpec(
    id = "moto-edge-50-ultra",
    brand = "Motorola",
    model = "Edge 50 Ultra",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.7,
    chipset = "Snapdragon 8s Gen 3",
    defaultDpi = 411,
    recommendedDpi = 550,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(176, 165, 149, 133, 87, 155),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "moto-edge-50-pro",
    brand = "Motorola",
    model = "Edge 50 Pro",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.7,
    chipset = "Snapdragon 7 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(179, 168, 151, 135, 88, 157),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "moto-edge-50-fusion",
    brand = "Motorola",
    model = "Edge 50 Fusion",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.7,
    chipset = "Snapdragon 7s Gen 2",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(182, 171, 154, 136, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "moto-edge-40-pro",
    brand = "Motorola",
    model = "Edge 40 Pro / X40",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 165,
    touchSamplingHz = 360,
    screenInches = 6.67,
    chipset = "Snapdragon 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 545,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(177, 166, 150, 134, 87, 156),
    presetFireButton = 44,
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
    id = "moto-edge-40",
    brand = "Motorola",
    model = "Edge 40 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.55,
    chipset = "MediaTek Dimensity 8020",
    defaultDpi = 411,
    recommendedDpi = 530,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(181, 170, 153, 135, 88, 159),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "moto-edge-30-ultra",
    brand = "Motorola",
    model = "Edge 30 Ultra / Edge 30 Pro",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 144,
    touchSamplingHz = 360,
    screenInches = 6.67,
    chipset = "Snapdragon 8+ Gen 1",
    defaultDpi = 411,
    recommendedDpi = 535,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(181, 170, 152, 135, 88, 158),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "moto-g85",
    brand = "Motorola",
    model = "Moto G85 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 6s Gen 3",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(185, 174, 156, 138, 89, 162),
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
    id = "moto-g73",
    brand = "Motorola",
    model = "Moto G73 / G72",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Dimensity 930 / Helio G99",
    defaultDpi = 392,
    recommendedDpi = 505,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 175, 157, 139, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "moto-g64",
    brand = "Motorola",
    model = "Moto G64 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "MediaTek Dimensity 7025",
    defaultDpi = 411,
    recommendedDpi = 515,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(185, 174, 156, 138, 90, 162),
    presetFireButton = 46,
  ),
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
    id = "moto-g45",
    brand = "Motorola",
    model = "Moto G45 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Snapdragon 6s Gen 3",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(188, 177, 158, 140, 91, 165),
    presetFireButton = 47,
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
    presetSensitivity = SensitivityValues(190, 180, 160, 142, 92, 168),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "moto-g24",
    brand = "Motorola",
    model = "Moto G24 / G24 Power",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.56,
    chipset = "MediaTek Helio G85",
    defaultDpi = 360,
    recommendedDpi = 475,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(193, 183, 162, 144, 93, 171),
    presetFireButton = 49,
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
    presetSensitivity = SensitivityValues(194, 185, 164, 146, 94, 172),
    presetFireButton = 49,
  ),
  DeviceSpec(
    id = "moto-e14",
    brand = "Motorola",
    model = "Moto E14 / E13",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 2,
    refreshHz = 90,
    touchSamplingHz = 120,
    screenInches = 6.56,
    chipset = "Unisoc T606",
    defaultDpi = 360,
    recommendedDpi = 455,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(198, 189, 167, 148, 95, 176),
    presetFireButton = 51,
  ),
  // Samsung Galaxy Devices (S, Z, A, M, F Series — Scribd-Calibrated OB44+ Presets)
  DeviceSpec(
    id = "samsung-s25-ultra",
    brand = "Samsung",
    model = "Galaxy S25 Ultra",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.9,
    chipset = "Snapdragon 8 Elite",
    defaultDpi = 411,
    recommendedDpi = 560,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(175, 164, 148, 132, 86, 155),
    presetFireButton = 44,
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
    presetSensitivity = SensitivityValues(176, 165, 149, 133, 87, 156),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "samsung-s24",
    brand = "Samsung",
    model = "Galaxy S24 / S24+",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.2,
    chipset = "Exynos 2400 / SD 8 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(180, 169, 152, 135, 88, 158),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-s23-ultra",
    brand = "Samsung",
    model = "Galaxy S23 Ultra",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.8,
    chipset = "Snapdragon 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 545,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(178, 167, 150, 134, 87, 156),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "samsung-s23-fe",
    brand = "Samsung",
    model = "Galaxy S23 FE",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.4,
    chipset = "Exynos 2200 / SD 8 Gen 1",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(183, 172, 154, 137, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-s21-fe",
    brand = "Samsung",
    model = "Galaxy S21 FE 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.4,
    chipset = "Snapdragon 888 / Exynos 2100",
    defaultDpi = 411,
    recommendedDpi = 515,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 138, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-s20-fe",
    brand = "Samsung",
    model = "Galaxy S20 FE 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Snapdragon 865",
    defaultDpi = 411,
    recommendedDpi = 510,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(185, 174, 156, 138, 90, 162),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-z-flip-5",
    brand = "Samsung",
    model = "Galaxy Z Flip 5 / Flip 6",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.7,
    chipset = "Snapdragon 8 Gen 2 / Gen 3",
    defaultDpi = 411,
    recommendedDpi = 530,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(182, 171, 153, 136, 88, 160),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "samsung-z-fold-5",
    brand = "Samsung",
    model = "Galaxy Z Fold 5 / Fold 6",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 7.6,
    chipset = "Snapdragon 8 Gen 2 / Gen 3",
    defaultDpi = 411,
    recommendedDpi = 560,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(172, 162, 146, 130, 85, 152),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "samsung-a55",
    brand = "Samsung",
    model = "Galaxy A55 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.6,
    chipset = "Exynos 1480",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(182, 171, 153, 136, 88, 160),
    presetFireButton = 46,
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
    presetSensitivity = SensitivityValues(184, 173, 155, 137, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-a53",
    brand = "Samsung",
    model = "Galaxy A53 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Exynos 1280",
    defaultDpi = 384,
    recommendedDpi = 485,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 175, 156, 139, 90, 162),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "samsung-a52s",
    brand = "Samsung",
    model = "Galaxy A52s 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Snapdragon 778G",
    defaultDpi = 411,
    recommendedDpi = 510,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(184, 174, 155, 138, 90, 162),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-a35",
    brand = "Samsung",
    model = "Galaxy A35 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.6,
    chipset = "Exynos 1380",
    defaultDpi = 384,
    recommendedDpi = 495,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(185, 174, 156, 138, 89, 162),
    presetFireButton = 46,
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
    presetSensitivity = SensitivityValues(186, 176, 157, 139, 90, 163),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-a25",
    brand = "Samsung",
    model = "Galaxy A25 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Exynos 1280",
    defaultDpi = 384,
    recommendedDpi = 480,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(188, 177, 158, 140, 91, 165),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "samsung-a15",
    brand = "Samsung",
    model = "Galaxy A15 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.5,
    chipset = "Dimensity 6100+",
    defaultDpi = 384,
    recommendedDpi = 475,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(190, 180, 160, 142, 92, 168),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "samsung-a14",
    brand = "Samsung",
    model = "Galaxy A14 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.6,
    chipset = "Exynos 1330 / Dimensity 700",
    defaultDpi = 384,
    recommendedDpi = 475,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(192, 182, 162, 143, 93, 170),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "samsung-a13",
    brand = "Samsung",
    model = "Galaxy A13",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.6,
    chipset = "Exynos 850",
    defaultDpi = 360,
    recommendedDpi = 465,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(195, 185, 164, 145, 94, 172),
    presetFireButton = 49,
  ),
  DeviceSpec(
    id = "samsung-a12",
    brand = "Samsung",
    model = "Galaxy A12",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.5,
    chipset = "Helio P35 / Exynos 850",
    defaultDpi = 360,
    recommendedDpi = 460,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(196, 186, 165, 146, 94, 174),
    presetFireButton = 50,
  ),
  DeviceSpec(
    id = "samsung-a05s",
    brand = "Samsung",
    model = "Galaxy A05s",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.7,
    chipset = "Snapdragon 680",
    defaultDpi = 384,
    recommendedDpi = 475,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(191, 181, 161, 143, 92, 169),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "samsung-a05",
    brand = "Samsung",
    model = "Galaxy A05",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.7,
    chipset = "Helio G85",
    defaultDpi = 360,
    recommendedDpi = 465,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(194, 184, 163, 144, 93, 171),
    presetFireButton = 49,
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
    presetSensitivity = SensitivityValues(197, 188, 166, 147, 95, 175),
    presetFireButton = 50,
  ),
  DeviceSpec(
    id = "samsung-a03",
    brand = "Samsung",
    model = "Galaxy A03 / A03 Core",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 3,
    refreshHz = 60,
    touchSamplingHz = 120,
    screenInches = 6.5,
    chipset = "Unisoc T606",
    defaultDpi = 360,
    recommendedDpi = 455,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(198, 189, 168, 148, 95, 176),
    presetFireButton = 51,
  ),
  DeviceSpec(
    id = "samsung-m55",
    brand = "Samsung",
    model = "Galaxy M55 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.7,
    chipset = "Snapdragon 7 Gen 1",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(183, 172, 154, 137, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-m34",
    brand = "Samsung",
    model = "Galaxy M34 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.5,
    chipset = "Exynos 1280",
    defaultDpi = 384,
    recommendedDpi = 485,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 176, 157, 139, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "samsung-m14",
    brand = "Samsung",
    model = "Galaxy M14 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.6,
    chipset = "Exynos 1330",
    defaultDpi = 384,
    recommendedDpi = 475,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(191, 181, 161, 142, 92, 168),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "samsung-f54",
    brand = "Samsung",
    model = "Galaxy F54 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.7,
    chipset = "Exynos 1380",
    defaultDpi = 411,
    recommendedDpi = 510,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 138, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "samsung-f15",
    brand = "Samsung",
    model = "Galaxy F15 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.5,
    chipset = "Dimensity 6100+",
    defaultDpi = 384,
    recommendedDpi = 475,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(191, 181, 161, 143, 92, 169),
    presetFireButton = 48,
  ),
  // Xiaomi / Mi / Redmi / POCO Devices (Device-Calibrated OB44+ Presets)
  DeviceSpec(
    id = "xiaomi-14-ultra",
    brand = "Xiaomi",
    model = "Xiaomi 14 Ultra",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 16,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.73,
    chipset = "Snapdragon 8 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 555,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(175, 164, 148, 132, 86, 154),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "xiaomi-14",
    brand = "Xiaomi",
    model = "Xiaomi 14 / 14 Civi",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.36,
    chipset = "Snapdragon 8 Gen 3 / 8s Gen 3",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(178, 167, 150, 134, 87, 157),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "xiaomi-13-pro",
    brand = "Xiaomi",
    model = "Xiaomi 13 Pro / Xiaomi 13",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.73,
    chipset = "Snapdragon 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 545,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(177, 166, 149, 133, 87, 156),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "xiaomi-13t-pro",
    brand = "Xiaomi",
    model = "Xiaomi 13T Pro / 13T",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 144,
    touchSamplingHz = 480,
    screenInches = 6.67,
    chipset = "Dimensity 9200+ / 8200-Ultra",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(174, 163, 147, 131, 86, 154),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "xiaomi-12-pro",
    brand = "Xiaomi",
    model = "Xiaomi 12 Pro / 12",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 480,
    screenInches = 6.73,
    chipset = "Snapdragon 8 Gen 1",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(179, 168, 151, 134, 87, 157),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "xiaomi-11t-pro",
    brand = "Xiaomi",
    model = "Xiaomi 11T Pro / Mi 11",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 480,
    screenInches = 6.67,
    chipset = "Snapdragon 888",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(180, 169, 152, 135, 88, 158),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "xiaomi-11x",
    brand = "Xiaomi",
    model = "Mi 11X / 11i HyperCharge",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 360,
    screenInches = 6.67,
    chipset = "Snapdragon 870 / Dimensity 920",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(181, 170, 153, 136, 88, 159),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "xiaomi-10t-pro",
    brand = "Xiaomi",
    model = "Mi 10T Pro / Mi 10T",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 144,
    touchSamplingHz = 180,
    screenInches = 6.67,
    chipset = "Snapdragon 865",
    defaultDpi = 392,
    recommendedDpi = 515,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(183, 172, 154, 137, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "redmi-k70-pro",
    brand = "Xiaomi",
    model = "Redmi K70 / K70 Pro",
    tier = DeviceTier.GAMING,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 480,
    screenInches = 6.67,
    chipset = "Snapdragon 8 Gen 2 / Gen 3",
    defaultDpi = 411,
    recommendedDpi = 550,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(174, 163, 147, 131, 86, 154),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "redmi-note-13-pro-plus",
    brand = "Xiaomi",
    model = "Redmi Note 13 Pro+ 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "MediaTek Dimensity 7200-Ultra",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(181, 170, 153, 136, 88, 159),
    presetFireButton = 45,
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
    presetSensitivity = SensitivityValues(182, 171, 154, 136, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "redmi-note-13",
    brand = "Xiaomi",
    model = "Redmi Note 13 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "MediaTek Dimensity 6080",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 176, 157, 139, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "redmi-note-12-pro",
    brand = "Xiaomi",
    model = "Redmi Note 12 Pro / Pro+",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "MediaTek Dimensity 1080",
    defaultDpi = 392,
    recommendedDpi = 510,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 137, 89, 161),
    presetFireButton = 46,
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
    id = "redmi-note-11-pro",
    brand = "Xiaomi",
    model = "Redmi Note 11 Pro / 11 Pro+ 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 360,
    screenInches = 6.67,
    chipset = "Snapdragon 695 / Helio G96",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(185, 174, 155, 138, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "redmi-note-11",
    brand = "Xiaomi",
    model = "Redmi Note 11",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.43,
    chipset = "Snapdragon 680",
    defaultDpi = 392,
    recommendedDpi = 485,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(189, 179, 159, 141, 91, 166),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "redmi-note-10-pro",
    brand = "Xiaomi",
    model = "Redmi Note 10 Pro",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 732G",
    defaultDpi = 392,
    recommendedDpi = 505,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 175, 156, 138, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "redmi-note-9-pro",
    brand = "Xiaomi",
    model = "Redmi Note 9 Pro / Note 8 Pro",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 60,
    touchSamplingHz = 180,
    screenInches = 6.67,
    chipset = "Snapdragon 720G / Helio G90T",
    defaultDpi = 392,
    recommendedDpi = 490,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(189, 179, 159, 141, 91, 166),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "redmi-13c",
    brand = "Xiaomi",
    model = "Redmi 13C / Redmi 12",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.74,
    chipset = "MediaTek Helio G85 / G88",
    defaultDpi = 360,
    recommendedDpi = 475,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(193, 183, 162, 144, 93, 170),
    presetFireButton = 49,
  ),
  DeviceSpec(
    id = "redmi-10-prime",
    brand = "Xiaomi",
    model = "Redmi 10 / 9 Power",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.5,
    chipset = "Helio G88 / SD 662",
    defaultDpi = 360,
    recommendedDpi = 470,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(194, 184, 163, 145, 93, 171),
    presetFireButton = 49,
  ),
  DeviceSpec(
    id = "redmi-a2",
    brand = "Xiaomi",
    model = "Redmi A2 / A3",
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
    presetSensitivity = SensitivityValues(199, 190, 168, 149, 96, 178),
    presetFireButton = 52,
  ),
  DeviceSpec(
    id = "poco-f6-pro",
    brand = "POCO",
    model = "POCO F6 / F6 Pro",
    tier = DeviceTier.GAMING,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 480,
    screenInches = 6.67,
    chipset = "Snapdragon 8s Gen 3 / 8 Gen 2",
    defaultDpi = 411,
    recommendedDpi = 545,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(175, 164, 148, 132, 86, 155),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "poco-f5",
    brand = "POCO",
    model = "POCO F5 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 7+ Gen 2",
    defaultDpi = 392,
    recommendedDpi = 530,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(180, 169, 152, 135, 88, 158),
    presetFireButton = 45,
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
    presetSensitivity = SensitivityValues(176, 165, 149, 133, 87, 156),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "poco-x5-pro",
    brand = "POCO",
    model = "POCO X5 Pro 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 778G",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(182, 171, 154, 136, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "poco-x3-pro",
    brand = "POCO",
    model = "POCO X3 Pro",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Snapdragon 860",
    defaultDpi = 392,
    recommendedDpi = 515,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 138, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "poco-m6-pro",
    brand = "POCO",
    model = "POCO M6 Pro / M4 Pro",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 90,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "Helio G99 Ultra / SD 4 Gen 2",
    defaultDpi = 392,
    recommendedDpi = 495,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(188, 178, 158, 140, 91, 165),
    presetFireButton = 47,
  ),

  // Vivo Devices (X, V, T & Y Series — Device-Calibrated OB44+ Presets)
  DeviceSpec(
    id = "vivo-x200-pro",
    brand = "Vivo",
    model = "X200 Pro",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 16,
    refreshHz = 120,
    touchSamplingHz = 300,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 9400",
    defaultDpi = 411,
    recommendedDpi = 555,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(175, 164, 148, 132, 86, 154),
    presetFireButton = 44,
  ),
  DeviceSpec(
    id = "vivo-x100-pro",
    brand = "Vivo",
    model = "X100 Pro / X100",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 9300",
    defaultDpi = 411,
    recommendedDpi = 550,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(177, 166, 149, 133, 87, 156),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "vivo-x90-pro",
    brand = "Vivo",
    model = "X90 Pro",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 9200",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(178, 167, 150, 134, 87, 157),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "vivo-v40-pro",
    brand = "Vivo",
    model = "V40 Pro 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 12,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 9200+",
    defaultDpi = 411,
    recommendedDpi = 540,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(179, 168, 151, 134, 88, 157),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "vivo-v40",
    brand = "Vivo",
    model = "V40 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "Snapdragon 7 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(182, 171, 153, 136, 88, 159),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-v30-pro",
    brand = "Vivo",
    model = "V30 Pro 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 8200",
    defaultDpi = 411,
    recommendedDpi = 530,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(181, 170, 152, 135, 88, 158),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "vivo-v30",
    brand = "Vivo",
    model = "V30 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "Snapdragon 7 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(182, 171, 154, 136, 88, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-v29-pro",
    brand = "Vivo",
    model = "V29 Pro / V29 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "Dimensity 8200 / SD 778G",
    defaultDpi = 411,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(183, 172, 154, 137, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-v27",
    brand = "Vivo",
    model = "V27 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 7200",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 137, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-t3-ultra",
    brand = "Vivo",
    model = "T3 Ultra 5G",
    tier = DeviceTier.HIGH,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 300,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 9200+",
    defaultDpi = 411,
    recommendedDpi = 535,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(178, 167, 150, 134, 87, 156),
    presetFireButton = 45,
  ),
  DeviceSpec(
    id = "vivo-t3-pro",
    brand = "Vivo",
    model = "T3 Pro 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.77,
    chipset = "Snapdragon 7 Gen 3",
    defaultDpi = 411,
    recommendedDpi = 525,
    thermalHeadroom = "High",
    presetSensitivity = SensitivityValues(182, 171, 153, 136, 88, 159),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-t3-5g",
    brand = "Vivo",
    model = "T3 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.67,
    chipset = "MediaTek Dimensity 7200",
    defaultDpi = 392,
    recommendedDpi = 515,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(184, 173, 155, 138, 89, 161),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-t3x",
    brand = "Vivo",
    model = "T3x 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.72,
    chipset = "Snapdragon 6 Gen 1",
    defaultDpi = 392,
    recommendedDpi = 500,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 176, 157, 139, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "vivo-t2-pro",
    brand = "Vivo",
    model = "T2 Pro 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "MediaTek Dimensity 7200",
    defaultDpi = 392,
    recommendedDpi = 520,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(183, 172, 154, 137, 89, 160),
    presetFireButton = 46,
  ),
  DeviceSpec(
    id = "vivo-t2-5g",
    brand = "Vivo",
    model = "T2 / T2x 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 90,
    touchSamplingHz = 180,
    screenInches = 6.38,
    chipset = "Snapdragon 695 / Dimensity 6020",
    defaultDpi = 392,
    recommendedDpi = 495,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(188, 177, 158, 140, 90, 165),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "vivo-y200-pro",
    brand = "Vivo",
    model = "Y200 Pro / Y200 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 8,
    refreshHz = 120,
    touchSamplingHz = 240,
    screenInches = 6.78,
    chipset = "Snapdragon 695 / SD 4 Gen 1",
    defaultDpi = 392,
    recommendedDpi = 505,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(186, 175, 156, 138, 90, 163),
    presetFireButton = 47,
  ),
  DeviceSpec(
    id = "vivo-y58",
    brand = "Vivo",
    model = "Y58 / Y56 5G",
    tier = DeviceTier.MID,
    os = OperatingSystem.ANDROID,
    ramGb = 6,
    refreshHz = 120,
    touchSamplingHz = 180,
    screenInches = 6.72,
    chipset = "Snapdragon 4 Gen 2 / Dimensity 700",
    defaultDpi = 384,
    recommendedDpi = 485,
    thermalHeadroom = "Moderate",
    presetSensitivity = SensitivityValues(190, 180, 160, 142, 92, 167),
    presetFireButton = 48,
  ),
  DeviceSpec(
    id = "vivo-y28",
    brand = "Vivo",
    model = "Y28 / Y18 / Y16",
    tier = DeviceTier.LOW,
    os = OperatingSystem.ANDROID,
    ramGb = 4,
    refreshHz = 90,
    touchSamplingHz = 120,
    screenInches = 6.56,
    chipset = "Helio G85 / Helio P35",
    defaultDpi = 360,
    recommendedDpi = 470,
    thermalHeadroom = "Tight",
    presetSensitivity = SensitivityValues(195, 185, 164, 145, 94, 172),
    presetFireButton = 49,
  ),

  // Other Android & Flagship Devices
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
    presetSensitivity = SensitivityValues(186, 176, 157, 139, 90, 163),
    presetFireButton = 47,
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
    presetSensitivity = SensitivityValues(197, 187, 166, 147, 95, 175),
    presetFireButton = 50,
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
    presetSensitivity = SensitivityValues(179, 168, 151, 134, 87, 157),
    presetFireButton = 45,
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
    presetSensitivity = SensitivityValues(174, 162, 146, 130, 85, 154),
    presetFireButton = 44,
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
    presetSensitivity = SensitivityValues(177, 165, 149, 133, 87, 156),
    presetFireButton = 44,
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
    presetSensitivity = SensitivityValues(184, 174, 155, 137, 89, 160),
    presetFireButton = 47,
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
    presetSensitivity = SensitivityValues(166, 156, 140, 126, 84, 146),
    presetFireButton = 42,
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
    } else if (device.brand == "Samsung") {
      list.add(
        OptimizationStep(
          id = "samsung-game-booster",
          category = "Display & Touch",
          title = "Enable Samsung Game Booster & Touch Sensitivity",
          settingValue = "Game Optimization: Performance · Priority Mode On · Touch Sensitivity On",
          impact = "High",
          description = "Open Game Booster > Game optimization > Performance and enable Display > Touch sensitivity in One UI Settings for cleaner upward drag registration.",
        )
      )
    } else if (device.brand == "Xiaomi" || device.brand == "POCO") {
      list.add(
        OptimizationStep(
          id = "xiaomi-gameturbo",
          category = "Display & Touch",
          title = "Tune Xiaomi / POCO Game Turbo Touch Response",
          settingValue = "Game Turbo: Performance Mode · Touch Response High · ${device.refreshHz} Hz",
          impact = "High",
          description = "In Security > Game Turbo > Additional Settings for Free Fire, raise Touch Response and Sensitivity, enable Memory Exceptions, and turn off Enhanced Visuals.",
        )
      )
    } else if (device.brand == "Vivo" || device.brand == "iQOO") {
      list.add(
        OptimizationStep(
          id = "vivo-ultragamemode",
          category = "Display & Touch",
          title = "Enable Vivo Ultra Game Mode & Esports Mode",
          settingValue = "Ultra Game Mode: Esports · Multi-Turbo Boost · ${device.refreshHz} Hz",
          impact = "High",
          description = "Turn on Ultra Game Mode and Esports Mode in Settings (or Monster Mode on iQOO) to prioritize touch polling and keep ranked frame pacing locked.",
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
    appendLine("FF TUNE Calibration — ${device.brand} ${device.model}")
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
