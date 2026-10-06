import Foundation
import AVFoundation
import Capacitor

/// Aviso do fim do descanso. Durante o aviso a sessão de áudio fica com .duckOthers: a música de outros apps
/// (Spotify, YouTube Music, podcast) abaixa, o sinal toca e a voz fala; depois a sessão é desativada com
/// .notifyOthersOnDeactivation para a música voltar ao volume normal.
@objc(AvisoDescansoPlugin)
public class AvisoDescansoPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    public let identifier = "AvisoDescansoPlugin"
    public let jsName = "AvisoDescanso"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "tocar", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?
    private let sintetizador = AVSpeechSynthesizer()
    private var textoPendente: String?
    private var nomeVoz: String?
    private var chamada: CAPPluginCall?

    override public func load() {
        sintetizador.delegate = self
    }

    /// Opções: som (bool), volume (0–1), texto (string opcional), voz (nome da voz, opcional).
    @objc func tocar(_ call: CAPPluginCall) {
        let som = call.getBool("som") ?? true
        let volume = Float(call.getDouble("volume") ?? 1.0)
        let texto = call.getString("texto")
        nomeVoz = call.getString("voz")
        DispatchQueue.main.async {
            self.chamada?.resolve()
            self.chamada = call
            self.player?.stop()
            if self.sintetizador.isSpeaking { self.sintetizador.stopSpeaking(at: .immediate) }
            let sessao = AVAudioSession.sharedInstance()
            do {
                try sessao.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
                try sessao.setActive(true)
            } catch {
                // sem foco de áudio ainda dá para tentar tocar
            }
            self.textoPendente = (texto?.isEmpty == false) ? texto : nil
            if som, let url = self.urlDoSom() {
                do {
                    let p = try AVAudioPlayer(contentsOf: url)
                    p.volume = max(0, min(1, volume))
                    p.delegate = self
                    self.player = p
                    p.play()
                    return
                } catch {}
            }
            self.falarOuEncerrar()
        }
    }

    private func urlDoSom() -> URL? {
        if let u = Bundle.main.url(forResource: "fim-descanso", withExtension: "wav", subdirectory: "public/sons") { return u }
        return Bundle.main.url(forResource: "fim-descanso", withExtension: "wav", subdirectory: "public")
    }

    private func falarOuEncerrar() {
        guard let texto = textoPendente else { encerrar(); return }
        textoPendente = nil
        let fala = AVSpeechUtterance(string: texto)
        let vozes = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("pt") }
        if let nome = nomeVoz, let v = vozes.first(where: { $0.name == nome }) {
            fala.voice = v
        } else {
            // Sem voz escolhida: voz feminina em português quando o aparelho tiver uma.
            let femininas = ["luciana", "francisca", "fernanda", "joana", "catarina", "helena", "camila", "maria"]
            let feminina = vozes.first(where: { v in v.gender == .female || femininas.contains(where: { v.name.lowercased().contains($0) }) })
            fala.voice = feminina ?? vozes.first(where: { $0.language == "pt-BR" }) ?? AVSpeechSynthesisVoice(language: "pt-BR")
        }
        fala.rate = AVSpeechUtteranceDefaultSpeechRate * 0.96
        sintetizador.speak(fala)
    }

    private func encerrar() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            self.chamada?.resolve()
            self.chamada = nil
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        falarOuEncerrar()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        encerrar()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        encerrar()
    }
}
