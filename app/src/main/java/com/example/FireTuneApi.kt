package com.example

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

data class RemoteAuthStatus(
  val adminConfigured: Boolean,
  val envOverrideActive: Boolean,
  val customerCount: Int,
)

data class RemoteAuthSession(
  val token: String,
  val user: LocalAuthUser,
)

sealed class ApiResult<out T> {
  data class Success<T>(val data: T) : ApiResult<T>()
  data class Error(val message: String, val code: Int = 0) : ApiResult<Nothing>()
}

object FireTuneApi {
  private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(12, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .writeTimeout(15, TimeUnit.SECONDS)
    .followRedirects(false)
    .followSslRedirects(false)
    .build()

  fun normalizeBaseUrl(raw: String): String? {
    val trimmed = raw.trim().trimEnd('/')
    if (trimmed.isEmpty()) return null
    val lower = trimmed.lowercase()
    if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
      return null
    }
    return trimmed
  }

  private suspend fun executeJson(
    method: String,
    baseUrl: String,
    path: String,
    body: JSONObject? = null,
    bearerToken: String? = null,
  ): ApiResult<JSONObject> = withContext(Dispatchers.IO) {
    val normalized = normalizeBaseUrl(baseUrl)
      ?: return@withContext ApiResult.Error("Invalid Server URL. Use https://...")

    val url = "$normalized$path"
    val requestBody = body?.toString()?.toRequestBody(jsonMediaType)
    val builder = Request.Builder()
      .url(url)
      .header("Accept", "application/json")
      .header("Cache-Control", "no-store")

    if (!bearerToken.isNullOrBlank()) {
      builder.header("Authorization", "Bearer $bearerToken")
    }

    when (method) {
      "GET" -> builder.get()
      "POST" -> builder.post(requestBody ?: "{}".toRequestBody(jsonMediaType))
      "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(jsonMediaType))
      "DELETE" -> builder.delete(requestBody)
      else -> builder.get()
    }

    try {
      client.newCall(builder.build()).execute().use { response ->
        val rawBody = response.body?.string().orEmpty()
        val contentType = response.header("Content-Type").orEmpty().lowercase()

        if (response.code in 300..399) {
          return@withContext ApiResult.Error(
            "Server URL redirected to login (HTTP ${response.code}). Use your published Shared App URL.",
            response.code,
          )
        }

        if (!contentType.contains("application/json")) {
          return@withContext ApiResult.Error(
            "Server returned HTTP ${response.code} (not JSON). Publish/Share the web app or check Server URL.",
            response.code,
          )
        }

        val parsed = runCatching {
          if (rawBody.isBlank()) JSONObject() else JSONObject(rawBody)
        }.getOrNull() ?: return@withContext ApiResult.Error(
          "Invalid JSON response from server (HTTP ${response.code}).",
          response.code,
        )

        if (!response.isSuccessful) {
          val errMsg = parsed.optString("error").ifBlank {
            "Server request failed (HTTP ${response.code})."
          }
          return@withContext ApiResult.Error(errMsg, response.code)
        }

        ApiResult.Success(parsed)
      }
    } catch (e: Exception) {
      ApiResult.Error(e.localizedMessage ?: "Network error connecting to FF TUNE server.")
    }
  }

  private fun parseUser(o: JSONObject): LocalAuthUser {
    val roleStr = o.optString("role", "customer")
    val role = if (roleStr == "admin") AuthRole.ADMIN else AuthRole.USER
    return LocalAuthUser(
      id = o.optString("id"),
      email = o.optString("email", ""),
      customId = o.optString("customId", ""),
      displayName = o.optString("displayName", o.optString("customId", "")),
      role = role,
      passwordHash = "",
      passwordSalt = "",
      assignedDeviceId = o.optString("assignedDeviceId", "samsung-a54"),
      suspended = o.has("active") && !o.optBoolean("active", true),
      createdAt = o.optString("createdAt", ""),
    )
  }

  private fun parseRequest(o: JSONObject): LocalAccessRequest {
    val status = when (o.optString("status", "pending").lowercase()) {
      "accepted", "approved" -> RequestStatus.APPROVED
      "rejected" -> RequestStatus.REJECTED
      else -> RequestStatus.PENDING
    }
    return LocalAccessRequest(
      id = o.optString("id"),
      email = o.optString("email", ""),
      customId = o.optString("customId", ""),
      displayName = o.optString("displayName", ""),
      passwordHash = "",
      passwordSalt = "",
      requestedDeviceId = o.optString("requestedDeviceId", "samsung-a54"),
      note = o.optString("note", ""),
      status = status,
      createdAt = o.optString("createdAt", ""),
      decidedAt = if (o.has("reviewedAt") && !o.isNull("reviewedAt")) o.optString("reviewedAt") else null,
    )
  }

  suspend fun fetchAuthStatus(baseUrl: String): ApiResult<RemoteAuthStatus> {
    return when (val res = executeJson("GET", baseUrl, "/api/auth/status")) {
      is ApiResult.Success -> ApiResult.Success(
        RemoteAuthStatus(
          adminConfigured = res.data.optBoolean("adminConfigured", false),
          envOverrideActive = res.data.optBoolean("envOverrideActive", false),
          customerCount = res.data.optInt("customerCount", 0),
        )
      )
      is ApiResult.Error -> res
    }
  }

  suspend fun claimAdmin(baseUrl: String, customId: String, password: String): ApiResult<RemoteAuthSession> {
    val body = JSONObject().apply {
      put("customId", customId)
      put("password", password)
    }
    return when (val res = executeJson("POST", baseUrl, "/api/auth/admin/claim", body)) {
      is ApiResult.Success -> {
        val token = res.data.optString("token")
        val userObj = res.data.optJSONObject("user")
        if (token.isBlank() || userObj == null) {
          ApiResult.Error("Malformed claim response from server.")
        } else {
          ApiResult.Success(RemoteAuthSession(token, parseUser(userObj)))
        }
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun login(baseUrl: String, role: AuthRole, customId: String, password: String): ApiResult<RemoteAuthSession> {
    val body = JSONObject().apply {
      put("role", if (role == AuthRole.ADMIN) "admin" else "customer")
      put("customId", customId)
      put("password", password)
    }
    return when (val res = executeJson("POST", baseUrl, "/api/auth/login", body)) {
      is ApiResult.Success -> {
        val token = res.data.optString("token")
        val userObj = res.data.optJSONObject("user")
        if (token.isBlank() || userObj == null) {
          ApiResult.Error("Malformed login response from server.")
        } else {
          ApiResult.Success(RemoteAuthSession(token, parseUser(userObj)))
        }
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun requestAccess(
    baseUrl: String,
    email: String,
    customId: String,
    displayName: String,
    password: String,
    requestedDeviceId: String,
    note: String,
  ): ApiResult<LocalAccessRequest> {
    val body = JSONObject().apply {
      put("email", email)
      put("customId", customId)
      put("displayName", displayName)
      put("password", password)
      put("requestedDeviceId", requestedDeviceId)
      put("note", note)
    }
    return when (val res = executeJson("POST", baseUrl, "/api/auth/request-access", body)) {
      is ApiResult.Success -> {
        val reqObj = res.data.optJSONObject("request")
        if (reqObj == null) {
          ApiResult.Error("Malformed request response from server.")
        } else {
          ApiResult.Success(parseRequest(reqObj))
        }
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun fetchRequests(baseUrl: String, token: String): ApiResult<List<LocalAccessRequest>> {
    return when (val res = executeJson("GET", baseUrl, "/api/admin/requests", bearerToken = token)) {
      is ApiResult.Success -> {
        val arr = res.data.optJSONArray("requests") ?: JSONArray()
        val list = buildList {
          for (i in 0 until arr.length()) {
            add(parseRequest(arr.getJSONObject(i)))
          }
        }
        ApiResult.Success(list)
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun decideRequest(
    baseUrl: String,
    token: String,
    requestId: String,
    decision: String,
    rejectionReason: String = "",
  ): ApiResult<Pair<LocalAccessRequest?, LocalAuthUser?>> {
    val body = JSONObject().apply {
      put("decision", decision)
      if (rejectionReason.isNotBlank()) put("rejectionReason", rejectionReason)
    }
    return when (
      val res = executeJson("POST", baseUrl, "/api/admin/requests/$requestId/decide", body, token)
    ) {
      is ApiResult.Success -> {
        val reqObj = res.data.optJSONObject("request")?.let(::parseRequest)
        val custObj = res.data.optJSONObject("customer")?.let(::parseUser)
        ApiResult.Success(reqObj to custObj)
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun fetchCustomers(baseUrl: String, token: String): ApiResult<List<LocalAuthUser>> {
    return when (val res = executeJson("GET", baseUrl, "/api/admin/customers", bearerToken = token)) {
      is ApiResult.Success -> {
        val arr = res.data.optJSONArray("customers") ?: JSONArray()
        val list = buildList {
          for (i in 0 until arr.length()) {
            add(parseUser(arr.getJSONObject(i)))
          }
        }
        ApiResult.Success(list)
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun createCustomer(
    baseUrl: String,
    token: String,
    email: String,
    customId: String,
    displayName: String,
    password: String,
    deviceId: String,
  ): ApiResult<LocalAuthUser> {
    val body = JSONObject().apply {
      put("email", email)
      put("customId", customId)
      put("displayName", displayName)
      put("password", password)
      put("assignedDeviceId", deviceId)
    }
    return when (val res = executeJson("POST", baseUrl, "/api/admin/customers", body, token)) {
      is ApiResult.Success -> {
        val custObj = res.data.optJSONObject("customer")
        if (custObj == null) ApiResult.Error("Malformed customer response.") else ApiResult.Success(parseUser(custObj))
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun toggleCustomerActive(
    baseUrl: String,
    token: String,
    customerId: String,
    active: Boolean,
  ): ApiResult<LocalAuthUser> {
    val body = JSONObject().apply { put("active", active) }
    return when (val res = executeJson("PATCH", baseUrl, "/api/admin/customers/$customerId", body, token)) {
      is ApiResult.Success -> {
        val custObj = res.data.optJSONObject("customer")
        if (custObj == null) ApiResult.Error("Malformed customer update.") else ApiResult.Success(parseUser(custObj))
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun deleteCustomer(baseUrl: String, token: String, customerId: String): ApiResult<Unit> {
    return when (val res = executeJson("DELETE", baseUrl, "/api/admin/customers/$customerId", bearerToken = token)) {
      is ApiResult.Success -> ApiResult.Success(Unit)
      is ApiResult.Error -> res
    }
  }

  suspend fun updateAdminCredentials(
    baseUrl: String,
    token: String,
    currentPassword: String,
    newAdminId: String,
    newPassword: String,
  ): ApiResult<RemoteAuthSession> {
    val body = JSONObject().apply {
      put("currentPassword", currentPassword)
      put("newAdminId", newAdminId)
      put("newPassword", newPassword)
    }
    return when (val res = executeJson("POST", baseUrl, "/api/admin/credentials", body, token)) {
      is ApiResult.Success -> {
        val nextToken = res.data.optString("token")
        val userObj = res.data.optJSONObject("user")
        if (nextToken.isBlank() || userObj == null) {
          ApiResult.Error("Malformed credential update response.")
        } else {
          ApiResult.Success(RemoteAuthSession(nextToken, parseUser(userObj)))
        }
      }
      is ApiResult.Error -> res
    }
  }

  suspend fun resetAdminClaim(
    baseUrl: String,
    token: String,
    currentPassword: String,
  ): ApiResult<Unit> {
    val body = JSONObject().apply { put("currentPassword", currentPassword) }
    return when (val res = executeJson("POST", baseUrl, "/api/admin/credentials/reset-claim", body, token)) {
      is ApiResult.Success -> ApiResult.Success(Unit)
      is ApiResult.Error -> res
    }
  }
}
