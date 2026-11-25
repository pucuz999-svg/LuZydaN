package com.example

import android.content.Intent
import android.provider.Settings
import android.view.Choreographer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.NotificationsOff
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.RocketLaunch
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.TrackChanges
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.AmberAccent
import com.example.ui.theme.BgObsidian
import com.example.ui.theme.BorderSlate
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.OrangeAccent
import com.example.ui.theme.OrangeSoft
import com.example.ui.theme.RoseAccent
import com.example.ui.theme.SurfaceElevated
import com.example.ui.theme.SurfacePanel
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlinx.coroutines.delay

@Composable
fun SensitivityScreen(
  devices: List<DeviceSpec>,
  selectedDevice: DeviceSpec,
  onSelectDevice: (DeviceSpec) -> Unit,
  onDetectCurrentPhone: () -> Unit,
  onOpenCustomDevice: () -> Unit,
  playstyle: PlaystyleId,
  onChangePlaystyle: (PlaystyleId) -> Unit,
  grip: GripType,
  onChangeGrip: (GripType) -> Unit,
  rangeBias: RangeBias,
  onChangeRangeBias: (RangeBias) -> Unit,
  calibration: CalibrationOutput,
  sensitivity: SensitivityValues,
  fireButtonSize: Int,
  onUpdateSensitivity: (SensitivityValues) -> Unit,
  onUpdateFireButton: (Int) -> Unit,
  onResetRecommended: () -> Unit,
  onCopySetup: () -> Unit,
  onSavePreset: () -> Unit,
) {
  var searchQuery by remember { mutableStateOf("") }
  var filterMode by remember { mutableStateOf("all") }
  var showDpiDialog by remember { mutableStateOf(false) }

  val filteredDevices = remember(devices, searchQuery, filterMode) {
    val q = searchQuery.trim().lowercase()
    devices.filter { d ->
      val tierOk =
        when (filterMode) {
          "all" -> true
          "samsung" -> d.brand.equals("Samsung", ignoreCase = true)
          "xiaomi" -> d.brand.equals("Xiaomi", ignoreCase = true) || d.brand.equals("POCO", ignoreCase = true)
          "motorola" -> d.brand.equals("Motorola", ignoreCase = true)
          "vivo" -> d.brand.equals("Vivo", ignoreCase = true) || d.brand.equals("iQOO", ignoreCase = true)
          "low" -> d.tier == DeviceTier.LOW
          "mid" -> d.tier == DeviceTier.MID
          "high" -> d.tier == DeviceTier.HIGH
          "gaming" -> d.tier == DeviceTier.GAMING
          "ios" -> d.tier == DeviceTier.IOS
          else -> true
        }
      if (!tierOk) return@filter false
      if (q.isEmpty()) return@filter true
      "${d.brand} ${d.model} ${d.chipset} ${d.ramGb}gb".lowercase().contains(q)
    }
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 16.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    // Device Catalog Card
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Target Device", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
          Text(
            "${devices.size} calibrated hardware profiles",
            color = TextMuted,
            fontSize = 12.sp,
          )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedButton(
            onClick = onDetectCurrentPhone,
            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
            border = BorderStroke(1.dp, BorderSlate),
          ) {
            Icon(Icons.Rounded.PhoneAndroid, contentDescription = null, modifier = Modifier.size(15.dp), tint = OrangeAccent)
            Spacer(Modifier.width(4.dp))
            Text("Detect", fontSize = 12.sp, color = TextPrimary)
          }
          OutlinedButton(
            onClick = onOpenCustomDevice,
            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
            border = BorderStroke(1.dp, BorderSlate),
          ) {
            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(15.dp), tint = OrangeAccent)
            Spacer(Modifier.width(4.dp))
            Text("Custom", fontSize = 12.sp, color = TextPrimary)
          }
        }
      }

      Spacer(Modifier.height(10.dp))

      OutlinedTextField(
        value = searchQuery,
        onValueChange = { searchQuery = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        placeholder = { Text("Search phone, chipset, or RAM...", fontSize = 13.sp, color = TextMuted) },
        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, tint = TextMuted) },
      )

      Spacer(Modifier.height(8.dp))

      Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        val filters = listOf(
          "all" to "All",
          "samsung" to "Samsung",
          "xiaomi" to "Xiaomi/Mi",
          "motorola" to "Motorola",
          "vivo" to "Vivo",
          "low" to "2-3GB",
          "mid" to "4-6GB",
          "high" to "Flagship",
          "gaming" to "Gaming",
          "ios" to "iOS",
        )
        filters.forEach { (id, label) ->
          FilterChip(
            selected = filterMode == id,
            onClick = { filterMode = id },
            label = { Text(label, fontSize = 12.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }

      Spacer(Modifier.height(8.dp))

      Column(
        modifier = Modifier
          .fillMaxWidth()
          .heightIn(max = 210.dp)
          .clip(RoundedCornerShape(10.dp))
          .background(BgObsidian)
          .border(1.dp, BorderSlate, RoundedCornerShape(10.dp))
          .verticalScroll(rememberScrollState()),
      ) {
        if (filteredDevices.isEmpty()) {
          Column(
            modifier = Modifier
              .fillMaxWidth()
              .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
          ) {
            Text("No matching device found", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(8.dp))
            Button(onClick = onOpenCustomDevice) {
              Text("Create Custom Profile", fontSize = 12.sp)
            }
          }
        } else {
          filteredDevices.forEachIndexed { idx, device ->
            val selected = device.id == selectedDevice.id
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .background(if (selected) OrangeAccent.copy(alpha = 0.14f) else Color.Transparent)
                .clickable { onSelectDevice(device) }
                .padding(horizontal = 12.dp, vertical = 10.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Column(modifier = Modifier.weight(1f)) {
                Text(
                  "${device.brand} ${device.model}",
                  color = if (selected) OrangeSoft else TextPrimary,
                  fontWeight = FontWeight.SemiBold,
                  fontSize = 13.sp,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis,
                )
                Text(
                  "${device.ramGb} GB RAM · ${device.refreshHz} Hz · ${device.chipset}",
                  color = TextMuted,
                  fontSize = 11.sp,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis,
                )
              }
              Text(
                device.os.label,
                color = TextMuted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
              )
            }
            if (idx < filteredDevices.lastIndex) {
              HorizontalDivider(color = BorderSlate.copy(alpha = 0.6f))
            }
          }
        }
      }
    }

    // Active Hardware Summary Card
    PanelCard {
      Text("ACTIVE HARDWARE PROFILE", color = OrangeAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(4.dp))
      Text(
        "${selectedDevice.brand} ${selectedDevice.model}",
        color = TextPrimary,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
      )
      Text(
        "${selectedDevice.chipset} · ${selectedDevice.ramGb} GB · ${selectedDevice.refreshHz} Hz · ${selectedDevice.touchSamplingHz} Hz Touch",
        color = TextMuted,
        fontSize = 12.sp,
      )

      Spacer(Modifier.height(12.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        MetricBox(
          modifier = Modifier.weight(1f),
          label = "DPI Target",
          value = "${calibration.dpiValue}${if (selectedDevice.os == OperatingSystem.ANDROID) " dp" else ""}",
          sub = calibration.dpiSafeRange,
          onInfoClick = { showDpiDialog = true },
        )
        MetricBox(
          modifier = Modifier.weight(1f),
          label = "Fire Button",
          value = "$fireButtonSize%",
          valueColor = OrangeSoft,
          sub = "Rec: ${calibration.fireButtonSize}%",
        )
      }

      Spacer(Modifier.height(8.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        MetricBox(
          modifier = Modifier.weight(1f),
          label = "Graphics",
          value = calibration.graphics.display,
          sub = "High FPS: ${calibration.graphics.highFps}",
        )
        MetricBox(
          modifier = Modifier.weight(1f),
          label = "Thermal",
          value = selectedDevice.thermalHeadroom,
          valueColor = when (selectedDevice.thermalHeadroom) {
            "High" -> EmeraldAccent
            "Moderate" -> AmberAccent
            else -> RoseAccent
          },
          sub = "Target ${calibration.graphics.targetFps} FPS",
        )
      }

      Spacer(Modifier.height(12.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        OutlinedButton(
          onClick = onCopySetup,
          modifier = Modifier.weight(1f),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Icon(Icons.Rounded.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp), tint = TextPrimary)
          Spacer(Modifier.width(6.dp))
          Text("Copy Setup", fontSize = 12.sp, color = TextPrimary)
        }
        Button(
          onClick = onSavePreset,
          modifier = Modifier.weight(1f),
          colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
        ) {
          Icon(Icons.Rounded.Bookmark, contentDescription = null, modifier = Modifier.size(16.dp))
          Spacer(Modifier.width(6.dp))
          Text("Save Preset", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
      }
    }

    // Combat Playstyle, Grip & Range
    PanelCard {
      Text("Combat Playstyle", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
      Spacer(Modifier.height(8.dp))

      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PlaystyleId.entries.chunked(2).forEach { pair ->
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
          ) {
            pair.forEach { ps ->
              val selected = playstyle == ps
              Surface(
                modifier = Modifier
                  .weight(1f)
                  .clickable { onChangePlaystyle(ps) },
                color = if (selected) OrangeAccent.copy(alpha = 0.14f) else BgObsidian,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, if (selected) OrangeAccent else BorderSlate),
              ) {
                Column(modifier = Modifier.padding(10.dp)) {
                  Text(
                    ps.title,
                    color = TextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                  )
                  Text(
                    ps.weapons,
                    color = TextMuted,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                  )
                }
              }
            }
          }
        }
      }

      Spacer(Modifier.height(8.dp))
      Text(playstyle.summary, color = TextMuted, fontSize = 11.sp, lineHeight = 16.sp)

      Spacer(Modifier.height(12.dp))
      Text("Finger Grip Layout", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
      Spacer(Modifier.height(6.dp))
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        GripType.entries.forEach { g ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = grip == g,
            onClick = { onChangeGrip(g) },
            label = { Text(g.label, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }

      Spacer(Modifier.height(8.dp))
      Text("Engagement Distance", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
      Spacer(Modifier.height(6.dp))
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        RangeBias.entries.forEach { r ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = rangeBias == r,
            onClick = { onChangeRangeBias(r) },
            label = { Text(r.label, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }
    }

    // 0-200 Sensitivity Matrix Sliders
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Sensitivity Matrix (0–200)", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
          Text("Calibrated for Free Fire OB44+ 200-point scale", color = TextMuted, fontSize = 11.sp)
        }
        TextButton(onClick = onResetRecommended) {
          Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(15.dp), tint = OrangeAccent)
          Spacer(Modifier.width(4.dp))
          Text("Reset", fontSize = 12.sp, color = OrangeAccent)
        }
      }

      Spacer(Modifier.height(8.dp))

      SensitivitySliderRow(
        label = "General",
        role = "Camera sweep & hipfire drag lift",
        value = sensitivity.general,
        recommended = calibration.sensitivity.general,
        onChange = { onUpdateSensitivity(sensitivity.copy(general = it)) },
      )
      SensitivitySliderRow(
        label = "Red Dot",
        role = "Iron-sight & reflex head lock",
        value = sensitivity.redDot,
        recommended = calibration.sensitivity.redDot,
        onChange = { onUpdateSensitivity(sensitivity.copy(redDot = it)) },
      )
      SensitivitySliderRow(
        label = "2x Scope",
        role = "Mid-range AR tracking",
        value = sensitivity.scope2x,
        recommended = calibration.sensitivity.scope2x,
        onChange = { onUpdateSensitivity(sensitivity.copy(scope2x = it)) },
      )
      SensitivitySliderRow(
        label = "4x Scope",
        role = "Long-range marksman & recoil pull",
        value = sensitivity.scope4x,
        recommended = calibration.sensitivity.scope4x,
        onChange = { onUpdateSensitivity(sensitivity.copy(scope4x = it)) },
      )
      SensitivitySliderRow(
        label = "Sniper Scope",
        role = "AWM / M82B quick-scope flick",
        value = sensitivity.sniperScope,
        recommended = calibration.sensitivity.sniperScope,
        onChange = { onUpdateSensitivity(sensitivity.copy(sniperScope = it)) },
      )
      SensitivitySliderRow(
        label = "Free Look",
        role = "360° parachute & perimeter scan",
        value = sensitivity.freeLook,
        recommended = calibration.sensitivity.freeLook,
        onChange = { onUpdateSensitivity(sensitivity.copy(freeLook = it)) },
      )

      HorizontalDivider(color = BorderSlate)
      Spacer(Modifier.height(10.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Text("Fire Button Size", color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 13.sp)
        Text(
          "$fireButtonSize%",
          color = TextPrimary,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Bold,
          fontSize = 14.sp,
        )
      }
      Slider(
        value = fireButtonSize.toFloat(),
        onValueChange = { onUpdateFireButton(it.roundToInt()) },
        valueRange = 32f..70f,
        colors = SliderDefaults.colors(
          thumbColor = OrangeAccent,
          activeTrackColor = OrangeAccent,
          inactiveTrackColor = BorderSlate,
        ),
      )
    }

    // Drag Acceleration Curve Visual
    PanelCard {
      Text("Chest-to-Head Drag Curve", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
      Text(
        "General (${sensitivity.general}) · Red Dot (${sensitivity.redDot})",
        color = TextMuted,
        fontSize = 11.sp,
      )
      Spacer(Modifier.height(10.dp))

      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(130.dp)
          .clip(RoundedCornerShape(10.dp))
          .background(BgObsidian)
          .border(1.dp, BorderSlate, RoundedCornerShape(10.dp))
          .padding(10.dp),
      ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
          val w = size.width
          val h = size.height
          val gNorm = sensitivity.general / 200f
          val rNorm = sensitivity.redDot / 200f

          drawRect(
            color = EmeraldAccent.copy(alpha = 0.1f),
            topLeft = Offset(0f, 4f),
            size = Size(w, h * 0.22f),
          )
          drawLine(
            color = BorderSlate,
            start = Offset(0f, h * 0.5f),
            end = Offset(w, h * 0.5f),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)),
          )
          drawLine(
            color = BorderSlate,
            start = Offset(0f, h - 8f),
            end = Offset(w, h - 8f),
          )

          val start = Offset(12f, h - 12f)
          val c1 = Offset(w * (0.35f - gNorm * 0.12f), h * (0.85f - rNorm * 0.25f))
          val c2 = Offset(w * (0.65f - gNorm * 0.08f), h * (0.35f - rNorm * 0.15f))
          val end = Offset(w - 14f, 14f + (1f - gNorm) * 26f)

          val curve = Path().apply {
            moveTo(start.x, start.y)
            cubicTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
          }
          drawPath(
            path = curve,
            color = OrangeAccent,
            style = Stroke(width = 6f, cap = StrokeCap.Round),
          )
          drawCircle(color = OrangeAccent, radius = 9f, center = end)
        }
      }

      Spacer(Modifier.height(10.dp))
      InfoRow("Technique", calibration.dragGuidance.preferredPattern)
      InfoRow("Swipe Timing", calibration.dragGuidance.swipeSpeed)
      InfoRow("Pointer Speed", calibration.pointerSpeed)
    }
  }

  if (showDpiDialog) {
    AlertDialog(
      onDismissRequest = { showDpiDialog = false },
      containerColor = SurfacePanel,
      title = { Text("How to Safely Set Android DPI", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold) },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("Safe Range: ${calibration.dpiSafeRange}", color = OrangeSoft, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
          Text("1. Open Settings → About phone → tap Build number 7 times to enable Developer options.", color = TextMuted, fontSize = 12.sp)
          Text("2. Go to Developer options → Drawing → Smallest width.", color = TextMuted, fontSize = 12.sp)
          Text("3. Note your stock value (${selectedDevice.defaultDpi} dp) before changing.", color = TextMuted, fontSize = 12.sp)
          Text("4. Set ${calibration.dpiValue} dp (never exceed 620 dp to keep Android UI usable).", color = TextMuted, fontSize = 12.sp)
        }
      },
      confirmButton = {
        TextButton(onClick = { showDpiDialog = false }) {
          Text("Got It", color = OrangeAccent)
        }
      },
    )
  }
}

@Composable
fun PerformanceScreen(
  device: DeviceSpec,
  calibration: CalibrationOutput,
  completedStepIds: Set<String>,
  onToggleStep: (String) -> Unit,
  onResetSteps: () -> Unit,
  notificationBlock: NotificationBlockSettings,
  onUpdateNotificationBlock: (NotificationBlockSettings) -> Unit,
  onCopyDndGuide: () -> Unit,
) {
  val context = LocalContext.current
  val checklist = remember(device) { buildOptimizationChecklist(device) }
  var categoryFilter by remember { mutableStateOf("All") }
  var resourceMode by remember(device.id) { mutableStateOf(if (device.ramGb <= 3) "low-ram" else "max-fps") }

  // Live Choreographer FPS Benchmark
  var isBenchmarking by remember { mutableStateOf(false) }
  var benchProgress by remember { mutableIntStateOf(0) }
  var measuredHz by remember { mutableIntStateOf(0) }
  var avgFrameMs by remember { mutableFloatStateOf(0f) }
  var stabilityPct by remember { mutableIntStateOf(0) }
  var hasBenchResult by remember { mutableStateOf(false) }

  if (isBenchmarking) {
    DisposableEffect(Unit) {
      val deltas = mutableListOf<Double>()
      var startNs = 0L
      var lastNs = 0L
      val durationNs = 2_800_000_000L
      val choreographer = Choreographer.getInstance()
      var active = true

      val callback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
          if (!active) return
          if (startNs == 0L) {
            startNs = frameTimeNanos
            lastNs = frameTimeNanos
            choreographer.postFrameCallback(this)
            return
          }
          val dtMs = (frameTimeNanos - lastNs) / 1_000_000.0
          lastNs = frameTimeNanos
          if (dtMs in 1.0..250.0) {
            deltas.add(dtMs)
          }
          val elapsed = frameTimeNanos - startNs
          benchProgress = ((elapsed.toDouble() / durationNs) * 100.0).roundToInt().coerceIn(0, 100)
          if (elapsed < durationNs) {
            choreographer.postFrameCallback(this)
          } else {
            isBenchmarking = false
            benchProgress = 100
            if (deltas.isNotEmpty()) {
              val avg = deltas.average()
              val sorted = deltas.sorted()
              val median = sorted[sorted.size / 2]
              val smooth = deltas.count { it <= median * 1.45 }
              measuredHz = (1000.0 / avg).roundToInt()
              avgFrameMs = ((avg * 100.0).roundToInt() / 100f)
              stabilityPct = ((smooth.toDouble() / deltas.size) * 100.0).roundToInt()
              hasBenchResult = true
            }
          }
        }
      }
      choreographer.postFrameCallback(callback)
      onDispose {
        active = false
        choreographer.removeFrameCallback(callback)
      }
    }
  }

  val filteredSteps = remember(checklist, categoryFilter) {
    if (categoryFilter == "All") checklist else checklist.filter { it.category == categoryFilter }
  }
  val doneCount = checklist.count { completedStepIds.contains(it.id) }
  val progress = if (checklist.isNotEmpty()) doneCount.toFloat() / checklist.size else 0f

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 16.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    // Recommended Graphics & FPS
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Recommended Graphics & FPS", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
          Text("${device.brand} ${device.model} · ${device.ramGb} GB RAM", color = TextMuted, fontSize = 12.sp)
        }
        Text(
          "${calibration.graphics.targetFps} FPS",
          color = EmeraldAccent,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Bold,
          fontSize = 14.sp,
        )
      }

      Spacer(Modifier.height(10.dp))

      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricBox(Modifier.weight(1f), "Graphics", calibration.graphics.display, OrangeSoft)
        MetricBox(Modifier.weight(1f), "High FPS", calibration.graphics.highFps)
        MetricBox(Modifier.weight(1f), "Shadow", calibration.graphics.shadow)
      }
      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricBox(Modifier.weight(1f), "High Res", calibration.graphics.highRes)
        MetricBox(Modifier.weight(1f), "Filter", calibration.graphics.filter)
        MetricBox(Modifier.weight(1f), "Auto Scale", calibration.graphics.autoScale, EmeraldAccent)
      }

      Spacer(Modifier.height(10.dp))
      Text(
        "Thermal Rationale: ${calibration.graphics.thermalNote}",
        color = TextMuted,
        fontSize = 12.sp,
        lineHeight = 17.sp,
      )
    }

    // Live Choreographer Frame-Pacing Check
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Live Frame-Pacing Check", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
          Text("Measures real display refresh & jitter via Android Choreographer", color = TextMuted, fontSize = 11.sp)
        }
        Icon(Icons.Rounded.Speed, contentDescription = null, tint = OrangeAccent)
      }

      Spacer(Modifier.height(10.dp))

      if (hasBenchResult) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          MetricBox(Modifier.weight(1f), "Measured Rate", "$measuredHz Hz", OrangeSoft)
          MetricBox(Modifier.weight(1f), "Frame Time", "$avgFrameMs ms")
          MetricBox(
            Modifier.weight(1f),
            "Stability",
            "$stabilityPct%",
            if (stabilityPct >= 90) EmeraldAccent else AmberAccent,
          )
        }
      } else {
        Surface(
          modifier = Modifier.fillMaxWidth(),
          color = BgObsidian,
          shape = RoundedCornerShape(10.dp),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Column(modifier = Modifier.padding(12.dp)) {
            Text(
              if (isBenchmarking) "Sampling real Choreographer frame timings... $benchProgress%"
              else "Run a 3-second live test to check if Battery Saver is capping your screen to 60 Hz.",
              color = TextMuted,
              fontSize = 12.sp,
            )
            if (isBenchmarking) {
              Spacer(Modifier.height(8.dp))
              LinearProgressIndicator(
                progress = { benchProgress / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = OrangeAccent,
                trackColor = BorderSlate,
              )
            }
          }
        }
      }

      Spacer(Modifier.height(10.dp))
      Button(
        onClick = {
          hasBenchResult = false
          benchProgress = 0
          isBenchmarking = true
        },
        enabled = !isBenchmarking,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
      ) {
        Icon(Icons.Rounded.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(if (isBenchmarking) "Measuring..." else "Run Live FPS & Jitter Test", fontWeight = FontWeight.SemiBold)
      }
    }

    // Battery & Resource + Android Settings Shortcuts
    PanelCard {
      Text("Battery & Resource Tuning", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("max-fps" to "Max FPS", "balanced-heat" to "Low-Heat", "low-ram" to "Low RAM").forEach { (id, label) ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = resourceMode == id,
            onClick = { resourceMode = id },
            label = { Text(label, fontSize = 11.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }
      Spacer(Modifier.height(8.dp))
      val bgLimit = if (resourceMode == "low-ram" || device.ramGb <= 3) "At most 1 process" else "At most 2–3 processes"
      val powerProfile = if (resourceMode == "max-fps") "High Performance · Battery Saver Off" else "Balanced · Charge Limit 80%"
      InfoRow("Background Process Limit", bgLimit)
      InfoRow("Power Mode", powerProfile)
      InfoRow("Free Fire App Battery", "Unrestricted (Doze Disabled)")

      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
          onClick = {
            val intent = Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            if (intent.resolveActivity(context.packageManager) != null) {
              context.startActivity(intent)
            } else {
              context.startActivity(Intent(Settings.ACTION_SETTINGS))
            }
          },
          modifier = Modifier.weight(1f),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Icon(Icons.Rounded.Settings, contentDescription = null, modifier = Modifier.size(15.dp), tint = OrangeAccent)
          Spacer(Modifier.width(4.dp))
          Text("Dev Options", fontSize = 12.sp, color = TextPrimary)
        }
        OutlinedButton(
          onClick = {
            val intent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
            if (intent.resolveActivity(context.packageManager) != null) {
              context.startActivity(intent)
            } else {
              context.startActivity(Intent(Settings.ACTION_SETTINGS))
            }
          },
          modifier = Modifier.weight(1f),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Text("Battery Settings", fontSize = 12.sp, color = TextPrimary)
        }
      }
    }

    // Notification Block & Game Focus
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
          Icon(Icons.Rounded.NotificationsOff, contentDescription = null, tint = OrangeAccent, modifier = Modifier.size(18.dp))
          Spacer(Modifier.width(8.dp))
          Column {
            Text("Notification Block & DND", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("Keep pop-ups from breaking upward drags", color = TextMuted, fontSize = 11.sp)
          }
        }
        Switch(
          checked = notificationBlock.enabled,
          onCheckedChange = { onUpdateNotificationBlock(notificationBlock.copy(enabled = it)) },
          colors = SwitchDefaults.colors(checkedThumbColor = BgObsidian, checkedTrackColor = EmeraldAccent),
        )
      }

      Spacer(Modifier.height(8.dp))
      ToggleRow("Block Heads-Up Banners", notificationBlock.enabled && notificationBlock.blockHeadsUp) {
        onUpdateNotificationBlock(notificationBlock.copy(enabled = true, blockHeadsUp = it))
      }
      ToggleRow("Block Call Pop-Up Overlay", notificationBlock.enabled && notificationBlock.blockCalls) {
        onUpdateNotificationBlock(notificationBlock.copy(enabled = true, blockCalls = it))
      }
      ToggleRow("Block Floating Chat Bubbles", notificationBlock.enabled && notificationBlock.blockFloatingBubbles) {
        onUpdateNotificationBlock(notificationBlock.copy(enabled = true, blockFloatingBubbles = it))
      }

      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
          onClick = onCopyDndGuide,
          modifier = Modifier.weight(1f),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Text("Copy DND Guide", fontSize = 12.sp, color = TextPrimary)
        }
        OutlinedButton(
          onClick = {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
            if (intent.resolveActivity(context.packageManager) != null) {
              context.startActivity(intent)
            } else {
              context.startActivity(Intent(Settings.ACTION_SOUND_SETTINGS))
            }
          },
          modifier = Modifier.weight(1f),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Text("Open DND Settings", fontSize = 12.sp, color = TextPrimary)
        }
      }
    }

    // Optimization Checklist
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Performance Boost Checklist", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
          Text("$doneCount / ${checklist.size} applied", color = EmeraldAccent, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        }
        if (doneCount > 0) {
          TextButton(onClick = onResetSteps) {
            Text("Clear", fontSize = 12.sp, color = TextMuted)
          }
        }
      }

      Spacer(Modifier.height(6.dp))
      LinearProgressIndicator(
        progress = { progress },
        modifier = Modifier.fillMaxWidth(),
        color = EmeraldAccent,
        trackColor = BorderSlate,
      )

      Spacer(Modifier.height(8.dp))
      Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        listOf("All", "In-Game Options", "Display & Touch", "Memory & CPU", "Thermal & Battery").forEach { cat ->
          FilterChip(
            selected = categoryFilter == cat,
            onClick = { categoryFilter = cat },
            label = { Text(cat, fontSize = 11.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }

      Spacer(Modifier.height(8.dp))
      filteredSteps.forEachIndexed { idx, step ->
        val done = completedStepIds.contains(step.id)
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggleStep(step.id) }
            .padding(vertical = 8.dp),
          verticalAlignment = Alignment.Top,
        ) {
          Checkbox(
            checked = done,
            onCheckedChange = { onToggleStep(step.id) },
            colors = CheckboxDefaults.colors(checkedColor = EmeraldAccent, checkmarkColor = BgObsidian),
          )
          Column(modifier = Modifier.weight(1f)) {
            Text(
              step.title,
              color = if (done) TextMuted else TextPrimary,
              fontSize = 13.sp,
              fontWeight = FontWeight.SemiBold,
              textDecoration = if (done) TextDecoration.LineThrough else TextDecoration.None,
            )
            Text(step.settingValue, color = OrangeSoft, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            Text(step.description, color = TextMuted, fontSize = 11.sp, lineHeight = 16.sp)
          }
        }
        if (idx < filteredSteps.lastIndex) {
          HorizontalDivider(color = BorderSlate.copy(alpha = 0.6f))
        }
      }
    }
  }
}

private data class LabWeapon(
  val id: String,
  val name: String,
  val category: String,
  val idealSpeedMin: Int,
  val idealSpeedMax: Int,
  val idealLiftMin: Int,
  val idealLiftMax: Int,
  val technique: String,
)

private val LAB_WEAPONS = listOf(
  LabWeapon("m1887", "M1887", "Shotgun · One-Tap", 650, 1650, 75, 190, "Fast J-Drag or straight upward flick, then quick weapon switch."),
  LabWeapon("deagle", "Desert Eagle", "Pistol · One-Tap", 580, 1450, 70, 175, "Start crosshair below chest, flick straight up at ~90°."),
  LabWeapon("mp40", "MP40", "SMG · Continuous", 420, 1150, 85, 200, "Steady upward pull over 180-250ms to ride spread into head."),
  LabWeapon("woodpecker", "Woodpecker", "Marksman · Snap", 500, 1300, 60, 160, "Controlled medium drag; avoid over-flicking past the crown."),
  LabWeapon("scar", "SCAR", "AR · Mid Drag", 380, 1080, 75, 180, "Short 3-4 round burst while holding steady upward drag."),
)

@Composable
fun DragLabScreen(
  sensitivity: SensitivityValues,
  fireButtonSize: Int,
) {
  var weaponIndex by remember { mutableIntStateOf(0) }
  var targetMotion by remember { mutableStateOf("standing") }
  var rangeMode by remember { mutableStateOf("mid") }
  var headshots by remember { mutableIntStateOf(0) }
  var bodyLocks by remember { mutableIntStateOf(0) }
  var overshoots by remember { mutableIntStateOf(0) }
  var misses by remember { mutableIntStateOf(0) }

  var lastOutcome by remember { mutableStateOf<String?>(null) }
  var lastVelocity by remember { mutableIntStateOf(0) }
  var lastAngle by remember { mutableIntStateOf(0) }
  var lastLift by remember { mutableIntStateOf(0) }
  var lastAdvice by remember { mutableStateOf("") }

  val trailPoints = remember { mutableStateListOf<Offset>() }
  var dragStartMs by remember { mutableLongStateOf(0L) }
  var isDragging by remember { mutableStateOf(false) }
  var canvasSize by remember { mutableStateOf(IntSize(640, 380)) }

  var animTick by remember { mutableFloatStateOf(0f) }
  LaunchedEffect(targetMotion) {
    while (true) {
      delay(16L)
      animTick += 0.016f
    }
  }

  val weapon = LAB_WEAPONS[weaponIndex]
  val totalDrills = headshots + bodyLocks + overshoots + misses
  val hsRate = if (totalDrills > 0) ((headshots.toFloat() / totalDrills) * 100f).roundToInt() else 0

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 16.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("Drag Headshot Practice Lab", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Text(
            "General ${sensitivity.general} · Fire Button $fireButtonSize%",
            color = TextMuted,
            fontSize = 12.sp,
          )
        }
        Column(horizontalAlignment = Alignment.End) {
          Text("$hsRate%", color = EmeraldAccent, fontSize = 20.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
          Text("$totalDrills drills", color = TextMuted, fontSize = 11.sp)
        }
      }

      Spacer(Modifier.height(10.dp))
      Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        LAB_WEAPONS.forEachIndexed { idx, w ->
          FilterChip(
            selected = weaponIndex == idx,
            onClick = { weaponIndex = idx },
            label = { Text(w.name, fontSize = 12.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }

      Spacer(Modifier.height(8.dp))

      // Interactive Drag Canvas
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(260.dp)
          .clip(RoundedCornerShape(10.dp))
          .background(Color(0xFF090C12))
          .border(1.dp, BorderSlate, RoundedCornerShape(10.dp))
          .onSizeChanged { canvasSize = it }
          .pointerInput(weaponIndex, targetMotion, rangeMode, sensitivity.general) {
            detectDragGestures(
              onDragStart = { offset ->
                isDragging = true
                dragStartMs = System.currentTimeMillis()
                trailPoints.clear()
                trailPoints.add(offset)
              },
              onDrag = { change, _ ->
                change.consume()
                trailPoints.add(change.position)
              },
              onDragEnd = {
                isDragging = false
                if (trailPoints.size < 2) {
                  lastOutcome = "MISS"
                  lastVelocity = 0
                  lastAngle = 0
                  lastLift = 0
                  lastAdvice = "Swipe upward smoothly from the DRAG UP zone."
                  misses++
                  return@detectDragGestures
                }
                val start = trailPoints.first()
                val end = trailPoints.last()
                val dx = end.x - start.x
                val dy = start.y - end.y
                val durSec = max(0.03f, (System.currentTimeMillis() - dragStartMs) / 1000f)
                val dist = hypot(dx.toDouble(), dy.toDouble()).toFloat()
                val velocity = (dist / durSec).roundToInt()
                val angle = ((atan2(dy.toDouble(), kotlin.math.abs(dx).toDouble() + 0.001) * 180.0) / Math.PI).roundToInt()
                val scaleNorm = 380f / max(200f, canvasSize.height.toFloat())
                val liftScaled = (dy * scaleNorm).roundToInt()
                val velScaled = (velocity * scaleNorm).roundToInt()
                val sensFactor = 0.65f + (sensitivity.general / 200f) * 0.6f
                val effectiveLift = (liftScaled * sensFactor).roundToInt()

                if (liftScaled < 20 || angle < 38) {
                  lastOutcome = "MISS"
                  lastAdvice = "Drag direction was too short or horizontal. Pull cleanly upward."
                  misses++
                } else if (effectiveLift < weapon.idealLiftMin || velScaled < weapon.idealSpeedMin) {
                  lastOutcome = "BODY LOCK"
                  lastAdvice = "Swipe speed was slightly slow for ${weapon.name}. Flick faster or raise General +8."
                  bodyLocks++
                } else if (effectiveLift > weapon.idealLiftMax || velScaled > weapon.idealSpeedMax) {
                  lastOutcome = "OVERSHOOT"
                  lastAdvice = "Flick passed above the head hitbox. Shorten swipe or lower Red Dot -6."
                  overshoots++
                } else {
                  lastOutcome = "HEADSHOT"
                  lastAdvice = "Clean head lock at ${angle}°! Repeat this drag rhythm."
                  headshots++
                }
                lastVelocity = velScaled
                lastAngle = max(0, angle)
                lastLift = liftScaled
              },
              onDragCancel = {
                isDragging = false
              },
            )
          },
      ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
          val w = size.width
          val h = size.height
          val scale = when (rangeMode) { "close" -> 1.15f; "long" -> 0.72f; else -> 0.92f }
          val targetX =
            if (targetMotion == "strafing") w * (0.42f + 0.16f * sin(animTick * 2.1f))
            else w * 0.42f
          val crouchOffset =
            if (targetMotion == "crouch" && sin(animTick * 2.8f) > 0.15f) 28f else 0f

          val baseY = h * 0.56f
          val headR = 22f * scale
          val headY = baseY - 82f * scale + crouchOffset
          val chestY = baseY - 30f * scale + crouchOffset
          val chestW = 54f * scale
          val chestH = 74f * scale

          // Horizon
          drawLine(
            color = OrangeAccent.copy(alpha = 0.25f),
            start = Offset(0f, h * 0.65f),
            end = Offset(w, h * 0.65f),
          )

          // Target Chest
          drawRoundRect(
            color = Color(0xFF334155),
            topLeft = Offset(targetX - chestW / 2f, chestY),
            size = Size(chestW, chestH),
            cornerRadius = CornerRadius(12f, 12f),
          )
          // Target Head
          drawCircle(
            color = OrangeAccent.copy(alpha = 0.24f),
            radius = headR,
            center = Offset(targetX, headY),
          )
          drawCircle(
            color = OrangeAccent,
            radius = headR,
            center = Offset(targetX, headY),
            style = Stroke(width = 4f),
          )
          // Chest Crosshair
          drawCircle(
            color = Color.White.copy(alpha = 0.6f),
            radius = 12f,
            center = Offset(targetX, chestY + chestH * 0.35f),
            style = Stroke(width = 3f),
          )

          // Fire Button Zone
          val fbRadius = (fireButtonSize * 1.0f).coerceIn(36f, 64f)
          val fbCenter = Offset(w - 86f, h - 78f)
          drawCircle(
            color = OrangeAccent.copy(alpha = if (isDragging) 0.35f else 0.16f),
            radius = fbRadius,
            center = fbCenter,
          )
          drawCircle(
            color = OrangeAccent,
            radius = fbRadius,
            center = fbCenter,
            style = Stroke(width = 4f),
          )

          // Drag Trail
          if (trailPoints.size > 1) {
            val trail = Path().apply {
              moveTo(trailPoints.first().x, trailPoints.first().y)
              for (i in 1 until trailPoints.size) {
                lineTo(trailPoints[i].x, trailPoints[i].y)
              }
            }
            drawPath(
              path = trail,
              color = OrangeSoft,
              style = Stroke(width = 6f, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
          }
        }

        Text(
          "SWIPE UP HERE",
          color = OrangeSoft,
          fontSize = 10.sp,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Bold,
          modifier = Modifier
            .align(Alignment.BottomEnd)
            .padding(end = 12.dp, bottom = 8.dp),
        )
      }

      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("standing" to "Standing", "strafing" to "Strafing", "crouch" to "Crouch-Peek").forEach { (id, label) ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = targetMotion == id,
            onClick = { targetMotion = id },
            label = { Text(label, fontSize = 11.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = SurfaceElevated,
              selectedLabelColor = TextPrimary,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("close" to "8m", "mid" to "22m", "long" to "40m").forEach { (id, label) ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = rangeMode == id,
            onClick = { rangeMode = id },
            label = { Text(label, fontSize = 11.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = SurfaceElevated,
              selectedLabelColor = TextPrimary,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }
    }

    // Shot Diagnostics
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column {
          Text("${weapon.name} Diagnostics", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
          Text(weapon.category, color = TextMuted, fontSize = 11.sp)
        }
        TextButton(
          onClick = {
            headshots = 0; bodyLocks = 0; overshoots = 0; misses = 0; lastOutcome = null; trailPoints.clear()
          },
        ) {
          Text("Reset", color = TextMuted, fontSize = 12.sp)
        }
      }

      Spacer(Modifier.height(8.dp))
      if (lastOutcome != null) {
        val outcomeColor = when (lastOutcome) {
          "HEADSHOT" -> EmeraldAccent
          "BODY LOCK" -> AmberAccent
          "OVERSHOOT" -> RoseAccent
          else -> TextMuted
        }
        Text(
          lastOutcome!!,
          color = outcomeColor,
          fontSize = 18.sp,
          fontWeight = FontWeight.Bold,
          fontFamily = FontFamily.Monospace,
        )
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          MetricBox(Modifier.weight(1f), "Velocity", "$lastVelocity px/s")
          MetricBox(Modifier.weight(1f), "Angle", "$lastAngle°")
          MetricBox(Modifier.weight(1f), "Lift", "$lastLift px")
        }
        Spacer(Modifier.height(8.dp))
        Text(lastAdvice, color = TextPrimary, fontSize = 12.sp, lineHeight = 17.sp)
      } else {
        Text(
          "Touch the orange fire circle on the simulator and swipe swiftly upward. Technique: ${weapon.technique}",
          color = TextMuted,
          fontSize = 12.sp,
          lineHeight = 17.sp,
        )
      }

      Spacer(Modifier.height(10.dp))
      HorizontalDivider(color = BorderSlate)
      Spacer(Modifier.height(10.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        TallyBadge("Head", headshots, EmeraldAccent)
        TallyBadge("Body", bodyLocks, AmberAccent)
        TallyBadge("Over", overshoots, RoseAccent)
        TallyBadge("Miss", misses, TextMuted)
      }
    }
  }
}

@Composable
fun SavedPresetsScreen(
  profiles: List<SavedProfile>,
  onLoadProfile: (SavedProfile) -> Unit,
  onCopyProfile: (SavedProfile) -> Unit,
  onDeleteProfile: (String) -> Unit,
) {
  if (profiles.isEmpty()) {
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(24.dp),
      contentAlignment = Alignment.Center,
    ) {
      PanelCard {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          Icon(Icons.Rounded.Bookmark, contentDescription = null, tint = OrangeAccent, modifier = Modifier.size(36.dp))
          Spacer(Modifier.height(10.dp))
          Text("No Saved Presets Yet", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Spacer(Modifier.height(6.dp))
          Text(
            "Select your device in Sensitivity & DPI, tune your sliders, and tap Save Preset to store configurations offline on your phone.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 18.sp,
          )
        }
      }
    }
    return
  }

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    items(profiles, key = { it.id }) { profile ->
      PanelCard {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.Top,
        ) {
          Column(modifier = Modifier.weight(1f)) {
            Text(profile.name, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(
              "${profile.deviceLabel} · ${profile.ramGb} GB · ${profile.refreshHz} Hz · ${profile.graphicsDisplay}",
              color = TextMuted,
              fontSize = 11.sp,
            )
          }
          Row {
            IconButton(onClick = { onCopyProfile(profile) }) {
              Icon(Icons.Rounded.ContentCopy, contentDescription = "Copy preset", tint = TextMuted, modifier = Modifier.size(18.dp))
            }
            IconButton(onClick = { onDeleteProfile(profile.id) }) {
              Icon(Icons.Rounded.Delete, contentDescription = "Delete preset", tint = RoseAccent, modifier = Modifier.size(18.dp))
            }
          }
        }

        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          MetricBox(Modifier.weight(1f), "Gen", "${profile.sensitivity.general}", OrangeSoft)
          MetricBox(Modifier.weight(1f), "Red Dot", "${profile.sensitivity.redDot}")
          MetricBox(Modifier.weight(1f), "2x", "${profile.sensitivity.scope2x}")
          MetricBox(Modifier.weight(1f), "Fire", "${profile.fireButtonSize}%")
        }

        Spacer(Modifier.height(10.dp))
        Button(
          onClick = { onLoadProfile(profile) },
          modifier = Modifier.fillMaxWidth(),
          colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated, contentColor = TextPrimary),
        ) {
          Text("Load Into Calibration Studio", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
      }
    }
  }
}

@Composable
fun CustomDeviceDialog(
  onDismiss: () -> Unit,
  onSave: (DeviceSpec) -> Unit,
) {
  var brand by remember { mutableStateOf("Custom") }
  var model by remember { mutableStateOf("") }
  var ramGb by remember { mutableIntStateOf(6) }
  var refreshHz by remember { mutableIntStateOf(90) }
  var defaultDpiText by remember { mutableStateOf("392") }

  AlertDialog(
    onDismissRequest = onDismiss,
    containerColor = SurfacePanel,
    title = { Text("Add Custom Device", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold) },
    text = {
      Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        OutlinedTextField(
          value = brand,
          onValueChange = { brand = it },
          label = { Text("Brand", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = model,
          onValueChange = { model = it },
          label = { Text("Model Name", fontSize = 12.sp) },
          placeholder = { Text("e.g. Moto G54 / Poco X6", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Text("RAM: $ramGb GB", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          listOf(2, 3, 4, 6, 8, 12, 16).forEach { gb ->
            FilterChip(
              selected = ramGb == gb,
              onClick = { ramGb = gb },
              label = { Text("${gb}GB", fontSize = 11.sp) },
            )
          }
        }
        Text("Refresh Rate: $refreshHz Hz", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          listOf(60, 90, 120, 144, 165).forEach { hz ->
            FilterChip(
              selected = refreshHz == hz,
              onClick = { refreshHz = hz },
              label = { Text("${hz}Hz", fontSize = 11.sp) },
            )
          }
        }
        OutlinedTextField(
          value = defaultDpiText,
          onValueChange = { v ->
            val filtered = v.filter { it.isDigit() }.take(3)
            defaultDpiText = filtered
          },
          label = { Text("Stock Smallest Width DPI", fontSize = 12.sp) },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
      }
    },
    confirmButton = {
      Button(
        onClick = {
          val parsedDpi = (defaultDpiText.toIntOrNull() ?: 392).coerceIn(280, 600)
          val cleanModel = model.trim().ifEmpty { "${ramGb}GB ${refreshHz}Hz Device" }
          val tier = when {
            ramGb <= 3 -> DeviceTier.LOW
            ramGb <= 6 -> DeviceTier.MID
            refreshHz >= 144 -> DeviceTier.GAMING
            else -> DeviceTier.HIGH
          }
          val recDpi = min(600, max(430, parsedDpi + if (ramGb <= 3) 85 else 145))
          onSave(
            DeviceSpec(
              id = "custom-${System.currentTimeMillis()}",
              brand = brand.trim().ifEmpty { "Custom" },
              model = cleanModel,
              tier = tier,
              os = OperatingSystem.ANDROID,
              ramGb = ramGb,
              refreshHz = refreshHz,
              touchSamplingHz = if (refreshHz >= 144) 360 else if (refreshHz >= 90) 240 else 120,
              screenInches = 6.6,
              chipset = "${ramGb}GB Android SoC",
              defaultDpi = parsedDpi,
              recommendedDpi = recDpi,
              thermalHeadroom = if (ramGb <= 3) "Tight" else if (ramGb <= 6) "Moderate" else "High",
              isCustom = true,
            )
          )
        },
        colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
      ) {
        Text("Calculate Calibration", fontWeight = FontWeight.SemiBold)
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("Cancel", color = TextMuted)
      }
    },
  )
}

@Composable
fun LaunchGameDialog(
  device: DeviceSpec,
  playstyle: PlaystyleId,
  calibration: CalibrationOutput,
  sensitivity: SensitivityValues,
  fireButtonSize: Int,
  appliedStepsCount: Int,
  onCopySetup: () -> Unit,
  onLaunchPackage: (String, String) -> Unit,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    containerColor = SurfacePanel,
    title = {
      Column {
        Text("ALL SETTINGS APPLIED", color = EmeraldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text("Ready to Launch Free Fire", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
          "${device.brand} ${device.model} · ${playstyle.title} · $appliedStepsCount steps active",
          color = TextMuted,
          fontSize = 11.sp,
        )
      }
    },
    text = {
      Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          MetricBox(Modifier.weight(1f), "General", "${sensitivity.general}", OrangeSoft)
          MetricBox(Modifier.weight(1f), "Red Dot", "${sensitivity.redDot}")
          MetricBox(Modifier.weight(1f), "2x", "${sensitivity.scope2x}")
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          MetricBox(Modifier.weight(1f), "4x", "${sensitivity.scope4x}")
          MetricBox(Modifier.weight(1f), "Fire %", "$fireButtonSize%")
          MetricBox(Modifier.weight(1f), "DPI", "${calibration.dpiValue}")
        }
        Text(
          "Your calibrated values have been copied to the Android clipboard. Launch Free Fire or Free Fire MAX below:",
          color = TextMuted,
          fontSize = 12.sp,
          lineHeight = 17.sp,
        )
        Button(
          onClick = { onLaunchPackage("com.dts.freefireth", "Free Fire") },
          modifier = Modifier.fillMaxWidth(),
          colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated, contentColor = OrangeSoft),
        ) {
          Icon(Icons.Rounded.TrackChanges, contentDescription = null, modifier = Modifier.size(16.dp))
          Spacer(Modifier.width(6.dp))
          Text("Launch Free Fire", fontWeight = FontWeight.SemiBold)
        }
        Button(
          onClick = { onLaunchPackage("com.dts.freefiremax", "Free Fire MAX") },
          modifier = Modifier.fillMaxWidth(),
          colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
        ) {
          Icon(Icons.Rounded.RocketLaunch, contentDescription = null, modifier = Modifier.size(16.dp))
          Spacer(Modifier.width(6.dp))
          Text("Launch Free Fire MAX", fontWeight = FontWeight.SemiBold)
        }
      }
    },
    confirmButton = {
      TextButton(onClick = onDismiss) {
        Text("Done", color = TextMuted)
      }
    },
    dismissButton = {
      TextButton(onClick = onCopySetup) {
        Text("Copy Again", color = OrangeAccent)
      }
    },
  )
}

@Composable
private fun PanelCard(content: @Composable () -> Unit) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    colors = CardDefaults.cardColors(containerColor = SurfacePanel),
    border = BorderStroke(1.dp, BorderSlate),
  ) {
    Column(modifier = Modifier.padding(14.dp)) {
      content()
    }
  }
}

@Composable
private fun MetricBox(
  modifier: Modifier = Modifier,
  label: String,
  value: String,
  valueColor: Color = TextPrimary,
  sub: String? = null,
  onInfoClick: (() -> Unit)? = null,
) {
  Surface(
    modifier = modifier,
    color = BgObsidian,
    shape = RoundedCornerShape(10.dp),
    border = BorderStroke(1.dp, BorderSlate),
  ) {
    Column(modifier = Modifier.padding(10.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(label, color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (onInfoClick != null) {
          Icon(
            Icons.Rounded.Info,
            contentDescription = "Info",
            tint = OrangeAccent,
            modifier = Modifier
              .size(15.dp)
              .clickable { onInfoClick() },
          )
        }
      }
      Spacer(Modifier.height(2.dp))
      Text(
        value,
        color = valueColor,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      if (sub != null) {
        Text(sub, color = TextMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
  }
}

@Composable
private fun SensitivitySliderRow(
  label: String,
  role: String,
  value: Int,
  recommended: Int,
  onChange: (Int) -> Unit,
) {
  Column(modifier = Modifier.padding(vertical = 4.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(label, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Text(role, color = TextMuted, fontSize = 11.sp)
      }
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (value != recommended) {
          Text("Rec $recommended", color = TextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        Text(
          "$value",
          color = OrangeSoft,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Bold,
          fontSize = 16.sp,
        )
      }
    }
    Slider(
      value = value.toFloat(),
      onValueChange = { onChange(it.roundToInt().coerceIn(0, 200)) },
      valueRange = 0f..200f,
      colors = SliderDefaults.colors(
        thumbColor = OrangeAccent,
        activeTrackColor = OrangeAccent,
        inactiveTrackColor = BorderSlate,
      ),
    )
  }
}

@Composable
private fun InfoRow(label: String, value: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Text(label, color = TextMuted, fontSize = 11.sp, modifier = Modifier.weight(0.4f))
    Text(value, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(0.6f))
  }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clickable { onCheckedChange(!checked) }
      .padding(vertical = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(label, color = TextPrimary, fontSize = 12.sp)
    Text(
      if (checked) "BLOCKED" else "ALLOW",
      color = if (checked) EmeraldAccent else TextMuted,
      fontFamily = FontFamily.Monospace,
      fontWeight = FontWeight.Bold,
      fontSize = 11.sp,
    )
  }
}

@Composable
private fun TallyBadge(label: String, count: Int, color: Color) {
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(label, color = TextMuted, fontSize = 11.sp)
    Text(
      "$count",
      color = color,
      fontFamily = FontFamily.Monospace,
      fontWeight = FontWeight.Bold,
      fontSize = 16.sp,
    )
  }
}

private enum class AuthTabMode(val label: String) {
  USER("User Login"),
  REQUEST("Request Login"),
  ADMIN("Admin Login"),
}

@Composable
fun BrandLogoMark(large: Boolean = false) {
  val boxSize = if (large) 44.dp else 30.dp
  val corner = if (large) 11.dp else 8.dp
  val textSize = if (large) 28.sp else 18.sp

  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(if (large) 10.dp else 8.dp),
  ) {
    Surface(
      modifier = Modifier.size(boxSize),
      color = SurfaceElevated,
      shape = RoundedCornerShape(corner),
      border = BorderStroke(1.dp, OrangeAccent.copy(alpha = 0.5f)),
    ) {
      Canvas(modifier = Modifier.fillMaxSize().padding(if (large) 7.dp else 5.dp)) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val r = size.minDimension * 0.38f
        val strokePx = if (large) 4.2f else 3f
        drawCircle(
          color = OrangeAccent,
          radius = r,
          center = Offset(cx, cy),
          style = Stroke(width = strokePx),
        )
        drawLine(OrangeAccent, Offset(cx, 0f), Offset(cx, size.height * 0.2f), strokeWidth = strokePx, cap = StrokeCap.Round)
        drawLine(OrangeAccent, Offset(cx, size.height * 0.8f), Offset(cx, size.height), strokeWidth = strokePx, cap = StrokeCap.Round)
        drawLine(OrangeAccent, Offset(0f, cy), Offset(size.width * 0.2f, cy), strokeWidth = strokePx, cap = StrokeCap.Round)
        drawLine(OrangeAccent, Offset(size.width * 0.8f, cy), Offset(size.width, cy), strokeWidth = strokePx, cap = StrokeCap.Round)
        drawCircle(color = TextPrimary, radius = size.minDimension * 0.11f, center = Offset(cx, cy))
      }
    }
    Text(
      text = buildAnnotatedString {
        withStyle(SpanStyle(color = TextPrimary, fontWeight = FontWeight.ExtraBold)) {
          append("FF ")
        }
        withStyle(SpanStyle(color = OrangeAccent, fontWeight = FontWeight.ExtraBold)) {
          append("TUNE")
        }
      },
      fontSize = textSize,
      letterSpacing = if (large) 2.sp else 1.2.sp,
    )
  }
}

@Composable
fun AuthGateScreen(
  devices: List<DeviceSpec>,
  adminConfigured: Boolean,
  onUserLogin: (identifier: String, password: String) -> String?,
  onRequestLogin: (
    email: String,
    customId: String,
    displayName: String,
    password: String,
    deviceId: String,
    note: String,
  ) -> Pair<String?, String?>,
  onAdminClaim: (adminId: String, password: String) -> String?,
  onAdminLogin: (adminId: String, password: String) -> String?,
) {
  var tab by remember { mutableStateOf(AuthTabMode.USER) }
  var email by remember { mutableStateOf("") }
  var customId by remember { mutableStateOf("") }
  var displayName by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var confirmPassword by remember { mutableStateOf("") }
  var selectedDeviceId by remember { mutableStateOf("samsung-a54") }
  var note by remember { mutableStateOf("") }
  var showPassword by remember { mutableStateOf(false) }
  var showDevicePicker by remember { mutableStateOf(false) }
  var errorMsg by remember { mutableStateOf<String?>(null) }
  var statusMsg by remember { mutableStateOf<String?>(null) }

  val isFirstRunAdminClaim = tab == AuthTabMode.ADMIN && !adminConfigured
  val selectedDeviceObj = remember(devices, selectedDeviceId) {
    devices.find { it.id == selectedDeviceId } ?: devices.first()
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(BgObsidian)
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 20.dp, vertical = 28.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    BrandLogoMark(large = true)
    Spacer(Modifier.height(6.dp))
    Text(
      text = "Free Fire Sensitivity, DPI & Calibration Studio",
      color = TextMuted,
      fontSize = 12.sp,
    )
    Spacer(Modifier.height(20.dp))

    PanelCard {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clip(RoundedCornerShape(10.dp))
          .background(BgObsidian)
          .border(1.dp, BorderSlate, RoundedCornerShape(10.dp))
          .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        AuthTabMode.entries.forEach { mode ->
          val active = tab == mode
          Surface(
            modifier = Modifier
              .weight(1f)
              .clickable {
                tab = mode
                errorMsg = null
                statusMsg = null
                password = ""
                confirmPassword = ""
                if (mode == AuthTabMode.ADMIN) customId = ""
              },
            color = if (active) OrangeAccent else Color.Transparent,
            shape = RoundedCornerShape(8.dp),
          ) {
            Row(
              modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
              horizontalArrangement = Arrangement.Center,
              verticalAlignment = Alignment.CenterVertically,
            ) {
              val icon = when (mode) {
                AuthTabMode.USER -> Icons.Rounded.Person
                AuthTabMode.REQUEST -> Icons.Rounded.Email
                AuthTabMode.ADMIN -> Icons.Rounded.Shield
              }
              Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = if (active) BgObsidian else TextMuted,
              )
              Spacer(Modifier.width(4.dp))
              Text(
                mode.label,
                color = if (active) BgObsidian else TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
              )
            }
          }
        }
      }

      Spacer(Modifier.height(14.dp))

      when {
        isFirstRunAdminClaim -> {
          Text("First-Run Admin Setup", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Text(
            "Claim your Admin ID and password once to review Mail ID login requests and grant user access.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
          )
        }
        tab == AuthTabMode.REQUEST -> {
          Text("Request Login Access with Mail ID", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Text(
            "Enter your Email ID, password, and Samsung/target phone model. Admin will grant your app access.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
          )
        }
        tab == AuthTabMode.ADMIN -> {
          Text("Administrator Sign In", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Text(
            "Sign in with your Admin ID and password to grant access to Mail ID requests.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
          )
        }
        else -> {
          Text("User Sign In", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
          Text(
            "Sign in with your approved Email ID (or User ID) and password.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 17.sp,
          )
        }
      }

      if (errorMsg != null) {
        Spacer(Modifier.height(10.dp))
        Surface(
          modifier = Modifier.fillMaxWidth(),
          color = RoseAccent.copy(alpha = 0.14f),
          shape = RoundedCornerShape(8.dp),
          border = BorderStroke(1.dp, RoseAccent.copy(alpha = 0.5f)),
        ) {
          Text(
            errorMsg ?: "",
            color = RoseAccent,
            fontSize = 12.sp,
            modifier = Modifier.padding(10.dp),
          )
        }
      }

      if (statusMsg != null) {
        Spacer(Modifier.height(10.dp))
        Surface(
          modifier = Modifier.fillMaxWidth(),
          color = EmeraldAccent.copy(alpha = 0.14f),
          shape = RoundedCornerShape(8.dp),
          border = BorderStroke(1.dp, EmeraldAccent.copy(alpha = 0.5f)),
        ) {
          Text(
            statusMsg ?: "",
            color = EmeraldAccent,
            fontSize = 12.sp,
            modifier = Modifier.padding(10.dp),
          )
        }
      }

      Spacer(Modifier.height(12.dp))

      if (tab == AuthTabMode.REQUEST) {
        OutlinedTextField(
          value = email,
          onValueChange = { email = it },
          label = { Text("Email ID", fontSize = 12.sp) },
          placeholder = { Text("player@gmail.com", fontSize = 12.sp) },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Player Name", fontSize = 12.sp) },
            placeholder = { Text("Nickname", fontSize = 12.sp) },
            singleLine = true,
            modifier = Modifier.weight(1f),
          )
          OutlinedTextField(
            value = customId,
            onValueChange = { customId = it },
            label = { Text("User ID (Opt)", fontSize = 12.sp) },
            placeholder = { Text("Auto", fontSize = 12.sp) },
            singleLine = true,
            modifier = Modifier.weight(1f),
          )
        }
        Spacer(Modifier.height(8.dp))
        Text("Your Device", color = TextMuted, fontSize = 11.sp)
        Spacer(Modifier.height(4.dp))
        OutlinedButton(
          onClick = { showDevicePicker = true },
          modifier = Modifier.fillMaxWidth(),
          border = BorderStroke(1.dp, BorderSlate),
        ) {
          Icon(Icons.Rounded.PhoneAndroid, contentDescription = null, modifier = Modifier.size(16.dp), tint = OrangeAccent)
          Spacer(Modifier.width(6.dp))
          Text(
            "${selectedDeviceObj.brand} ${selectedDeviceObj.model}",
            color = TextPrimary,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
          )
        }
        Spacer(Modifier.height(8.dp))
      } else {
        OutlinedTextField(
          value = customId,
          onValueChange = { customId = it },
          label = {
            Text(
              if (tab == AuthTabMode.ADMIN) "Admin ID" else "Email ID or User ID",
              fontSize = 12.sp,
            )
          },
          placeholder = {
            Text(
              when {
                isFirstRunAdminClaim -> "Choose Admin ID (e.g. admin)"
                tab == AuthTabMode.ADMIN -> "Enter Admin ID"
                else -> "player@gmail.com or user_id"
              },
              fontSize = 12.sp,
            )
          },
          keyboardOptions = KeyboardOptions(
            keyboardType = if (tab == AuthTabMode.USER) KeyboardType.Email else KeyboardType.Text
          ),
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
      }

      OutlinedTextField(
        value = password,
        onValueChange = { password = it },
        label = { Text("Password", fontSize = 12.sp) },
        placeholder = {
          Text(
            when {
              isFirstRunAdminClaim -> "Minimum 6 characters"
              tab == AuthTabMode.REQUEST -> "Choose password (min 4 chars)"
              else -> "Enter password"
            },
            fontSize = 12.sp,
          )
        },
        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        trailingIcon = {
          IconButton(onClick = { showPassword = !showPassword }) {
            Icon(
              if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
              contentDescription = "Toggle password",
              tint = TextMuted,
            )
          }
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )

      if (tab == AuthTabMode.REQUEST) {
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = note,
          onValueChange = { note = it },
          label = { Text("Note for Admin (Optional)", fontSize = 12.sp) },
          placeholder = { Text("e.g. Need Samsung Galaxy A54 one-tap setup", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
      }

      if (isFirstRunAdminClaim) {
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = confirmPassword,
          onValueChange = { confirmPassword = it },
          label = { Text("Confirm Admin Password", fontSize = 12.sp) },
          visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
      }

      Spacer(Modifier.height(14.dp))
      Button(
        onClick = {
          errorMsg = null
          statusMsg = null
          when {
            tab == AuthTabMode.REQUEST -> {
              val (err, ok) = onRequestLogin(
                email.trim(),
                customId.trim(),
                displayName.trim(),
                password,
                selectedDeviceId,
                note.trim(),
              )
              if (err != null) {
                errorMsg = err
              } else {
                statusMsg = ok
                customId = email.trim().lowercase()
                password = ""
                note = ""
                tab = AuthTabMode.USER
              }
            }
            isFirstRunAdminClaim -> {
              if (password != confirmPassword) {
                errorMsg = "Passwords do not match."
              } else {
                errorMsg = onAdminClaim(customId.trim(), password)
              }
            }
            tab == AuthTabMode.ADMIN -> {
              errorMsg = onAdminLogin(customId.trim(), password)
            }
            else -> {
              errorMsg = onUserLogin(customId.trim(), password)
            }
          }
        },
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
      ) {
        Icon(
          if (tab == AuthTabMode.REQUEST) Icons.Rounded.Send else Icons.Rounded.Lock,
          contentDescription = null,
          modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
          when {
            isFirstRunAdminClaim -> "Claim Admin & Sign In"
            tab == AuthTabMode.REQUEST -> "Submit Mail ID Request"
            tab == AuthTabMode.ADMIN -> "Sign In as Admin"
            else -> "Sign In to App"
          },
          fontWeight = FontWeight.SemiBold,
        )
      }

      if (tab == AuthTabMode.USER && !adminConfigured) {
        Spacer(Modifier.height(10.dp))
        TextButton(
          onClick = {
            tab = AuthTabMode.ADMIN
            errorMsg = null
            statusMsg = null
          },
          modifier = Modifier.fillMaxWidth(),
        ) {
          Text(
            "First time? Switch to Admin Login to set up Admin & approve requests",
            color = OrangeSoft,
            fontSize = 11.sp,
          )
        }
      }
    }
  }

  if (showDevicePicker) {
    DevicePickerDialog(
      devices = devices,
      selectedId = selectedDeviceId,
      onSelect = {
        selectedDeviceId = it.id
        showDevicePicker = false
      },
      onDismiss = { showDevicePicker = false },
    )
  }
}

@Composable
private fun DevicePickerDialog(
  devices: List<DeviceSpec>,
  selectedId: String,
  onSelect: (DeviceSpec) -> Unit,
  onDismiss: () -> Unit,
) {
  var q by remember { mutableStateOf("") }
  val filtered = remember(devices, q) {
    val clean = q.trim().lowercase()
    if (clean.isEmpty()) devices
    else devices.filter { "${it.brand} ${it.model} ${it.chipset}".lowercase().contains(clean) }
  }
  AlertDialog(
    onDismissRequest = onDismiss,
    containerColor = SurfacePanel,
    title = { Text("Select Target Device", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold) },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
          value = q,
          onValueChange = { q = it },
          placeholder = { Text("Search Samsung Galaxy, Moto...", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 280.dp)
            .verticalScroll(rememberScrollState()),
        ) {
          filtered.forEach { d ->
            val selected = d.id == selectedId
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .background(if (selected) OrangeAccent.copy(alpha = 0.14f) else Color.Transparent)
                .clickable { onSelect(d) }
                .padding(horizontal = 8.dp, vertical = 9.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
            ) {
              Text(
                "${d.brand} ${d.model}",
                color = if (selected) OrangeSoft else TextPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
              )
              Text("${d.ramGb}GB", color = TextMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
          }
        }
      }
    },
    confirmButton = {
      TextButton(onClick = onDismiss) {
        Text("Close", color = TextMuted)
      }
    },
  )
}

@Composable
fun AdminAccessScreen(
  devices: List<DeviceSpec>,
  requests: List<LocalAccessRequest>,
  users: List<LocalAuthUser>,
  currentAdminId: String,
  isRootAdmin: Boolean,
  onApproveRequest: (String) -> Unit,
  onRejectRequest: (String) -> Unit,
  onCreateUser: (
    email: String,
    customId: String,
    displayName: String,
    password: String,
    deviceId: String,
    role: AuthRole,
  ) -> Pair<String?, String?>,
  onToggleSuspend: (String) -> Unit,
  onDeleteUser: (String) -> Unit,
  onUpdateAdminCredentials: (
    currentPassword: String,
    newAdminId: String,
    newPassword: String,
  ) -> Pair<String?, String?>,
  onResetAdminClaim: (currentPassword: String) -> String?,
  onOpenCalibrationStudio: () -> Unit,
) {
  var email by remember { mutableStateOf("") }
  var customId by remember { mutableStateOf("") }
  var displayName by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var assignedDeviceId by remember { mutableStateOf("samsung-a54") }
  var selectedRole by remember { mutableStateOf(AuthRole.USER) }
  var showDevicePicker by remember { mutableStateOf(false) }
  var formMsg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

  var adminCurrentPass by remember { mutableStateOf("") }
  var newAdminIdInput by remember(currentAdminId) { mutableStateOf(currentAdminId) }
  var newAdminPass by remember { mutableStateOf("") }
  var confirmAdminPass by remember { mutableStateOf("") }
  var confirmResetClaim by remember { mutableStateOf(false) }
  var adminCredsMsg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

  val pendingCount = requests.count { it.status == RequestStatus.PENDING }
  val assignedDevice = remember(devices, assignedDeviceId) {
    devices.find { it.id == assignedDeviceId } ?: devices.first()
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 16.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    PanelCard {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text("ADMIN ACCESS CONTROL", color = OrangeAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
          Text("Mail ID Requests & Users", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
          Text(
            "$pendingCount pending requests · ${users.size} provisioned accounts",
            color = TextMuted,
            fontSize = 12.sp,
          )
        }
        OutlinedButton(
          onClick = onOpenCalibrationStudio,
          border = BorderStroke(1.dp, BorderSlate),
          contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
        ) {
          Text("Studio", color = OrangeSoft, fontSize = 12.sp)
        }
      }
    }

    // Pending & Recent Mail ID Requests
    PanelCard {
      Text("Mail ID Login Requests ($pendingCount Pending)", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(8.dp))
      if (requests.isEmpty()) {
        Text("No login requests yet.", color = TextMuted, fontSize = 12.sp)
      } else {
        requests.forEachIndexed { idx, req ->
          val devName = devices.find { it.id == req.requestedDeviceId }?.let { "${it.brand} ${it.model}" } ?: req.requestedDeviceId
          Column(modifier = Modifier.padding(vertical = 8.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Column(modifier = Modifier.weight(1f)) {
                Text(req.email, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
                Text("${req.displayName} (@${req.customId}) · $devName", color = TextMuted, fontSize = 11.sp)
                if (req.note.isNotBlank()) {
                  Text("\"${req.note}\"", color = OrangeSoft, fontSize = 11.sp)
                }
              }
              Text(
                req.status.label.uppercase(),
                color = when (req.status) {
                  RequestStatus.APPROVED -> EmeraldAccent
                  RequestStatus.REJECTED -> RoseAccent
                  RequestStatus.PENDING -> AmberAccent
                },
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
              )
            }
            if (req.status == RequestStatus.PENDING) {
              Spacer(Modifier.height(8.dp))
              Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                  onClick = { onApproveRequest(req.id) },
                  modifier = Modifier.weight(1f),
                  colors = ButtonDefaults.buttonColors(containerColor = EmeraldAccent, contentColor = BgObsidian),
                ) {
                  Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(15.dp))
                  Spacer(Modifier.width(4.dp))
                  Text("Grant Access", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(
                  onClick = { onRejectRequest(req.id) },
                  modifier = Modifier.weight(1f),
                  border = BorderStroke(1.dp, RoseAccent.copy(alpha = 0.6f)),
                ) {
                  Icon(Icons.Rounded.Close, contentDescription = null, modifier = Modifier.size(15.dp), tint = RoseAccent)
                  Spacer(Modifier.width(4.dp))
                  Text("Reject", fontSize = 12.sp, color = RoseAccent)
                }
              }
            }
          }
          if (idx < requests.lastIndex) {
            HorizontalDivider(color = BorderSlate.copy(alpha = 0.6f))
          }
        }
      }
    }

    // Create User / Admin Account directly
    PanelCard {
      Text("Create Account by Mail ID", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(8.dp))
      if (formMsg != null) {
        val (isOk, msg) = formMsg!!
        Surface(
          modifier = Modifier.fillMaxWidth(),
          color = (if (isOk) EmeraldAccent else RoseAccent).copy(alpha = 0.14f),
          shape = RoundedCornerShape(8.dp),
        ) {
          Text(msg, color = if (isOk) EmeraldAccent else RoseAccent, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
        }
        Spacer(Modifier.height(8.dp))
      }
      OutlinedTextField(
        value = email,
        onValueChange = { email = it },
        label = { Text("Email ID", fontSize = 12.sp) },
        placeholder = { Text("player@gmail.com", fontSize = 12.sp) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )
      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
          value = displayName,
          onValueChange = { displayName = it },
          label = { Text("Player Name", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
        OutlinedTextField(
          value = customId,
          onValueChange = { customId = it },
          label = { Text("User ID (Opt)", fontSize = 12.sp) },
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
      }
      Spacer(Modifier.height(8.dp))
      OutlinedTextField(
        value = password,
        onValueChange = { password = it },
        label = { Text("Password", fontSize = 12.sp) },
        placeholder = { Text("Min 4 chars (6+ for Admin)", fontSize = 12.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )
      Spacer(Modifier.height(8.dp))
      OutlinedButton(
        onClick = { showDevicePicker = true },
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, BorderSlate),
      ) {
        Text("Device: ${assignedDevice.brand} ${assignedDevice.model}", color = TextPrimary, fontSize = 12.sp)
      }
      Spacer(Modifier.height(8.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        AuthRole.entries.forEach { r ->
          FilterChip(
            modifier = Modifier.weight(1f),
            selected = selectedRole == r,
            onClick = { selectedRole = r },
            label = { Text(if (r == AuthRole.ADMIN) "Admin Role" else "User Role", fontSize = 12.sp) },
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = OrangeAccent,
              selectedLabelColor = BgObsidian,
              containerColor = BgObsidian,
              labelColor = TextMuted,
            ),
          )
        }
      }
      Spacer(Modifier.height(10.dp))
      Button(
        onClick = {
          val (err, ok) = onCreateUser(
            email.trim(),
            customId.trim(),
            displayName.trim(),
            password,
            assignedDeviceId,
            selectedRole,
          )
          if (err != null) {
            formMsg = false to err
          } else {
            formMsg = true to (ok ?: "Account created")
            email = ""
            customId = ""
            displayName = ""
            password = ""
          }
        },
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
      ) {
        Text("Create & Grant Access", fontWeight = FontWeight.SemiBold)
      }
    }

    // Approved Users Directory
    PanelCard {
      Text("Provisioned Users (${users.size})", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(8.dp))
      if (users.isEmpty()) {
        Text("No users created yet.", color = TextMuted, fontSize = 12.sp)
      } else {
        users.forEachIndexed { idx, user ->
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Column(modifier = Modifier.weight(1f)) {
              Text(
                "${user.displayName} (${if (user.role == AuthRole.ADMIN) "ADMIN" else "USER"})",
                color = if (user.suspended) RoseAccent else TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
              )
              Text(
                user.email.ifBlank { "@${user.customId}" },
                color = TextMuted,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
              )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
              TextButton(onClick = { onToggleSuspend(user.id) }) {
                Text(
                  if (user.suspended) "Activate" else "Suspend",
                  color = if (user.suspended) EmeraldAccent else AmberAccent,
                  fontSize = 11.sp,
                )
              }
              IconButton(onClick = { onDeleteUser(user.id) }) {
                Icon(Icons.Rounded.Delete, contentDescription = "Delete", tint = RoseAccent, modifier = Modifier.size(18.dp))
              }
            }
          }
          if (idx < users.lastIndex) {
            HorizontalDivider(color = BorderSlate.copy(alpha = 0.6f))
          }
        }
      }
    }

    // Reset Admin Claim ID & Password
    PanelCard {
      Text("Reset Admin Claim ID & Password", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
      Spacer(Modifier.height(4.dp))
      Text(
        "Update your Admin ID and password, or reset back to First-Run Setup.",
        color = TextMuted,
        fontSize = 11.sp,
      )
      Spacer(Modifier.height(8.dp))
      if (adminCredsMsg != null) {
        val (isOk, msg) = adminCredsMsg!!
        Surface(
          modifier = Modifier.fillMaxWidth(),
          color = (if (isOk) EmeraldAccent else RoseAccent).copy(alpha = 0.14f),
          shape = RoundedCornerShape(8.dp),
        ) {
          Text(msg, color = if (isOk) EmeraldAccent else RoseAccent, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
        }
        Spacer(Modifier.height(8.dp))
      }
      OutlinedTextField(
        value = adminCurrentPass,
        onValueChange = { adminCurrentPass = it },
        label = { Text("Current Admin Password", fontSize = 12.sp) },
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )
      Spacer(Modifier.height(8.dp))
      OutlinedTextField(
        value = newAdminIdInput,
        onValueChange = { newAdminIdInput = it },
        label = { Text("New Admin ID", fontSize = 12.sp) },
        placeholder = { Text("e.g. admin", fontSize = 12.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )
      Spacer(Modifier.height(8.dp))
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
          value = newAdminPass,
          onValueChange = { newAdminPass = it },
          label = { Text("New Password (6+)", fontSize = 12.sp) },
          visualTransformation = PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
        OutlinedTextField(
          value = confirmAdminPass,
          onValueChange = { confirmAdminPass = it },
          label = { Text("Confirm Password", fontSize = 12.sp) },
          visualTransformation = PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
      }
      Spacer(Modifier.height(10.dp))
      Button(
        onClick = {
          if (newAdminPass != confirmAdminPass) {
            adminCredsMsg = false to "New admin passwords do not match."
          } else {
            val (err, ok) = onUpdateAdminCredentials(adminCurrentPass, newAdminIdInput.trim(), newAdminPass)
            if (err != null) {
              adminCredsMsg = false to err
            } else {
              adminCredsMsg = true to (ok ?: "Admin credentials updated.")
              adminCurrentPass = ""
              newAdminPass = ""
              confirmAdminPass = ""
            }
          }
        },
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
      ) {
        Text("Save New Admin ID & Password", fontWeight = FontWeight.SemiBold)
      }

      if (isRootAdmin) {
        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = BorderSlate.copy(alpha = 0.6f))
        Spacer(Modifier.height(10.dp))
        if (!confirmResetClaim) {
          OutlinedButton(
            onClick = {
              confirmResetClaim = true
              adminCredsMsg = null
            },
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, RoseAccent.copy(alpha = 0.55f)),
          ) {
            Text("Reset Claim to First-Run Setup", color = RoseAccent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
          }
        } else {
          Text(
            "Enter current password above and confirm to wipe claimed Admin ID & return to First-Run Setup.",
            color = RoseAccent,
            fontSize = 11.sp,
          )
          Spacer(Modifier.height(6.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
              onClick = {
                val err = onResetAdminClaim(adminCurrentPass)
                if (err != null) {
                  adminCredsMsg = false to err
                }
              },
              modifier = Modifier.weight(1f),
              colors = ButtonDefaults.buttonColors(containerColor = RoseAccent, contentColor = TextPrimary),
            ) {
              Text("Confirm Reset", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            OutlinedButton(
              onClick = { confirmResetClaim = false },
              modifier = Modifier.weight(1f),
              border = BorderStroke(1.dp, BorderSlate),
            ) {
              Text("Cancel", color = TextMuted, fontSize = 12.sp)
            }
          }
        }
      }
    }
  }

  if (showDevicePicker) {
    DevicePickerDialog(
      devices = devices,
      selectedId = assignedDeviceId,
      onSelect = {
        assignedDeviceId = it.id
        showDevicePicker = false
      },
      onDismiss = { showDevicePicker = false },
    )
  }
}
