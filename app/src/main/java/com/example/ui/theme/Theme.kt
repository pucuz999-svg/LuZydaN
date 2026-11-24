package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FireTuneColorScheme =
  darkColorScheme(
    primary = OrangeAccent,
    onPrimary = Color(0xFF0B0E14),
    secondary = EmeraldAccent,
    onSecondary = Color(0xFF0B0E14),
    tertiary = AmberAccent,
    background = BgObsidian,
    onBackground = TextPrimary,
    surface = SurfacePanel,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceElevated,
    onSurfaceVariant = TextMuted,
    outline = BorderSlate,
    error = RoseAccent,
  )

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = true,
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = FireTuneColorScheme,
    typography = Typography,
    content = content,
  )
}
