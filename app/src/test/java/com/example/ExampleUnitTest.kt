package com.example

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
}
