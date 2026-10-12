import Foundation
import AVFoundation

/// Procedural Audio Engine for iOS
/// Synthesizes Tokyo Station ticket gate chime (1760 Hz / 2349 Hz) and 432 Hz Rin singing bowl.
public final class AudioService {
    public static let shared = AudioService()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()

    private init() {
        setupAudioSession()
    }

    private func setupAudioSession() {
        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient, mode: .default)
            try session.setActive(true)
        } catch {
            print("AudioSession setup warning: \(error)")
        }
        #endif
    }

    /// Tokyo Station Gate Dual Chime ("Pii-Pik!")
    public func playFeliCa() {
        playToneSequence(tones: [(1760.0, 0.055), (2349.3, 0.110)], interval: 0.065)
    }

    /// Gate Insufficient Funds Warning ("Pi-Boo")
    public func playFeliCaError() {
        playToneSequence(tones: [(370.0, 0.12), (290.0, 0.18)], interval: 0.12)
    }

    /// Revolut Ultra Platinum Crystalline Shimmer
    public func playUltraShimmer() {
        playToneSequence(tones: [(1046.5, 0.25), (1318.5, 0.35), (1568.0, 0.45), (2093.0, 0.60)], interval: 0.04)
    }

    private func playToneSequence(tones: [(freq: Double, duration: Double)], interval: Double) {
        let sampleRate: Double = 44100.0
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!

        var totalFrames = 0
        tones.enumerated().forEach { idx, tone in
            let startFrame = Int(Double(idx) * interval * sampleRate)
            let toneFrames = Int(tone.duration * sampleRate)
            totalFrames = max(totalFrames, startFrame + toneFrames)
        }

        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(totalFrames)) else { return }
        buffer.frameLength = AVAudioFrameCount(totalFrames)

        guard let channelData = buffer.floatChannelData?[0] else { return }
        for i in 0..<totalFrames { channelData[i] = 0.0 }

        for (idx, tone) in tones.enumerated() {
            let startFrame = Int(Double(idx) * interval * sampleRate)
            let toneFrames = Int(tone.duration * sampleRate)

            for i in 0..<toneFrames {
                let frameIndex = startFrame + i
                if frameIndex < totalFrames {
                    let progress = Double(i) / Double(toneFrames)
                    let envelope = sin(progress * .pi) // smooth half-sine envelope
                    let sample = Float(sin(2.0 * .pi * tone.freq * (Double(i) / sampleRate)) * envelope * 0.18)
                    channelData[frameIndex] += sample
                }
            }
        }

        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)

        do {
            try engine.start()
            player.play()
            player.scheduleBuffer(buffer) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    engine.stop()
                }
            }
        } catch {
            print("Engine start error: \(error)")
        }
    }
}
