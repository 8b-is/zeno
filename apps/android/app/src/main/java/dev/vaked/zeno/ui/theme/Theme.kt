package dev.vaked.zeno.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BgSumi = Color(0xFF07080B)
val BgCard = Color(0xFF0D0F17)
val BgElevated = Color(0xFF131724)
val ColorGold = Color(0xFFE8B05C)
val ColorTeal = Color(0xFF62E6C9)
val ColorViolet = Color(0xFFB48BFF)
val ColorPasmoPink = Color(0xFFEA5582)
val ColorSuicaGreen = Color(0xFF009944)
val TextMain = Color(0xFFF5F4F0)
val TextDim = Color(0xFF8B88A2)

private val DarkColorScheme = darkColorScheme(
    primary = ColorGold,
    secondary = ColorTeal,
    tertiary = ColorViolet,
    background = BgSumi,
    surface = BgCard,
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onBackground = TextMain,
    onSurface = TextMain
)

@Composable
fun ZenoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
