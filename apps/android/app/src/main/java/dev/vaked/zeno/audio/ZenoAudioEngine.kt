package dev.vaked.zeno.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.sin

/**
 * ZENO Procedural Audio Engine for Android
 * Synthesizes Tokyo ticket gate chime (1760 Hz / 2349 Hz) and 432 Hz Rin bowl.
 */
object ZenoAudioEngine {
    private const val SAMPLE_RATE = 44100

    fun playFeliCa() {
        thread {
            playToneSequence(
                listOf(
                    Pair(1760.0, 55),
                    Pair(2349.3, 110)
                ),
                gapMs = 10
            )
        }
    }

    fun playFeliCaError() {
        thread {
            playToneSequence(
                listOf(
                    Pair(370.0, 120),
                    Pair(290.0, 180)
                ),
                gapMs = 20
            )
        }
    }

    fun playUltraShimmer() {
        thread {
            playToneSequence(
                listOf(
                    Pair(1046.5, 200),
                    Pair(1318.5, 250),
                    Pair(1568.0, 300),
                    Pair(2093.0, 400)
                ),
                gapMs = 30
            )
        }
    }

    private fun playToneSequence(tones: List<Pair<Double, Int>>, gapMs: Int) {
        val totalMs = tones.sumOf { it.second } + (tones.size - 1) * gapMs
        val numSamples = (SAMPLE_RATE * (totalMs / 1000.0)).toInt()
        val buffer = ShortArray(numSamples)

        var currentSample = 0
        for ((idx, tone) in tones.withIndex()) {
            val freq = tone.first
            val durationMs = tone.second
            val toneSamples = (SAMPLE_RATE * (durationMs / 1000.0)).toInt()

            for (i in 0 until toneSamples) {
                if (currentSample + i < numSamples) {
                    val progress = i.toDouble() / toneSamples
                    val envelope = sin(progress * PI) // smooth attack/decay
                    val sample = sin(2.0 * PI * freq * (i.toDouble() / SAMPLE_RATE)) * envelope
                    buffer[currentSample + i] = (sample * 0.25 * Short.MAX_VALUE).toInt().toShort()
                }
            }
            currentSample += toneSamples + (SAMPLE_RATE * (gapMs / 1000.0)).toInt()
        }

        val audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(buffer.size * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        audioTrack.write(buffer, 0, buffer.size)
        audioTrack.play()
    }
}
