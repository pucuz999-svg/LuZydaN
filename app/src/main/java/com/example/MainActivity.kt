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
import androidx.compose.material.icons.rounded.AdminPanelSettings
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
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
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
  ADMIN("Admin"),
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

  var adminConfig by remember { mutableStateOf(storage.loadAdminConfig()) }
  var authUsers by remember { mutableStateOf(storage.loadAuthUsers()) }
  var accessRequests by remember { mutableStateOf(storage.loadAccessRequests()) }
  var sessionUserId by remember { mutableStateOf(storage.loadSessionUserId()) }

  var serverSyncEnabled by remember { mutableStateOf(storage.loadServerSyncEnabled()) }
  var serverUrl by remember { mutableStateOf(storage.loadServerUrl()) }
  var serverConnected by remember { mutableStateOf(false) }
  var serverStatusError by remember { mutableStateOf<String?>(null) }
  var remoteAdminConfigured by remember { mutableStateOf(false) }
  var remoteSessionToken by remember { mutableStateOf<String?>(null) }
  var remoteSessionUser by remember { mutableStateOf<LocalAuthUser?>(null) }

  suspend fun checkRemoteStatus(url: String = serverUrl): Boolean {
    return when (val res = FireTuneApi.fetchAuthStatus(url)) {
      is ApiResult.Success -> {
        remoteAdminConfigured = res.data.adminConfigured
        serverConnected = true
        serverStatusError = null
        true
      }
      is ApiResult.Error -> {
        serverConnected = false
        serverStatusError = res.message
        false
      }
    }
  }

  LaunchedEffect(serverSyncEnabled, serverUrl) {
    if (serverSyncEnabled) {
      checkRemoteStatus(serverUrl)
    } else {
      serverConnected = false
      serverStatusError = null
    }
  }

  val activeAuthUser = remember(
    serverSyncEnabled,
    remoteSessionUser,
    remoteSessionToken,
    adminConfig,
    authUsers,
    sessionUserId,
  ) {
    if (serverSyncEnabled) {
      if (remoteSessionToken != null) remoteSessionUser else null
    } else {
      val sid = sessionUserId ?: return@remember null
      if (sid == "root-admin" && adminConfig != null) {
        LocalAuthUser(
          id = "root-admin",
          email = "",
          customId = adminConfig!!.adminId,
          displayName = "Root Admin (${adminConfig!!.adminId})",
          role = AuthRole.ADMIN,
          passwordHash = "",
          passwordSalt = "",
          assignedDeviceId = "samsung-s24-ultra",
          suspended = false,
          createdAt = "",
        )
      } else {
        authUsers.find { it.id == sid && !it.suspended }
      }
    }
  }

  val detectedDevice = remember(context) { detectCurrentAndroidDevice(context) }
  val allDevices = remember(customDevices, detectedDevice) {
    customDevices + listOf(detectedDevice) + DEVICE_CATALOG
  }

  var activeTab by remember { mutableStateOf(FireTuneTab.SENSITIVITY) }
  var selectedDeviceId by remember { mutableStateOf(detectedDevice.id) }
  var playstyle by remember { mutableStateOf(PlaystyleId.ONE_TAP) }
  var grip by remember { mutableStateOf(GripType.TWO_FINGER) }
  var rangeBias by remember { mutableStateOf(RangeBias.MID) }

  if (activeAuthUser == null) {
    val effectiveAdminConfigured = if (serverSyncEnabled) {
      remoteAdminConfigured
    } else {
      adminConfig != null || authUsers.any { it.role == AuthRole.ADMIN && !it.suspended }
    }

    AuthGateScreen(
      devices = allDevices,
      adminConfigured = effectiveAdminConfigured,
      serverSyncEnabled = serverSyncEnabled,
      serverUrl = serverUrl,
      serverConnected = serverConnected,
      serverStatusError = serverStatusError,
      onSaveServerSettings = { enabled, nextUrl ->
        storage.saveServerSyncEnabled(enabled)
        serverSyncEnabled = enabled
        if (!enabled) {
          remoteSessionToken = null
          remoteSessionUser = null
          serverConnected = false
          serverStatusError = null
          return@AuthGateScreen null
        }
        val cleanUrl = FireTuneApi.normalizeBaseUrl(nextUrl)
          ?: return@AuthGateScreen "Enter a valid https:// server URL."
        storage.saveServerUrl(cleanUrl)
        serverUrl = cleanUrl
        val ok = checkRemoteStatus(cleanUrl)
        if (ok) null else serverStatusError ?: "Could not connect to server."
      },
      onUserLogin = { identifier, password ->
        val clean = identifier.trim().lowercase()
        if (clean.isEmpty() || password.isEmpty()) {
          return@AuthGateScreen "Enter your Email ID (or User ID) and password."
        }
        if (serverSyncEnabled) {
          when (val res = FireTuneApi.login(serverUrl, AuthRole.USER, clean, password)) {
            is ApiResult.Success -> {
              remoteSessionToken = res.data.token
              remoteSessionUser = res.data.user
              if (allDevices.any { it.id == res.data.user.assignedDeviceId }) {
                selectedDeviceId = res.data.user.assignedDeviceId
              }
              activeTab = FireTuneTab.SENSITIVITY
              null
            }
            is ApiResult.Error -> res.message
          }
        } else {
          val matchedUser = authUsers.find {
            it.role == AuthRole.USER &&
              (it.email.equals(clean, ignoreCase = true) || it.customId.equals(clean, ignoreCase = true))
          }
          if (matchedUser == null) {
            val pending = accessRequests.find {
              it.email.equals(clean, ignoreCase = true) || it.customId.equals(clean, ignoreCase = true)
            }
            return@AuthGateScreen when (pending?.status) {
              RequestStatus.PENDING -> "Your login request is pending Admin approval."
              RequestStatus.REJECTED -> "Your login request was declined by an Admin."
              else -> "Invalid Email ID / User ID or password."
            }
          }
          if (matchedUser.suspended) {
            return@AuthGateScreen "This account is suspended. Contact Admin."
          }
          if (!LocalAuthCrypto.verifyPassword(password, matchedUser.passwordSalt, matchedUser.passwordHash)) {
            return@AuthGateScreen "Invalid Email ID / User ID or password."
          }
          sessionUserId = matchedUser.id
          storage.saveSessionUserId(matchedUser.id)
          if (allDevices.any { it.id == matchedUser.assignedDeviceId }) {
            selectedDeviceId = matchedUser.assignedDeviceId
          }
          activeTab = FireTuneTab.SENSITIVITY
          null
        }
      },
      onRequestLogin = { email, customIdInput, displayNameInput, password, deviceId, note ->
        val cleanEmail = email.trim().lowercase()
        if (!LocalAuthCrypto.isValidEmail(cleanEmail)) {
          return@AuthGateScreen "Please enter a valid Email ID (e.g. player@gmail.com)." to null
        }
        if (password.length < 4) {
          return@AuthGateScreen "Password must be at least 4 characters." to null
        }
        if (serverSyncEnabled) {
          when (
            val res = FireTuneApi.requestAccess(
              baseUrl = serverUrl,
              email = cleanEmail,
              customId = customIdInput.trim(),
              displayName = displayNameInput.trim().ifEmpty {
                customIdInput.trim().ifEmpty { cleanEmail.substringBefore("@") }
              },
              password = password,
              requestedDeviceId = deviceId,
              note = note,
            )
          ) {
            is ApiResult.Success -> {
              serverConnected = true
              serverStatusError = null
              null to "Request sent to Admin for ${res.data.email} (@${res.data.customId}). Once granted access, sign in here."
            }
            is ApiResult.Error -> {
              res.message to null
            }
          }
        } else {
          val resolvedId =
            customIdInput.trim().lowercase().ifEmpty { LocalAuthCrypto.deriveCustomIdFromEmail(cleanEmail) }
          val emailTaken =
            authUsers.any { it.email.equals(cleanEmail, ignoreCase = true) } ||
              accessRequests.any { it.status == RequestStatus.PENDING && it.email.equals(cleanEmail, ignoreCase = true) }
          if (emailTaken) {
            return@AuthGateScreen "A user or pending request with this Email ID already exists." to null
          }
          val idTaken =
            authUsers.any { it.customId.equals(resolvedId, ignoreCase = true) } ||
              accessRequests.any { it.status == RequestStatus.PENDING && it.customId.equals(resolvedId, ignoreCase = true) }
          val finalCustomId = if (idTaken) "${resolvedId}_${(100..999).random()}" else resolvedId
          val salt = LocalAuthCrypto.generateSalt()
          val hash = LocalAuthCrypto.hashPassword(password, salt)
          val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
          val req = LocalAccessRequest(
            id = "req-${System.currentTimeMillis()}",
            email = cleanEmail,
            customId = finalCustomId,
            displayName = displayNameInput.trim().ifEmpty { finalCustomId },
            passwordHash = hash,
            passwordSalt = salt,
            requestedDeviceId = deviceId,
            note = note,
            status = RequestStatus.PENDING,
            createdAt = nowStr,
          )
          val nextReqs = listOf(req) + accessRequests
          accessRequests = nextReqs
          storage.saveAccessRequests(nextReqs)
          null to "Request saved locally for $cleanEmail (@$finalCustomId). Enable Server Sync to send requests to a remote Admin."
        }
      },
      onAdminClaim = { adminId, password ->
        val cleanId = adminId.trim().lowercase()
        if (cleanId.length < 3) {
          return@AuthGateScreen "Admin ID must be at least 3 characters."
        }
        if (password.length < 6) {
          return@AuthGateScreen "Admin password must be at least 6 characters."
        }
        if (serverSyncEnabled) {
          when (val res = FireTuneApi.claimAdmin(serverUrl, cleanId, password)) {
            is ApiResult.Success -> {
              remoteAdminConfigured = true
              remoteSessionToken = res.data.token
              remoteSessionUser = res.data.user
              activeTab = FireTuneTab.ADMIN
              null
            }
            is ApiResult.Error -> res.message
          }
        } else {
          val salt = LocalAuthCrypto.generateSalt()
          val hash = LocalAuthCrypto.hashPassword(password, salt)
          val cfg = LocalAdminConfig(cleanId, hash, salt)
          adminConfig = cfg
          storage.saveAdminConfig(cfg)
          sessionUserId = "root-admin"
          storage.saveSessionUserId("root-admin")
          activeTab = FireTuneTab.ADMIN
          null
        }
      },
      onAdminLogin = { adminId, password ->
        val cleanId = adminId.trim().lowercase()
        if (cleanId.isEmpty() || password.isEmpty()) {
          return@AuthGateScreen "Enter Admin ID and password."
        }
        if (serverSyncEnabled) {
          when (val res = FireTuneApi.login(serverUrl, AuthRole.ADMIN, cleanId, password)) {
            is ApiResult.Success -> {
              remoteSessionToken = res.data.token
              remoteSessionUser = res.data.user
              activeTab = FireTuneTab.ADMIN
              null
            }
            is ApiResult.Error -> res.message
          }
        } else {
          val rootCfg = adminConfig
          if (rootCfg != null && rootCfg.adminId.equals(cleanId, ignoreCase = true) &&
            LocalAuthCrypto.verifyPassword(password, rootCfg.passwordSalt, rootCfg.passwordHash)
          ) {
            sessionUserId = "root-admin"
            storage.saveSessionUserId("root-admin")
            activeTab = FireTuneTab.ADMIN
            return@AuthGateScreen null
          }
          val adminUser = authUsers.find {
            it.role == AuthRole.ADMIN &&
              !it.suspended &&
              (it.customId.equals(cleanId, ignoreCase = true) || it.email.equals(cleanId, ignoreCase = true))
          }
          if (adminUser != null &&
            LocalAuthCrypto.verifyPassword(password, adminUser.passwordSalt, adminUser.passwordHash)
          ) {
            sessionUserId = adminUser.id
            storage.saveSessionUserId(adminUser.id)
            activeTab = FireTuneTab.ADMIN
            return@AuthGateScreen null
          }
          "Invalid Admin ID or password."
        }
      },
    )
    return
  }

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
    cm?.setPrimaryClip(ClipData.newPlainText("FF TUNE Setup", text))
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

  val visibleTabs = remember(activeAuthUser) {
    if (activeAuthUser.role == AuthRole.ADMIN) {
      FireTuneTab.entries
    } else {
      listOf(FireTuneTab.SENSITIVITY, FireTuneTab.PERFORMANCE, FireTuneTab.DRAG_LAB, FireTuneTab.SAVED)
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
              .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
              BrandLogoMark(large = false)
              Text(
                text = if (activeAuthUser.role == AuthRole.ADMIN) "Admin · ${activeAuthUser.customId}" else activeAuthUser.email.ifBlank { activeAuthUser.customId },
                color = TextMuted,
                fontSize = 10.sp,
              )
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              TextButton(
                onClick = {
                  remoteSessionToken = null
                  remoteSessionUser = null
                  sessionUserId = null
                  storage.saveSessionUserId(null)
                },
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
              ) {
                Text("Sign Out", color = TextMuted, fontSize = 11.sp)
              }

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
                  cm?.setPrimaryClip(ClipData.newPlainText("FF TUNE Setup", summary))
                  showLaunchModal = true
                },
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = OrangeAccent, contentColor = BgObsidian),
              ) {
                Icon(Icons.Rounded.RocketLaunch, contentDescription = null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(5.dp))
                Text("Apply", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
              }
            }
          }
          HorizontalDivider(color = BorderSlate)
        }
      }
    },
    bottomBar = {
      NavigationBar(containerColor = SurfacePanel, tonalElevation = 0.dp) {
        visibleTabs.forEach { tab ->
          val selected = activeTab == tab
          val icon = when (tab) {
            FireTuneTab.SENSITIVITY -> Icons.Rounded.Tune
            FireTuneTab.PERFORMANCE -> Icons.Rounded.Speed
            FireTuneTab.DRAG_LAB -> Icons.Rounded.TrackChanges
            FireTuneTab.SAVED -> Icons.Rounded.Bookmark
            FireTuneTab.ADMIN -> Icons.Rounded.AdminPanelSettings
          }
          NavigationBarItem(
            selected = selected,
            onClick = { activeTab = tab },
            icon = { Icon(icon, contentDescription = tab.label) },
            label = { Text(tab.label, fontSize = 10.sp) },
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
              appendLine("FF TUNE Notification Block (${selectedDevice.brand} ${selectedDevice.model})")
              appendLine("Heads-Up Banners: ${if (notificationBlock.blockHeadsUp) "BLOCKED" else "ALLOW"}")
              appendLine("Incoming Calls: ${if (notificationBlock.blockCalls) "BLOCKED" else "ALLOW"}")
              appendLine("Floating Bubbles: ${if (notificationBlock.blockFloatingBubbles) "BLOCKED" else "ALLOW"}")
              appendLine("Apply: Settings > Notifications > Do Not Disturb + Game Space / Samsung Game Booster")
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

        FireTuneTab.ADMIN -> AdminAccessScreen(
          devices = allDevices,
          requests = accessRequests,
          users = authUsers,
          currentAdminId = activeAuthUser.customId,
          isRootAdmin = activeAuthUser.id == "root-admin" || activeAuthUser.id == "admin-root",
          serverSyncEnabled = serverSyncEnabled,
          onRefreshData = {
            if (!serverSyncEnabled) {
              accessRequests = storage.loadAccessRequests()
              authUsers = storage.loadAuthUsers()
              return@AdminAccessScreen null
            }
            val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired. Sign in again."
            val reqRes = FireTuneApi.fetchRequests(serverUrl, token)
            val custRes = FireTuneApi.fetchCustomers(serverUrl, token)
            if (reqRes is ApiResult.Error && reqRes.code == 401) {
              remoteSessionToken = null
              remoteSessionUser = null
              return@AdminAccessScreen "Session expired. Please sign in again."
            }
            if (reqRes is ApiResult.Success) {
              accessRequests = reqRes.data
            }
            if (custRes is ApiResult.Success) {
              authUsers = custRes.data
            }
            when {
              reqRes is ApiResult.Error -> reqRes.message
              custRes is ApiResult.Error -> custRes.message
              else -> null
            }
          },
          onApproveRequest = { reqId ->
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired."
              when (val res = FireTuneApi.decideRequest(serverUrl, token, reqId, "accept")) {
                is ApiResult.Success -> {
                  val updatedReq = res.data.first
                  val newCust = res.data.second
                  if (updatedReq != null) {
                    accessRequests = accessRequests.map { if (it.id == reqId) updatedReq else it }
                  }
                  if (newCust != null) {
                    authUsers = listOf(newCust) + authUsers
                  }
                  snackbarHostState.showSnackbar("Granted access")
                  null
                }
                is ApiResult.Error -> res.message
              }
            } else {
              val req = accessRequests.find { it.id == reqId } ?: return@AdminAccessScreen "Request not found."
              val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
              val nextReqs = accessRequests.map {
                if (it.id == reqId) it.copy(status = RequestStatus.APPROVED, decidedAt = nowStr) else it
              }
              val alreadyUser = authUsers.any { it.email.equals(req.email, ignoreCase = true) }
              val nextUsers = if (alreadyUser) authUsers else {
                listOf(
                  LocalAuthUser(
                    id = "usr-${System.currentTimeMillis()}",
                    email = req.email,
                    customId = req.customId,
                    displayName = req.displayName,
                    role = AuthRole.USER,
                    passwordHash = req.passwordHash,
                    passwordSalt = req.passwordSalt,
                    assignedDeviceId = req.requestedDeviceId,
                    suspended = false,
                    createdAt = nowStr,
                  )
                ) + authUsers
              }
              accessRequests = nextReqs
              authUsers = nextUsers
              storage.saveAccessRequests(nextReqs)
              storage.saveAuthUsers(nextUsers)
              snackbarHostState.showSnackbar("Granted access to ${req.email}")
              null
            }
          },
          onRejectRequest = { reqId ->
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired."
              when (val res = FireTuneApi.decideRequest(serverUrl, token, reqId, "reject")) {
                is ApiResult.Success -> {
                  val updatedReq = res.data.first
                  if (updatedReq != null) {
                    accessRequests = accessRequests.map { if (it.id == reqId) updatedReq else it }
                  }
                  snackbarHostState.showSnackbar("Request rejected")
                  null
                }
                is ApiResult.Error -> res.message
              }
            } else {
              val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
              val nextReqs = accessRequests.map {
                if (it.id == reqId) it.copy(status = RequestStatus.REJECTED, decidedAt = nowStr) else it
              }
              accessRequests = nextReqs
              storage.saveAccessRequests(nextReqs)
              snackbarHostState.showSnackbar("Request rejected")
              null
            }
          },
          onCreateUser = { emailInput, customIdInput, displayNameInput, pwInput, devId, role ->
            val cleanEmail = emailInput.trim().lowercase()
            if (!LocalAuthCrypto.isValidEmail(cleanEmail)) {
              return@AdminAccessScreen "Please enter a valid Email ID." to null
            }
            val minLen = if (role == AuthRole.ADMIN) 6 else 4
            if (pwInput.length < minLen) {
              return@AdminAccessScreen "Password must be at least $minLen characters." to null
            }
            val resolvedId = customIdInput.trim().lowercase().ifEmpty { LocalAuthCrypto.deriveCustomIdFromEmail(cleanEmail) }
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen ("Session expired." to null)
              if (role == AuthRole.ADMIN) {
                return@AdminAccessScreen ("Create extra Admin accounts from the Web Admin Dashboard." to null)
              }
              when (
                val res = FireTuneApi.createCustomer(
                  baseUrl = serverUrl,
                  token = token,
                  email = cleanEmail,
                  customId = resolvedId,
                  displayName = displayNameInput.trim().ifEmpty { resolvedId },
                  password = pwInput,
                  deviceId = devId,
                )
              ) {
                is ApiResult.Success -> {
                  authUsers = listOf(res.data) + authUsers
                  null to "Created user account for $cleanEmail"
                }
                is ApiResult.Error -> res.message to null
              }
            } else {
              if (authUsers.any { it.email.equals(cleanEmail, ignoreCase = true) }) {
                return@AdminAccessScreen "Account with this Email ID already exists." to null
              }
              val salt = LocalAuthCrypto.generateSalt()
              val hash = LocalAuthCrypto.hashPassword(pwInput, salt)
              val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
              val newUser = LocalAuthUser(
                id = "usr-${System.currentTimeMillis()}",
                email = cleanEmail,
                customId = resolvedId,
                displayName = displayNameInput.trim().ifEmpty { resolvedId },
                role = role,
                passwordHash = hash,
                passwordSalt = salt,
                assignedDeviceId = devId,
                suspended = false,
                createdAt = nowStr,
              )
              val nextUsers = listOf(newUser) + authUsers
              authUsers = nextUsers
              storage.saveAuthUsers(nextUsers)
              null to "Created ${role.name.lowercase()} account for $cleanEmail"
            }
          },
          onToggleSuspend = { userId ->
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired."
              val target = authUsers.find { it.id == userId } ?: return@AdminAccessScreen "User not found."
              when (val res = FireTuneApi.toggleCustomerActive(serverUrl, token, userId, target.suspended)) {
                is ApiResult.Success -> {
                  authUsers = authUsers.map { if (it.id == userId) res.data else it }
                  null
                }
                is ApiResult.Error -> res.message
              }
            } else {
              val nextUsers = authUsers.map {
                if (it.id == userId) it.copy(suspended = !it.suspended) else it
              }
              authUsers = nextUsers
              storage.saveAuthUsers(nextUsers)
              null
            }
          },
          onDeleteUser = { userId ->
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired."
              when (val res = FireTuneApi.deleteCustomer(serverUrl, token, userId)) {
                is ApiResult.Success -> {
                  authUsers = authUsers.filterNot { it.id == userId }
                  null
                }
                is ApiResult.Error -> res.message
              }
            } else {
              val nextUsers = authUsers.filterNot { it.id == userId }
              authUsers = nextUsers
              storage.saveAuthUsers(nextUsers)
              null
            }
          },
          onUpdateAdminCredentials = { currentPw, nextAdminId, nextPw ->
            val cleanId = nextAdminId.trim().lowercase()
            if (cleanId.length < 3) {
              return@AdminAccessScreen "Admin ID must be at least 3 characters." to null
            }
            if (nextPw.length < 6) {
              return@AdminAccessScreen "New admin password must be at least 6 characters." to null
            }
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen ("Session expired." to null)
              when (val res = FireTuneApi.updateAdminCredentials(serverUrl, token, currentPw, cleanId, nextPw)) {
                is ApiResult.Success -> {
                  remoteSessionToken = res.data.token
                  remoteSessionUser = res.data.user
                  null to "Admin credentials updated for @$cleanId."
                }
                is ApiResult.Error -> res.message to null
              }
            } else if (activeAuthUser.id == "root-admin") {
              val rootCfg = adminConfig ?: return@AdminAccessScreen "No claimed admin credentials exist yet." to null
              if (!LocalAuthCrypto.verifyPassword(currentPw, rootCfg.passwordSalt, rootCfg.passwordHash)) {
                return@AdminAccessScreen "Current admin password is incorrect." to null
              }
              val salt = LocalAuthCrypto.generateSalt()
              val hash = LocalAuthCrypto.hashPassword(nextPw, salt)
              val updated = LocalAdminConfig(cleanId, hash, salt)
              adminConfig = updated
              storage.saveAdminConfig(updated)
              null to "Admin credentials updated for @$cleanId."
            } else {
              val target = authUsers.find { it.id == activeAuthUser.id }
                ?: return@AdminAccessScreen "Admin account not found." to null
              if (!LocalAuthCrypto.verifyPassword(currentPw, target.passwordSalt, target.passwordHash)) {
                return@AdminAccessScreen "Current admin password is incorrect." to null
              }
              val salt = LocalAuthCrypto.generateSalt()
              val hash = LocalAuthCrypto.hashPassword(nextPw, salt)
              val nextUsers = authUsers.map {
                if (it.id == target.id) it.copy(customId = cleanId, passwordHash = hash, passwordSalt = salt) else it
              }
              authUsers = nextUsers
              storage.saveAuthUsers(nextUsers)
              null to "Admin credentials updated for @$cleanId."
            }
          },
          onResetAdminClaim = { currentPw ->
            if (serverSyncEnabled) {
              val token = remoteSessionToken ?: return@AdminAccessScreen "Session expired."
              when (val res = FireTuneApi.resetAdminClaim(serverUrl, token, currentPw)) {
                is ApiResult.Success -> {
                  remoteSessionToken = null
                  remoteSessionUser = null
                  remoteAdminConfigured = false
                  null
                }
                is ApiResult.Error -> res.message
              }
            } else {
              val rootCfg = adminConfig ?: return@AdminAccessScreen "No claimed admin credentials exist yet."
              if (!LocalAuthCrypto.verifyPassword(currentPw, rootCfg.passwordSalt, rootCfg.passwordHash)) {
                return@AdminAccessScreen "Current admin password is required to reset."
              }
              storage.clearAdminConfig()
              storage.saveSessionUserId(null)
              adminConfig = null
              sessionUserId = null
              null
            }
          },
          onOpenCalibrationStudio = { activeTab = FireTuneTab.SENSITIVITY },
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
