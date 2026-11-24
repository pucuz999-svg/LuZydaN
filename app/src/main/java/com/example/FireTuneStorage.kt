package com.example

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class FireTuneStorage(context: Context) {
  private val prefs = context.getSharedPreferences("firetune_prefs_v1", Context.MODE_PRIVATE)

  fun loadCustomDevices(): List<DeviceSpec> {
    val raw = prefs.getString("custom_devices", null) ?: return emptyList()
    return runCatching {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until arr.length()) {
          val o = arr.getJSONObject(i)
          add(
            DeviceSpec(
              id = o.getString("id"),
              brand = o.getString("brand"),
              model = o.getString("model"),
              tier = DeviceTier.valueOf(o.getString("tier")),
              os = OperatingSystem.valueOf(o.getString("os")),
              ramGb = o.getInt("ramGb"),
              refreshHz = o.getInt("refreshHz"),
              touchSamplingHz = o.getInt("touchSamplingHz"),
              screenInches = o.getDouble("screenInches"),
              chipset = o.getString("chipset"),
              defaultDpi = o.getInt("defaultDpi"),
              recommendedDpi = o.getInt("recommendedDpi"),
              thermalHeadroom = o.getString("thermalHeadroom"),
              isCustom = true,
            )
          )
        }
      }
    }.getOrDefault(emptyList())
  }

  fun saveCustomDevices(devices: List<DeviceSpec>) {
    val arr = JSONArray()
    devices.forEach { d ->
      val o = JSONObject()
      o.put("id", d.id)
      o.put("brand", d.brand)
      o.put("model", d.model)
      o.put("tier", d.tier.name)
      o.put("os", d.os.name)
      o.put("ramGb", d.ramGb)
      o.put("refreshHz", d.refreshHz)
      o.put("touchSamplingHz", d.touchSamplingHz)
      o.put("screenInches", d.screenInches)
      o.put("chipset", d.chipset)
      o.put("defaultDpi", d.defaultDpi)
      o.put("recommendedDpi", d.recommendedDpi)
      o.put("thermalHeadroom", d.thermalHeadroom)
      arr.put(o)
    }
    prefs.edit().putString("custom_devices", arr.toString()).apply()
  }

  fun loadSavedProfiles(): List<SavedProfile> {
    val raw = prefs.getString("saved_profiles", null) ?: return emptyList()
    return runCatching {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until arr.length()) {
          val o = arr.getJSONObject(i)
          val s = o.getJSONObject("sensitivity")
          add(
            SavedProfile(
              id = o.getString("id"),
              name = o.getString("name"),
              createdAt = o.getString("createdAt"),
              deviceId = o.getString("deviceId"),
              deviceLabel = o.getString("deviceLabel"),
              os = OperatingSystem.valueOf(o.getString("os")),
              ramGb = o.getInt("ramGb"),
              refreshHz = o.getInt("refreshHz"),
              playstyle = PlaystyleId.valueOf(o.getString("playstyle")),
              grip = GripType.valueOf(o.getString("grip")),
              rangeBias = RangeBias.valueOf(o.getString("rangeBias")),
              sensitivity = SensitivityValues(
                general = s.getInt("general"),
                redDot = s.getInt("redDot"),
                scope2x = s.getInt("scope2x"),
                scope4x = s.getInt("scope4x"),
                sniperScope = s.getInt("sniperScope"),
                freeLook = s.getInt("freeLook"),
              ),
              fireButtonSize = o.getInt("fireButtonSize"),
              dpiValue = o.getInt("dpiValue"),
              dpiLabel = o.getString("dpiLabel"),
              graphicsDisplay = o.getString("graphicsDisplay"),
              highFps = o.getString("highFps"),
            )
          )
        }
      }
    }.getOrDefault(emptyList())
  }

  fun saveSavedProfiles(profiles: List<SavedProfile>) {
    val arr = JSONArray()
    profiles.forEach { p ->
      val s = JSONObject()
      s.put("general", p.sensitivity.general)
      s.put("redDot", p.sensitivity.redDot)
      s.put("scope2x", p.sensitivity.scope2x)
      s.put("scope4x", p.sensitivity.scope4x)
      s.put("sniperScope", p.sensitivity.sniperScope)
      s.put("freeLook", p.sensitivity.freeLook)

      val o = JSONObject()
      o.put("id", p.id)
      o.put("name", p.name)
      o.put("createdAt", p.createdAt)
      o.put("deviceId", p.deviceId)
      o.put("deviceLabel", p.deviceLabel)
      o.put("os", p.os.name)
      o.put("ramGb", p.ramGb)
      o.put("refreshHz", p.refreshHz)
      o.put("playstyle", p.playstyle.name)
      o.put("grip", p.grip.name)
      o.put("rangeBias", p.rangeBias.name)
      o.put("sensitivity", s)
      o.put("fireButtonSize", p.fireButtonSize)
      o.put("dpiValue", p.dpiValue)
      o.put("dpiLabel", p.dpiLabel)
      o.put("graphicsDisplay", p.graphicsDisplay)
      o.put("highFps", p.highFps)
      arr.put(o)
    }
    prefs.edit().putString("saved_profiles", arr.toString()).apply()
  }

  fun loadChecklistMap(): Map<String, Set<String>> {
    val raw = prefs.getString("checklist_map", null) ?: return emptyMap()
    return runCatching {
      val obj = JSONObject(raw)
      buildMap {
        val keys = obj.keys()
        while (keys.hasNext()) {
          val k = keys.next()
          val arr = obj.getJSONArray(k)
          val set = buildSet {
            for (i in 0 until arr.length()) add(arr.getString(i))
          }
          put(k, set)
        }
      }
    }.getOrDefault(emptyMap())
  }

  fun saveChecklistMap(map: Map<String, Set<String>>) {
    val obj = JSONObject()
    map.forEach { (k, v) ->
      val arr = JSONArray()
      v.forEach { arr.put(it) }
      obj.put(k, arr)
    }
    prefs.edit().putString("checklist_map", obj.toString()).apply()
  }

  fun loadNotificationBlock(): NotificationBlockSettings {
    val raw = prefs.getString("notification_block", null) ?: return NotificationBlockSettings()
    return runCatching {
      val o = JSONObject(raw)
      NotificationBlockSettings(
        enabled = o.optBoolean("enabled", true),
        blockHeadsUp = o.optBoolean("blockHeadsUp", true),
        blockCalls = o.optBoolean("blockCalls", true),
        blockFloatingBubbles = o.optBoolean("blockFloatingBubbles", true),
        muteInAppAlerts = o.optBoolean("muteInAppAlerts", false),
      )
    }.getOrDefault(NotificationBlockSettings())
  }

  fun saveNotificationBlock(settings: NotificationBlockSettings) {
    val o = JSONObject()
    o.put("enabled", settings.enabled)
    o.put("blockHeadsUp", settings.blockHeadsUp)
    o.put("blockCalls", settings.blockCalls)
    o.put("blockFloatingBubbles", settings.blockFloatingBubbles)
    o.put("muteInAppAlerts", settings.muteInAppAlerts)
    prefs.edit().putString("notification_block", o.toString()).apply()
  }
}
