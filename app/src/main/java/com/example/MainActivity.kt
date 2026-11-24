package com.example

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.RocketLaunch
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.TrackChanges
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.BgObsidian
import com.example.ui.theme.BorderSlate
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.OrangeAccent
import com.example.ui.theme.SurfacePanel
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MyApplicationTheme {
        FireTuneApp()
      }
    }
  }
}

private enum class FireTuneTab(val label: String) {
  SENSITIVITY("Sensitivity"),
  PERFORMANCE("FPS Boost"),
  DRAG_LAB("Drag Lab"),
  SAVED("Saved"),
}

@Composable
fun FireTuneApp() {
  val context = LocalContext.current
  val storage = remember(context) { FireTuneStorage(context.applicationContext) }
  val scope = rememberCoroutineScope()
  val snackbarHostState = remember { SnackbarHostState() }

  var customDevices by remember { mutableStateOf(storage.loadCustomDevices()) }
  var savedProfiles by remember { mutableStateOf(storage.loadSavedProfiles()) }
  var checklistMap by remember { mutableStateOf(storage.loadChecklistMap()) }
  var notificationBlock by remember { mutableStateOf(storage.loadNotificationBlock()) }

  val detectedDevice = remember(context) { detectCurrentAndroidDevice(context) }
  val allDevices = remember(customDevices, detectedDevice) {
    customDevices + listOf(detectedDevice) + DEVICE_CATALOG
  }

  var activeTab by remember { mutableStateOf(FireTuneTab.SENSITIVITY) }
  var selectedDeviceId by remember { mutableStateOf(detectedDevice.id) }
  var playstyle by remember { mutableStateOf(PlaystyleId.ONE_TAP) }
  var grip by remember { mutableStateOf(GripType.TWO_FINGER) }
  var rangeBias by remember { mutableStateOf(RangeBias.MID) }

  val selectedDevice = remember(allDevices, selectedDeviceId) {
    allDevices.find { it.id == selectedDeviceId } ?: allDevices.first()
  }

  val calibration = remember(selectedDevice, playstyle, grip, rangeBias) {
    calculateCalibration(selectedDevice, playstyle, grip, rangeBias)
  }

  var sensitivityOverrides by remember { mutableStateOf(calibration.sensitivity) }
  var fireButtonOverride by remember { mutableIntStateOf(calibration.fireButtonSize) }
  var pendingLoadedOverride by remember { mutableStateOf<Pair<SensitivityValues, Int>?>(null) }

  LaunchedEffect(calibration) {
    val pending = pendingLoadedOverride
    if (pending != null) {
      pendingLoadedOverride = null
      sensitivityOverrides = pending.first
      fireButtonOverride = pending.second
    } else {
      sensitivityOverrides = calibration.sensitivity
      fireButtonOverride = calibration.fireButtonSize
    }
  }

  var showCustomModal by remember { mutableStateOf(false) }
  var showLaunchModal by remember { mutableStateOf(false) }
  var appliedStepsCount by remember { mutableIntStateOf(0) }

  fun copyToClipboard(text: String, message: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    cm?.setPrimaryClip(ClipData.newPlainText("FireTune Setup", text))
    scope.launch { snackbarHostState.showSnackbar(message) }
  }

  fun launchAndroidPackage(packageName: String, label: String) {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent != null) {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      return
    }
    val marketIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
    if (marketIntent.resolveActivity(context.packageManager) != null) {
      context.startActivity(marketIntent)
    } else {
      scope.launch {
        snackbarHostState.showSnackbar("$label is not installed on this device. Your setup is copied to clipboard.")
      }
    }
  }

  Scaffold(
    modifier = Modifier.fillMaxSize(),
    containerColor = BgObsidian,
    snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
    topBar = {
      Surface(color = SurfacePanel) {
        androidx.compose.foundation.layout.Column(modifier = Modifier.statusBarsPadding()) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(
              text = buildAnnotatedString {
                withStyle(SpanStyle(color = TextPrimary, fontWeight = FontWeight.Bold)) {
                  append("Fire")
                }
                withStyle(SpanStyle(color = OrangeAccent, fontWeight = FontWeight.Bold)) {
                  append("Tune")
                }
              },
              fontSize = 21.sp,
            )

            Button(
              onClick = {
                val steps = buildOptimizationChecklist(selectedDevice).map { it.id }.toSet()
                val nextMap = checklistMap.toMutableMap()
                nextMap[selectedDevice.id] = steps
                checklistMap = nextMap
                storage.saveChecklistMap(nextMap)
                appliedStepsCount = steps.size

                val summary = formatSetupAsText(
                  selectedDevice,
                  sensitivityOverrides,
                  fireButtonOverride,
                  calibration,
                  playstyle,
                  grip,
                )
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                cm?.setPrimaryClip(ClipData.newPlainText("FireTune Setup", summary))
                showLaunchModal = true
              },
              contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
              colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
            ) {
              Icon(Icons.Rounded.RocketLaunch, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(Modifier.width(6.dp))
              Text("Apply & Launch", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
          }
          HorizontalDivider(color = BorderSlate)
        }
      }
    },
    bottomBar = {
      NavigationBar(containerColor = SurfacePanel, tonalElevation = 0.dp) {
        FireTuneTab.entries.forEach { tab ->
          val selected = activeTab == tab
          val icon = when (tab) {
            FireTuneTab.SENSITIVITY -> Icons.Rounded.Tune
            FireTuneTab.PERFORMANCE -> Icons.Rounded.Speed
            FireTuneTab.DRAG_LAB -> Icons.Rounded.TrackChanges
            FireTuneTab.SAVED -> Icons.Rounded.Bookmark
          }
          NavigationBarItem(
            selected = selected,
            onClick = { activeTab = tab },
            icon = { Icon(icon, contentDescription = tab.label) },
            label = { Text(tab.label, fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
              selectedIconColor = OrangeAccent,
              selectedTextColor = OrangeAccent,
              indicatorColor = OrangeAccent.copy(alpha = 0.14f),
              unselectedIconColor = TextMuted,
              unselectedTextColor = TextMuted,
            ),
          )
        }
      }
    },
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
    ) {
      when (activeTab) {
        FireTuneTab.SENSITIVITY -> SensitivityScreen(
          devices = allDevices,
          selectedDevice = selectedDevice,
          onSelectDevice = { selectedDeviceId = it.id },
          onDetectCurrentPhone = {
            selectedDeviceId = detectedDevice.id
            scope.launch {
              snackbarHostState.showSnackbar(
                "Detected ${detectedDevice.brand} ${detectedDevice.model} (${detectedDevice.ramGb} GB · ${detectedDevice.refreshHz} Hz)"
              )
            }
          },
          onOpenCustomDevice = { showCustomModal = true },
          playstyle = playstyle,
          onChangePlaystyle = { playstyle = it },
          grip = grip,
          onChangeGrip = { grip = it },
          rangeBias = rangeBias,
          onChangeRangeBias = { rangeBias = it },
          calibration = calibration,
          sensitivity = sensitivityOverrides,
          fireButtonSize = fireButtonOverride,
          onUpdateSensitivity = { sensitivityOverrides = it },
          onUpdateFireButton = { fireButtonOverride = it },
          onResetRecommended = {
            sensitivityOverrides = calibration.sensitivity
            fireButtonOverride = calibration.fireButtonSize
          },
          onCopySetup = {
            val text = formatSetupAsText(
              selectedDevice,
              sensitivityOverrides,
              fireButtonOverride,
              calibration,
              playstyle,
              grip,
            )
            copyToClipboard(text, "Sensitivity & DPI setup copied to clipboard")
          },
          onSavePreset = {
            val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val profile = SavedProfile(
              id = "prof-${System.currentTimeMillis()}",
              name = "${selectedDevice.model} · ${playstyle.title}",
              createdAt = dateStr,
              deviceId = selectedDevice.id,
              deviceLabel = "${selectedDevice.brand} ${selectedDevice.model}",
              os = selectedDevice.os,
              ramGb = selectedDevice.ramGb,
              refreshHz = selectedDevice.refreshHz,
              playstyle = playstyle,
              grip = grip,
              rangeBias = rangeBias,
              sensitivity = sensitivityOverrides,
              fireButtonSize = fireButtonOverride,
              dpiValue = calibration.dpiValue,
              dpiLabel = calibration.dpiLabel,
              graphicsDisplay = calibration.graphics.display,
              highFps = calibration.graphics.highFps,
            )
            val next = listOf(profile) + savedProfiles
            savedProfiles = next
            storage.saveSavedProfiles(next)
            scope.launch { snackbarHostState.showSnackbar("Preset saved offline") }
          },
        )

        FireTuneTab.PERFORMANCE -> PerformanceScreen(
          device = selectedDevice,
          calibration = calibration,
          completedStepIds = checklistMap[selectedDevice.id] ?: emptySet(),
          onToggleStep = { stepId ->
            val current = checklistMap[selectedDevice.id] ?: emptySet()
            val updated = if (current.contains(stepId)) current - stepId else current + stepId
            val nextMap = checklistMap.toMutableMap()
            nextMap[selectedDevice.id] = updated
            checklistMap = nextMap
            storage.saveChecklistMap(nextMap)
          },
          onResetSteps = {
            val nextMap = checklistMap.toMutableMap()
            nextMap[selectedDevice.id] = emptySet()
            checklistMap = nextMap
            storage.saveChecklistMap(nextMap)
          },
          notificationBlock = notificationBlock,
          onUpdateNotificationBlock = {
            notificationBlock = it
            storage.saveNotificationBlock(it)
          },
          onCopyDndGuide = {
            val guide = buildString {
              appendLine("FireTune Notification Block (${selectedDevice.brand} ${selectedDevice.model})")
              appendLine("Heads-Up Banners: ${if (notificationBlock.blockHeadsUp) "BLOCKED" else "ALLOW"}")
              appendLine("Incoming Calls: ${if (notificationBlock.blockCalls) "BLOCKED" else "ALLOW"}")
              appendLine("Floating Bubbles: ${if (notificationBlock.blockFloatingBubbles) "BLOCKED" else "ALLOW"}")
              appendLine("Apply: Settings > Notifications > Do Not Disturb + Game Space / Moto Gametime")
            }
            copyToClipboard(guide, "Notification block guide copied")
          },
        )

        FireTuneTab.DRAG_LAB -> DragLabScreen(
          sensitivity = sensitivityOverrides,
          fireButtonSize = fireButtonOverride,
        )

        FireTuneTab.SAVED -> SavedPresetsScreen(
          profiles = savedProfiles,
          onLoadProfile = { profile ->
            val sameContext =
              profile.deviceId == selectedDeviceId &&
                profile.playstyle == playstyle &&
                profile.grip == grip &&
                profile.rangeBias == rangeBias
            if (sameContext) {
              sensitivityOverrides = profile.sensitivity
              fireButtonOverride = profile.fireButtonSize
            } else {
              pendingLoadedOverride = profile.sensitivity to profile.fireButtonSize
              if (allDevices.any { it.id == profile.deviceId }) {
                selectedDeviceId = profile.deviceId
              }
              playstyle = profile.playstyle
              grip = profile.grip
              rangeBias = profile.rangeBias
            }
            activeTab = FireTuneTab.SENSITIVITY
            scope.launch { snackbarHostState.showSnackbar("Loaded ${profile.name}") }
          },
          onCopyProfile = { profile ->
            val text =
              "${profile.name} (${profile.deviceLabel})\n" +
                "General: ${profile.sensitivity.general} | Red Dot: ${profile.sensitivity.redDot} | " +
                "2x: ${profile.sensitivity.scope2x} | 4x: ${profile.sensitivity.scope4x} | " +
                "Sniper: ${profile.sensitivity.sniperScope} | Free Look: ${profile.sensitivity.freeLook}\n" +
                "Fire Button: ${profile.fireButtonSize}% | DPI: ${profile.dpiValue}"
            copyToClipboard(text, "Preset copied to clipboard")
          },
          onDeleteProfile = { id ->
            val next = savedProfiles.filterNot { it.id == id }
            savedProfiles = next
            storage.saveSavedProfiles(next)
          },
        )
      }
    }
  }

  if (showCustomModal) {
    CustomDeviceDialog(
      onDismiss = { showCustomModal = false },
      onSave = { newDevice ->
        val next = listOf(newDevice) + customDevices
        customDevices = next
        storage.saveCustomDevices(next)
        selectedDeviceId = newDevice.id
        showCustomModal = false
      },
    )
  }

  if (showLaunchModal) {
    LaunchGameDialog(
      device = selectedDevice,
      playstyle = playstyle,
      calibration = calibration,
      sensitivity = sensitivityOverrides,
      fireButtonSize = fireButtonOverride,
      appliedStepsCount = appliedStepsCount,
      onCopySetup = {
        val text = formatSetupAsText(
          selectedDevice,
          sensitivityOverrides,
          fireButtonOverride,
          calibration,
          playstyle,
          grip,
        )
        copyToClipboard(text, "Setup copied to clipboard")
      },
      onLaunchPackage = { pkg, name -> launchAndroidPackage(pkg, name) },
      onDismiss = { showLaunchModal = false },
    )
  }
}
