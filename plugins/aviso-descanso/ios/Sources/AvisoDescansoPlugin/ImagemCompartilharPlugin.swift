import Foundation
import UIKit
import Photos
import Capacitor

/// Artes de compartilhamento (PNG com fundo transparente): abre o menu de compartilhar do iPhone,
/// salva nas Fotos ou copia para a área de transferência — sempre com o PNG original, sem perder a transparência.
@objc(ImagemCompartilharPlugin)
public class ImagemCompartilharPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ImagemCompartilharPlugin"
    public let jsName = "ImagemCompartilhar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "compartilhar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salvar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copiar", returnType: CAPPluginReturnPromise)
    ]

    private func dadosPng(_ call: CAPPluginCall) -> Data? {
        guard let b64 = call.getString("base64") else { return nil }
        return Data(base64Encoded: b64)
    }

    @objc func compartilhar(_ call: CAPPluginCall) {
        guard let dados = dadosPng(call) else { call.reject("Imagem inválida"); return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("forza-run.png")
        do { try dados.write(to: url, options: .atomic) } catch { call.reject("Não consegui preparar a imagem"); return }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("Sem tela"); return }
            let menu = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = menu.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 60, width: 1, height: 1)
            }
            menu.completionWithItemsHandler = { _, concluido, _, _ in call.resolve(["concluido": concluido]) }
            vc.present(menu, animated: true)
        }
    }

    @objc func salvar(_ call: CAPPluginCall) {
        guard let dados = dadosPng(call) else { call.reject("Imagem inválida"); return }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { call.reject("Sem permissão para salvar nas Fotos"); return }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: dados, options: nil)
            }) { ok, _ in
                if ok { call.resolve() } else { call.reject("Não consegui salvar") }
            }
        }
    }

    @objc func copiar(_ call: CAPPluginCall) {
        guard let dados = dadosPng(call) else { call.reject("Imagem inválida"); return }
        DispatchQueue.main.async {
            UIPasteboard.general.setData(dados, forPasteboardType: "public.png")
            call.resolve()
        }
    }
}
