package com.example

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
  @Test
  fun calibration_staysWithinFreeFireScale() {
    val device = DEVICE_CATALOG.first()
    val output = calculateCalibration(device, PlaystyleId.ONE_TAP, GripType.TWO_FINGER, RangeBias.MID)
    assertTrue(output.sensitivity.general in 0..200)
    assertTrue(output.sensitivity.redDot in 0..200)
    assertTrue(output.fireButtonSize in 32..70)
  }

  @Test
  fun samsungDevices_produceValidScribdCalibrationsAndGameBoosterStep() {
    val samsungDevices = DEVICE_CATALOG.filter { it.brand.equals("Samsung", ignoreCase = true) }
    assertTrue(samsungDevices.size >= 25)
    samsungDevices.forEach { device ->
      assertTrue(device.presetSensitivity != null)
      val out = calculateCalibration(device, PlaystyleId.BALANCED, GripType.TWO_FINGER, RangeBias.MID)
      assertTrue(out.sensitivity.general in 120..200)
      assertTrue(out.sensitivity.redDot in 110..200)
      assertTrue(out.sensitivity.scope2x in 95..195)
      assertTrue(out.sensitivity.scope4x in 85..185)
      assertTrue(out.sensitivity.sniperScope in 50..145)
      assertTrue(out.sensitivity.freeLook in 70..200)
      assertTrue(out.fireButtonSize in 38..62)
      val steps = buildOptimizationChecklist(device)
      assertTrue(steps.any { it.id == "samsung-game-booster" })
    }
  }

  @Test
  fun xiaomiMotorolaAndVivoDevices_produceValidCalibrationsAndChecklists() {
    val motorolaDevices = DEVICE_CATALOG.filter { it.brand.equals("Motorola", ignoreCase = true) }
    val xiaomiPocoDevices = DEVICE_CATALOG.filter {
      it.brand.equals("Xiaomi", ignoreCase = true) || it.brand.equals("POCO", ignoreCase = true)
    }
    val vivoDevices = DEVICE_CATALOG.filter { it.brand.equals("Vivo", ignoreCase = true) }

    assertTrue(motorolaDevices.size >= 15)
    assertTrue(xiaomiPocoDevices.size >= 25)
    assertTrue(vivoDevices.size >= 15)

    motorolaDevices.forEach { device ->
      assertTrue(device.presetSensitivity != null)
      val out = calculateCalibration(device, PlaystyleId.ONE_TAP, GripType.TWO_FINGER, RangeBias.MID)
      assertTrue(out.sensitivity.general in 120..200)
      assertTrue(out.fireButtonSize in 38..62)
      assertTrue(buildOptimizationChecklist(device).any { it.id == "moto-gametime" })
    }

    xiaomiPocoDevices.forEach { device ->
      assertTrue(device.presetSensitivity != null)
      val out = calculateCalibration(device, PlaystyleId.BALANCED, GripType.THREE_FINGER, RangeBias.MID)
      assertTrue(out.sensitivity.general in 120..200)
      assertTrue(out.fireButtonSize in 38..62)
      assertTrue(buildOptimizationChecklist(device).any { it.id == "xiaomi-gameturbo" })
    }

    vivoDevices.forEach { device ->
      assertTrue(device.presetSensitivity != null)
      val out = calculateCalibration(device, PlaystyleId.FULL_RUSH, GripType.FOUR_FINGER, RangeBias.CLOSE)
      assertTrue(out.sensitivity.general in 120..200)
      assertTrue(out.fireButtonSize in 38..62)
      assertTrue(buildOptimizationChecklist(device).any { it.id == "vivo-ultragamemode" })
    }
  }

  @Test
  fun localAuthCrypto_validatesEmailAndPasswordHash() {
    assertTrue(LocalAuthCrypto.isValidEmail("player@gmail.com"))
    assertFalse(LocalAuthCrypto.isValidEmail("invalid-email"))
    val salt = LocalAuthCrypto.generateSalt()
    val hash = LocalAuthCrypto.hashPassword("Secret123", salt)
    assertTrue(LocalAuthCrypto.verifyPassword("Secret123", salt, hash))
    assertFalse(LocalAuthCrypto.verifyPassword("WrongPass", salt, hash))
  }
}
