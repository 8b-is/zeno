package dev.vaked.zeno.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Revolut Ultra Brushed Platinum Metal Card for Android
 */
@Composable
fun RevolutUltraCard() {
    val metalBrush = Brush.linearGradient(
        listOf(
            Color(0xFFE9ECEF),
            Color(0xFFCBD2DC),
            Color(0xFF9AA3B2),
            Color(0xFFD8DDE6),
            Color(0xFFF8F9FA)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(210.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(metalBrush)
            .border(1.dp, Color.White.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
            .padding(22.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .background(Color(0xFF11141C), RoundedCornerShape(5.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "R",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Revolut",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color(0xFF11141C)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "ULTRA",
                        fontWeight = FontWeight.Black,
                        fontSize = 10.sp,
                        letterSpacing = 2.sp,
                        color = Color(0xFF4B5563)
                    )
                }

                // EMV Gold Chip
                Box(
                    modifier = Modifier
                        .size(width = 34.dp, height = 24.dp)
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFFD4AF37), Color(0xFFF9E27D), Color(0xFFAA820A))
                            ),
                            RoundedCornerShape(3.dp)
                        )
                        .border(0.5.dp, Color.Black.opacity(0.3f), RoundedCornerShape(3.dp))
                )
            }

            // Card Number
            Column {
                Text(
                    text = "•••• •••• •••• 8421",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp,
                    color = Color(0xFF11141C),
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "EXP 09/31 · PLATINUM 5412",
                    fontSize = 10.sp,
                    color = Color(0xFF374151),
                    fontFamily = FontFamily.Monospace
                )
            }

            // Footer
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        text = "8B-IS CREW · HUE · AYE · TAISHA · OMNI",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFF0B0D13),
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "8B-IS TEAM & FAMILY COLLABORATION <3",
                        fontSize = 9.sp,
                        color = Color(0xFF4B5563),
                        fontFamily = FontFamily.Monospace
                    )
                }
                Box(
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.45f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "PLATINUM 22.5g",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF2B313D),
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}
